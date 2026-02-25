"use client";

import { useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormAction } from "./action/.generated/use-form-action";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import Image from "next/image";
import { Card, CardContent } from "@workspace/ui/components/card";

export function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-black">
      <AuthLeftPanel />

      <div className="relative flex items-center justify-center p-6 lg:p-12 bg-black">
        <div className="relative w-full max-w-md space-y-10">{children}</div>
      </div>
    </div>
  );
}

export function AuthLeftPanel() {
  return (
    <div className="relative hidden lg:flex flex-col justify-between p-14 text-white overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#2A2A2E] via-[#1F1F23] to-[#141417]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.05),transparent_60%)]" />
      <div className="relative z-10">
        <div className="flex items-center gap-3 text-xl font-semibold tracking-tight">
          <div className="relative h-9 w-9">
            <Image
              src="/hyperjump-icon-only.png"
              alt="MediaPulse Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <span className="text-white">MediaPulse</span>
        </div>

        <div className="mt-24 max-w-sm text-gray-300 leading-relaxed text-base">
          Never miss what matters. Personalized insights delivered daily — only
          the news that impacts your business.
        </div>
      </div>

      <div className="relative z-10 text-sm text-gray-400">
        Copyright © {new Date().getFullYear()} PT Artha Rajamas Mandiri. All
        rights reserved.
      </div>
    </div>
  );
}

export function LoginCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="rounded-3xl border border-neutral-800 bg-[#111111] shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
      <CardContent className="p-10 text-white">{children}</CardContent>
    </Card>
  );
}

function LoginFormFields({
  errorMessage,
  pending,
}: {
  errorMessage: string | null;
  pending: boolean;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="body.email" className="text-white font-medium">
          Email
        </Label>

        <Input
          id="body.email"
          name="body.email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="h-11 rounded-xl border border-white text-white placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-[#1169EE] focus-visible:border-[#1169EE] focus-visible:ring-offset-0 transition-all duration-200"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="body.password" className="text-white font-medium">
          Password
        </Label>

        <Input
          id="body.password"
          name="body.password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Your super secret password"
          className="h-11 rounded-xl border border-white text-white placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-[#1169EE] focus-visible:border-[#1169EE] focus-visible:ring-offset-0 transition-all duration-200"
        />
      </div>
      {errorMessage && (
        <div className="text-sm font-medium text-red-600" role="alert">
          {errorMessage}
        </div>
      )}

      <Button
        type="submit"
        disabled={pending}
        className="w-full cursor-pointer h-11 rounded-xl bg-[#1169EE] hover:bg-[#0D54BF] text-white font-medium transition-all duration-200 shadow-md shadow-[#70A5F5]/30"
      >
        {pending ? "Signing in..." : "Sign in"}
      </Button>
    </>
  );
}

export function LoginForm() {
  const { FormWithAction, state, pending } = useFormAction();
  const { login } = useAuth();
  const router = useRouter();

  const { errorMessage, data } = useMemo(() => {
    if (!state) return { errorMessage: null, data: null };

    return {
      errorMessage: state.status === false ? state.message : null,
      data: state.status === true ? state.data : null,
    };
  }, [state]);

  useEffect(() => {
    if (data) {
      login({
        id: data.id,
        name: data.name,
        email: data.email,
      });
      router.push("/dashboard");
    }
  }, [data, login, router]);
  return (
    <LoginLayout>
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          Sign in to your account
        </h1>
        <p className="text-sm text-gray-300">Continue where you left off.</p>
      </div>

      <LoginCard>
        <FormWithAction className="space-y-7">
          <LoginFormFields errorMessage={errorMessage} pending={pending} />
        </FormWithAction>
      </LoginCard>
    </LoginLayout>
  );
}
