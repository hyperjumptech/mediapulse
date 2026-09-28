import { AuthPageShell } from "@/components/auth-page-shell";

import { ForgotPasswordForm } from "./forgot-password-form";

const Page = () => {
  return (
    <AuthPageShell
      title="Forgot password"
      description="Enter your admin email. If an account exists, you will receive a reset link."
    >
      <ForgotPasswordForm />
    </AuthPageShell>
  );
};

export default Page;
