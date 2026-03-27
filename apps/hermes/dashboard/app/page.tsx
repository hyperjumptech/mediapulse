import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Root URL has no Hermes landing page. Unauthenticated users go to login;
 * users with a session cookie go to the dashboard (layout still enforces admin).
 */
export default async function Page() {
  const jar = await cookies();
  const token = jar.get("auth-token")?.value?.trim();
  redirect(token ? "/dashboard" : "/login");
}
