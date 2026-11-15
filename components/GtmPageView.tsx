// app/GtmPageView.tsx
"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { redactSecrets } from "@/lib/analyticsRedact";

export function GtmPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "page_view",
      page_path: redactSecrets(
        pathname + (searchParams?.toString() ? `?${searchParams}` : "")
      ),
    });
  }, [pathname, searchParams]);

  return null;
}
