/**
 * Mediapulse env codegen runs multiple `env-to-t3` slices. Docker and Turbo can
 * set `MEDIAPULSE_ENV_BUILD_TARGETS` to a comma-separated subset so unrelated
 * agents are not regenerated on every image build.
 */

/** Canonical order for a full `pnpm build` (matches historical concurrently order). */
export const MEDIAPULSE_ENV_BUILD_TARGET_ORDER = [
  "default",
  "agents.data-collection",
  "agents.content-generation",
  "agents.delivery",
  "agents.query-analysis",
  "agents.article-analysis",
  "agents.ticker-echo",
  "agents.user-registration",
  "app.user-registration",
  "agents.page-collection",
] as const;

/** A single codegen slice key (suffix after `build:` in package.json). */
export type MediapulseEnvBuildTargetKey =
  (typeof MEDIAPULSE_ENV_BUILD_TARGET_ORDER)[number];

const ORDER_INDEX: Readonly<Record<MediapulseEnvBuildTargetKey, number>> =
  Object.fromEntries(
    MEDIAPULSE_ENV_BUILD_TARGET_ORDER.map((key, index) => [key, index]),
  ) as Readonly<Record<MediapulseEnvBuildTargetKey, number>>;

const KNOWN_SET = new Set<string>(MEDIAPULSE_ENV_BUILD_TARGET_ORDER);

/**
 * Parses `MEDIAPULSE_ENV_BUILD_TARGETS` and returns which codegen slices to run.
 *
 * @param raw - Value of `process.env.MEDIAPULSE_ENV_BUILD_TARGETS` (may be undefined).
 * @returns All targets in canonical order when unset, empty, or `all`; otherwise the requested subset sorted to canonical order.
 * @throws When any comma-separated token is not a known target key.
 */
export const resolveMediapulseEnvBuildTargets = (
  raw: string | undefined,
): readonly MediapulseEnvBuildTargetKey[] => {
  const trimmed = raw?.trim();
  if (trimmed === undefined || trimmed === "" || trimmed === "all") {
    return MEDIAPULSE_ENV_BUILD_TARGET_ORDER;
  }

  const requested = [
    ...new Set(
      trimmed
        .split(",")
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0),
    ),
  ];

  const unknown = requested.filter((key) => !KNOWN_SET.has(key));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown MEDIAPULSE_ENV_BUILD_TARGETS: ${unknown.join(", ")}. Known keys: ${MEDIAPULSE_ENV_BUILD_TARGET_ORDER.join(", ")}`,
    );
  }

  return (requested as MediapulseEnvBuildTargetKey[]).sort(
    (a, b) => ORDER_INDEX[a] - ORDER_INDEX[b],
  );
};
