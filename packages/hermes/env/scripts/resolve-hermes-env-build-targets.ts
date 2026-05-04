/**
 * Hermes env codegen has two `env-to-t3` slices. Set `HERMES_ENV_BUILD_TARGETS` to
 * limit which files are regenerated (e.g. Docker images that only need `default`).
 */

/** Canonical order for a full `pnpm build`. */
export const HERMES_ENV_BUILD_TARGET_ORDER = [
  "default",
  "hermes.worker",
] as const;

/** A single codegen slice key (suffix after `build:` in package.json). */
export type HermesEnvBuildTargetKey =
  (typeof HERMES_ENV_BUILD_TARGET_ORDER)[number];

const ORDER_INDEX: Readonly<Record<HermesEnvBuildTargetKey, number>> = {
  default: 0,
  "hermes.worker": 1,
};

const KNOWN_SET = new Set<string>(HERMES_ENV_BUILD_TARGET_ORDER);

/**
 * Parses `HERMES_ENV_BUILD_TARGETS` and returns which codegen slices to run.
 *
 * @param raw - Value of `process.env.HERMES_ENV_BUILD_TARGETS` (may be undefined).
 * @returns Both targets when unset, empty, or `all`; otherwise the requested subset sorted to canonical order.
 * @throws When any comma-separated token is not a known target key.
 */
export const resolveHermesEnvBuildTargets = (
  raw: string | undefined,
): readonly HermesEnvBuildTargetKey[] => {
  const trimmed = raw?.trim();
  if (trimmed === undefined || trimmed === "" || trimmed === "all") {
    return HERMES_ENV_BUILD_TARGET_ORDER;
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
      `Unknown HERMES_ENV_BUILD_TARGETS: ${unknown.join(", ")}. Known keys: ${HERMES_ENV_BUILD_TARGET_ORDER.join(", ")}`,
    );
  }

  return (requested as HermesEnvBuildTargetKey[]).sort(
    (a, b) => ORDER_INDEX[a] - ORDER_INDEX[b],
  );
};
