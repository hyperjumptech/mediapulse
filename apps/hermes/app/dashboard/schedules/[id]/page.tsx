import { redirect } from "next/navigation";

import { withAuthProtection } from "@/components/with-auth-protection";

/**
 * Redirects /dashboard/schedules/[id] to the schedules list.
 * Edit schedule is now done via modal on the list page.
 */
const ScheduleEditRedirect = () => {
  redirect("/dashboard/schedules");
};

export default withAuthProtection(ScheduleEditRedirect);
