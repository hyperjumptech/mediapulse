import { AuthPageShell } from "@/components/auth-page-shell";

import { LoginForm } from "./login-form";

const Page = () => {
  return (
    <AuthPageShell
      title="Welcome back"
      description="Enter your admin email and password to log in."
      footer="Swiftly carrying messages between worlds."
    >
      <LoginForm />
    </AuthPageShell>
  );
};

export default Page;
