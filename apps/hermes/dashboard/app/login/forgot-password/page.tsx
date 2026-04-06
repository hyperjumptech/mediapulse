import { ForgotPasswordForm } from "./forgot-password-form";

const Page = () => {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden flex-col bg-muted p-10 lg:flex">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-muted to-muted-foreground/10" />
        <div className="relative z-20 flex items-center gap-2 font-semibold">
          <span>Hermes</span>
        </div>
      </div>
      <div className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-xs">
          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  );
};

export default Page;
