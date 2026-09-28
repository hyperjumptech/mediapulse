import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { formatHermesToolError } from "./format-tool-result.js";
import type { HermesHttpClient } from "./http-client.js";
import type { HermesMcpProfile } from "./profiles.js";

export const WHOAMI_PATH = "/api/mcp/whoami";

export const WHOAMI_CACHE_TTL_MILLISECONDS = 5 * 60 * 1000;

const READ_ONLY_KEY_MESSAGE =
  "Read-only API key cannot call mutation tools. Create a full-access key in Hermes under API keys.";

export type HermesWhoamiSnapshot = {
  readOnly: boolean;
};

export type WhoamiCache = {
  read: (profileKey: string) => HermesWhoamiSnapshot | undefined;
  write: (profileKey: string, snapshot: HermesWhoamiSnapshot) => void;
  clear: () => void;
};

export type CreateWhoamiCacheOptions = {
  now?: () => number;
  ttlMilliseconds?: number;
};

type WhoamiCacheEntry = {
  profileKey: string;
  snapshot: HermesWhoamiSnapshot;
  expiresAt: number;
};

export const createWhoamiCache = ({
  now = Date.now,
  ttlMilliseconds = WHOAMI_CACHE_TTL_MILLISECONDS,
}: CreateWhoamiCacheOptions = {}): WhoamiCache => {
  let entry: WhoamiCacheEntry | undefined;

  return {
    read: (profileKey) => {
      if (!entry) {
        return undefined;
      }
      if (entry.profileKey !== profileKey || entry.expiresAt <= now()) {
        entry = undefined;

        return undefined;
      }

      return entry.snapshot;
    },
    write: (profileKey, snapshot) => {
      entry = { profileKey, snapshot, expiresAt: now() + ttlMilliseconds };
    },
    clear: () => {
      entry = undefined;
    },
  };
};

export const buildProfileCacheKey = (profile: HermesMcpProfile): string =>
  `${profile.name}\n${profile.baseUrl}`;

const isAuthorizationFailureStatus = (status: number): boolean =>
  status === 401 || status === 403;

export const withWhoamiCacheInvalidation = (
  httpClient: HermesHttpClient,
  whoamiCache: WhoamiCache,
): HermesHttpClient => ({
  request: async (request) => {
    const response = await httpClient.request(request);
    if (isAuthorizationFailureStatus(response.status)) {
      whoamiCache.clear();
    }

    return response;
  },
});

export const parseWhoamiReadOnly = (body: unknown): boolean | null => {
  if (typeof body !== "object" || body === null || !("readOnly" in body)) {
    return null;
  }

  return Boolean((body as { readOnly: unknown }).readOnly);
};

export const isReadOnlyKeyHttpResponse = (
  status: number,
  body: unknown,
): boolean => {
  if (status !== 403 || typeof body !== "object" || body === null) {
    return false;
  }
  const record = body as { code?: unknown };

  return record.code === "read_only_key";
};

export type MutationAccessResult = { allowed: true } | CallToolResult;

export type AssertMutationAllowedDependencies = {
  httpClient: HermesHttpClient;
  whoamiCache?: WhoamiCache;
  profileKey?: string;
};

const accessFromSnapshot = (
  snapshot: HermesWhoamiSnapshot,
): MutationAccessResult =>
  snapshot.readOnly
    ? formatHermesToolError(READ_ONLY_KEY_MESSAGE)
    : { allowed: true };

export const assertMutationAllowed = async ({
  httpClient,
  whoamiCache,
  profileKey,
}: AssertMutationAllowedDependencies): Promise<MutationAccessResult> => {
  const cachedSnapshot =
    profileKey === undefined ? undefined : whoamiCache?.read(profileKey);
  if (cachedSnapshot) {
    return accessFromSnapshot(cachedSnapshot);
  }

  const whoami = await httpClient.request({ method: "GET", path: WHOAMI_PATH });

  if (isReadOnlyKeyHttpResponse(whoami.status, whoami.body)) {
    whoamiCache?.clear();

    return formatHermesToolError(READ_ONLY_KEY_MESSAGE);
  }

  if (isAuthorizationFailureStatus(whoami.status)) {
    whoamiCache?.clear();

    return formatHermesToolError(
      "API key rejected by Hermes. Check the profile API key and base URL.",
      whoami.body,
    );
  }

  if (whoami.status < 200 || whoami.status >= 300) {
    return formatHermesToolError(
      `whoami failed with HTTP ${whoami.status}`,
      whoami.body,
    );
  }

  const readOnly = parseWhoamiReadOnly(whoami.body);
  if (readOnly === null) {
    return { allowed: true };
  }

  const snapshot: HermesWhoamiSnapshot = { readOnly };
  if (profileKey !== undefined) {
    whoamiCache?.write(profileKey, snapshot);
  }

  return accessFromSnapshot(snapshot);
};
