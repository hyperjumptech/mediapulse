import { redirect } from "next/navigation";

/**
 * Legacy edit URL: edit is now done in a modal on the agents list. Redirect to list.
 */
const AgentEditRedirect = async (_props: {
  params: Promise<{ id: string }>;
}) => {
  redirect("/dashboard/agents");
};

export default AgentEditRedirect;
