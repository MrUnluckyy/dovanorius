"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { ReactNode, useState } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    // <ThemeProvider
    //   attribute="data-theme" // <- puts data-theme on <html>
    //   defaultTheme="noriuto" // or "system"
    //   enableSystem
    //   storageKey="theme" // localStorage key
    // >
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
    // </ThemeProvider>
  );
}
