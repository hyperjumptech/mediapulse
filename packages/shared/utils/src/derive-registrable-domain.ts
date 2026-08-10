import { getDomain } from "tldts";

export const deriveRegistrableDomain = (url: string): string =>
  getDomain(url) ?? "";
