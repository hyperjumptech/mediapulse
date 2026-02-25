"use client";

import { useAuth } from "@/components/auth-provider";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}
