/**
 * Hosts whose articles are written by readers rather than by an editorial desk.
 *
 * Matched against the URL, so a subdomain (`someone.blogspot.com`) and a country domain
 * (`blogspot.co.id`) both count.
 */
const USER_GENERATED_HOSTS = [
  "kompasiana\\.com",
  "medium\\.com",
  "blogspot\\.",
  "wordpress\\.com",
  "substack\\.com",
  "linkedin\\.com/pulse",
  "reddit\\.com",
  "quora\\.com",
  "kaskus\\.co\\.id",
  "tumblr\\.com",
  "vocal\\.media",
  "hubpages\\.com",
  "steemit\\.com",
  "seekingalpha\\.com/instablog",
];

const USER_GENERATED_HOST = new RegExp(
  `(?:^|//|\\.)(?:${USER_GENERATED_HOSTS.join("|")})`,
  "i",
);

/**
 * Reports whether the URL is hosted on a user-generated publishing platform.
 *
 * @param url - Article URL.
 * @returns True when the host publishes reader-contributed posts rather than edited reporting.
 */
export const isUserGeneratedHost = (url: string | null | undefined): boolean =>
  typeof url === "string" && USER_GENERATED_HOST.test(url);
