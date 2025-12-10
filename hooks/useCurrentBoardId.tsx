// hooks/useCurrentBoardId.ts
"use client";

import { useParams } from "next/navigation";

export function useCurrentBoardId(): string | null {
  const params = useParams();
  const raw = (params as any)?.boardId;
  if (!raw) return null;

  console.log("raw boardId:", raw);
  return Array.isArray(raw) ? raw[0] : raw;
}
