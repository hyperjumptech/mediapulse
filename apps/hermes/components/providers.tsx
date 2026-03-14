"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

const Providers = ({ children }: { children: React.ReactNode }) => (
  <NextThemesProvider
    attribute="class"
    defaultTheme="system"
    enableSystem
    enableColorScheme
    disableTransitionOnChange
  >
    {children}
  </NextThemesProvider>
);

export { Providers };
