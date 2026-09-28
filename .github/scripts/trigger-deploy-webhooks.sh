#!/usr/bin/env bash
# Trigger the deploy webhook for every service in a deploy matrix over ONE VPN session.
#
# Every deploy job used to open its own OpenVPN session with the shared client certificate. The
# server keeps one session per certificate, so each new job dropped an earlier job's tunnel and
# that job's webhook call timed out. This script connects once, calls the webhooks one after
# another, and reconnects when a call fails before retrying it.
#
# Required env:
#   SERVICES_JSON          Deploy matrix: [{"service": "...", "webhook_env": "DEPLOY_WEBHOOK_..."}]
#   DEPLOY_WEBHOOK_TOKEN   Bearer token for the deploy webhooks
#   <webhook_env> vars     One env var per matrix entry holding that service's webhook URL
#   OPENVPN_CONFIG_B64     Base64-encoded OpenVPN client config
#   OPENVPN_PASSWORD       Passphrase for the client key
#
# Optional env:
#   SKIP_VPN=true          Call the webhooks directly (local testing only)
#   GITHUB_STEP_SUMMARY    Where to append the per-service result table

set -euo pipefail

services_json="${SERVICES_JSON:?SERVICES_JSON is required}"
webhook_token="${DEPLOY_WEBHOOK_TOKEN:?DEPLOY_WEBHOOK_TOKEN is required}"
skip_vpn="${SKIP_VPN:-false}"

workdir="$(mktemp -d)"
vpn_pid_file="$workdir/vpn.pid"
vpn_log_file="$workdir/vpn.log"

disconnect_vpn() {
  if [ -f "$vpn_pid_file" ]; then
    sudo kill "$(sudo cat "$vpn_pid_file")" >/dev/null 2>&1 || true
    sudo rm -f "$vpn_pid_file"
  fi
}

cleanup() {
  if [ "$skip_vpn" != "true" ]; then
    disconnect_vpn
  fi
  rm -rf "$workdir"
}
trap cleanup EXIT

prepare_vpn() {
  if ! command -v openvpn >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y openvpn
  fi

  printf "%s" "${OPENVPN_CONFIG_B64:?OPENVPN_CONFIG_B64 is required}" |
    base64 --decode >"$workdir/client.ovpn"
  printf "%s\n" "${OPENVPN_PASSWORD:?OPENVPN_PASSWORD is required}" >"$workdir/passphrase.txt"
  chmod 600 "$workdir/client.ovpn" "$workdir/passphrase.txt"
}

connect_vpn() {
  if [ "$skip_vpn" = "true" ]; then
    return 0
  fi

  local attempt
  for attempt in 1 2 3; do
    disconnect_vpn
    sudo rm -f "$vpn_log_file"

    sudo openvpn \
      --config "$workdir/client.ovpn" \
      --askpass "$workdir/passphrase.txt" \
      --daemon \
      --writepid "$vpn_pid_file" \
      --log "$vpn_log_file"

    local poll
    for poll in $(seq 1 30); do
      if sudo grep -q "Initialization Sequence Completed" "$vpn_log_file" 2>/dev/null; then
        echo "VPN connected (attempt ${attempt}, ${poll} checks)."
        return 0
      fi
      if [ -f "$vpn_pid_file" ] && ! sudo kill -0 "$(sudo cat "$vpn_pid_file")" >/dev/null 2>&1; then
        break
      fi
      sleep 2
    done

    echo "::warning::VPN did not connect (attempt ${attempt}/3)."
    sudo cat "$vpn_log_file" 2>/dev/null || true
    if [ "$attempt" -lt 3 ]; then
      sleep 10
    fi
  done

  return 1
}

trigger_webhook() {
  local webhook_url="$1"

  curl --fail --silent --show-error \
    --retry 2 \
    --retry-all-errors \
    --retry-delay 3 \
    --connect-timeout 10 \
    --max-time 60 \
    --output /dev/null \
    --write-out "HTTP %{http_code} in %{time_total}s\n" \
    --header "Authorization: Bearer ${webhook_token}" \
    "$webhook_url"
}

if [ "$skip_vpn" != "true" ]; then
  prepare_vpn
fi

if ! connect_vpn; then
  echo "::error::Could not connect to the deploy VPN; no service was deployed."
  exit 1
fi

service_count="$(jq 'length' <<<"$services_json")"
failed_services=()
summary_rows=()

for index in $(seq 0 $((service_count - 1))); do
  service="$(jq -r ".[$index].service" <<<"$services_json")"
  webhook_variable="$(jq -r ".[$index].webhook_env" <<<"$services_json")"
  webhook_url="${!webhook_variable:-}"

  if [ -z "$webhook_url" ]; then
    echo "::error::${service}: ${webhook_variable} is not set."
    failed_services+=("$service")
    summary_rows+=("| ${service} | missing \`${webhook_variable}\` |")
    continue
  fi

  echo "Deploying ${service}..."
  if trigger_webhook "$webhook_url"; then
    summary_rows+=("| ${service} | triggered |")
    continue
  fi

  echo "::warning::${service}: webhook call failed; reconnecting the VPN and retrying once."
  if connect_vpn && trigger_webhook "$webhook_url"; then
    summary_rows+=("| ${service} | triggered after reconnect |")
    continue
  fi

  echo "::error::${service}: webhook call failed after reconnecting."
  failed_services+=("$service")
  summary_rows+=("| ${service} | failed |")
done

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### Deploy webhooks"
    echo
    echo "| Service | Result |"
    echo "| --- | --- |"
    printf "%s\n" "${summary_rows[@]}"
  } >>"$GITHUB_STEP_SUMMARY"
fi

if [ "${#failed_services[@]}" -gt 0 ]; then
  echo "::error::Deploy failed for: ${failed_services[*]}"
  exit 1
fi

echo "Triggered ${service_count} deploy(s)."
