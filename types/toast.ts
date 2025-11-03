// lib/toast/types.ts
export type ToastVariant = "success" | "error" | "warning" | "info";

export type Toast = {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number; // ms (default 3000)
  action?: { label: string; onClick: () => void };
};

export type ToastInput = Omit<Toast, "id">;
