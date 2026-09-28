"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

import { TooltipProvider } from "@workspace/ui/components/tooltip";

import { TimeZoneCookieSync } from "@/components/date-time/time-zone-cookie-sync";

const Providers = ({ children }: { children: React.ReactNode }) => (
  <NextThemesProvider
    attribute="class"
    defaultTheme="system"
    enableSystem
    enableColorScheme
    disableTransitionOnChange
  >
    <TooltipProvider>
      <TimeZoneCookieSync />
      {children}
    </TooltipProvider>
  </NextThemesProvider>
);

export { Providers };
