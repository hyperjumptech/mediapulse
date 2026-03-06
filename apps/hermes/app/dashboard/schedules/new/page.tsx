import { redirect } from "next/navigation";

import { withAuthProtection } from "@/components/with-auth-protection";

/**
 * Redirects /dashboard/schedules/new to the schedules list.
 * Create schedule is now done via modal on the list page.
 */
const NewScheduleRedirect = () => {
  redirect("/dashboard/schedules");
};

export default withAuthProtection(NewScheduleRedirect);
