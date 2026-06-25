/** Supported client platforms for mail-app option labels. */
export type MailPlatform = "macos" | "windows" | "other";

/**
 * Returns whether the user agent belongs to an iOS device (iPhone, iPad, or iPod).
 *
 * @param userAgent - Browser user agent string.
 * @returns True when the client is iOS Safari or another iOS browser.
 */
export const detectIsIosUserAgent = (userAgent: string): boolean =>
  /iPhone|iPad|iPod/i.test(userAgent);

/**
 * Returns whether the user agent belongs to macOS desktop (not iOS).
 *
 * @param userAgent - Browser user agent string.
 * @returns True when the client is macOS Safari, Chrome, or another desktop browser.
 */
export const detectIsMacOsUserAgent = (userAgent: string): boolean =>
  /Macintosh|Mac OS X/i.test(userAgent) && !detectIsIosUserAgent(userAgent);

/**
 * Detects the user's platform from the browser user agent for mail-app labels.
 *
 * @param userAgent - Browser user agent string.
 * @returns Platform bucket used to choose mail-app options.
 */
export const detectMailPlatform = (userAgent: string): MailPlatform => {
  if (/Macintosh|Mac OS X|iPhone|iPad|iPod/i.test(userAgent)) {
    return "macos";
  }
  if (/Windows/i.test(userAgent)) {
    return "windows";
  }
  return "other";
};

export type MailAppChoiceOption = {
  id: "outlook" | "native-mail" | "other";
  title: string;
  description: string;
};

/**
 * Returns platform-aware mail-app choices for the subscribe modal.
 *
 * @param platform - Detected client platform.
 * @returns Ordered list of mail-app options.
 */
export const getMailAppChoiceOptions = (
  platform: MailPlatform,
): MailAppChoiceOption[] => {
  const outlook: MailAppChoiceOption = {
    id: "outlook",
    title: "Microsoft Outlook",
    description:
      platform === "macos"
        ? "Opens a draft in Outlook. Set Outlook as your default mail app if Mail opens instead."
        : "Opens a draft in Outlook. Make sure Outlook is installed.",
  };

  const other: MailAppChoiceOption = {
    id: "other",
    title: "Other",
    description:
      "MediaPulse will email you a confirmation link to finish subscribing.",
  };

  if (platform === "macos") {
    return [
      outlook,
      {
        id: "native-mail",
        title: "Apple Mail",
        description: "Opens a draft in Mail. Make sure Mail is installed.",
      },
      other,
    ];
  }

  if (platform === "windows") {
    return [
      outlook,
      {
        id: "native-mail",
        title: "Windows Mail",
        description:
          "Opens your default mail app. Make sure a mail app is installed.",
      },
      other,
    ];
  }

  return [
    outlook,
    {
      id: "native-mail",
      title: "Default mail app",
      description:
        "Opens your default mail app. Make sure a mail app is installed.",
    },
    other,
  ];
};
