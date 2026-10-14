import { createUnsubscribeToken } from "@workspace/utils";

export type UnsubscribeSettings = {
  baseUrl: string;
  secret: string;
};

export type UnsubscribeLinks = {
  unsubscribeUrl: string;
  oneClickUnsubscribeUrl: string;
};

export const buildUnsubscribeLinks = ({
  userTickerId,
  tickerSymbol,
  language,
  settings,
}: {
  userTickerId: string;
  tickerSymbol: string;
  language: "en" | "id";
  settings: UnsubscribeSettings;
}): UnsubscribeLinks => {
  const token = createUnsubscribeToken({
    userTickerId,
    tickerSymbol,
    secret: settings.secret,
  });
  const baseUrl = settings.baseUrl.replace(/\/$/, "");

  return {
    unsubscribeUrl: `${baseUrl}/unsubscribe?token=${token}&lang=${language}`,
    oneClickUnsubscribeUrl: `${baseUrl}/api/unsubscribe?token=${token}`,
  };
};
