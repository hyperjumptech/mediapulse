"use client";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@workspace/ui/components/button";
import { LogOut, User } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-[#0F1115] text-white">
      <header className="bg-gradient-to-r from-black via-[#111827] to-black border-b border-white/10 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/5 rounded-xl border border-white/10">
                <Image
                  src="/hyperjump-icon-only.png"
                  alt="Hyperjump Logo"
                  width={28}
                  height={28}
                  className="object-contain"
                />
              </div>
              <div className="leading-tight block">
                <h1 className="text-lg font-semibold tracking-tight">
                  MediaPulse
                </h1>
                <p className="text-xs text-white/50">AI Newsletter Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                <div className="p-2 bg-white/10 rounded-lg">
                  <User className="h-4 w-4 text-white/80" />
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-white/50">{user?.email}</p>
                </div>
              </div>

              <Button
                onClick={handleLogout}
                size="sm"
                className="bg-white text-black hover:bg-white/90 rounded-lg px-4"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-2xl p-8 backdrop-blur-xl">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3">
            Welcome back, {user?.name}
          </h2>

          <p className="text-white/60 max-w-xl">
            Manage your AI-powered newsletter, track performance metrics, and
            orchestrate content workflows from one command center.
          </p>
        </div>
      </main>
    </div>
  );
}
