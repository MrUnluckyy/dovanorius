// app/GtmPageView.tsx
"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function GtmPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "page_view",
      page_path:
        pathname + (searchParams?.toString() ? `?${searchParams}` : ""),
    });
  }, [pathname, searchParams]);

  return null;
}
