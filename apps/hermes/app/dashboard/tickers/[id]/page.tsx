import { redirect } from "next/navigation";

import { withAuthProtection } from "@/components/with-auth-protection";

/**
 * Ticker edit is handled in a modal on the tickers list page.
 * Redirect /dashboard/tickers/[id] to the list so old links still work.
 */
const TickerEditRedirectPage = async () => {
  redirect("/dashboard/tickers");
};

export default withAuthProtection(TickerEditRedirectPage);
