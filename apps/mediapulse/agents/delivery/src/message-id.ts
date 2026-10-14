const senderDomain = (fromAddress: string): string => {
  const match = /@([^>\s]+)/.exec(fromAddress);

  return match?.[1] ?? "mediapulse";
};

export const buildNewsletterMessageId = (
  newsletterId: string,
  userTickerId: string,
  fromAddress: string,
): string =>
  `<nl.${newsletterId}.${userTickerId}@${senderDomain(fromAddress)}>`;

export const buildDay1WelcomeMessageId = (
  dispatchId: string,
  userTickerId: string,
  fromAddress: string,
): string => `<d1w.${dispatchId}.${userTickerId}@${senderDomain(fromAddress)}>`;
