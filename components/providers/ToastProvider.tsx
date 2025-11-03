// providers/ToastProvider.tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Toast, ToastInput, ToastVariant } from "@/types/toast";

type Ctx = {
  toast: (t: ToastInput) => string;
  dismiss: (id: string) => void;
  toastSuccess: (msg: string | ToastInput) => string;
  toastError: (msg: string | ToastInput) => string;
  toastWarning: (msg: string | ToastInput) => string;
  toastInfo: (msg: string | ToastInput) => string;
  toasts: Toast[];
};

const ToastCtx = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, number>>({});

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const tm = timers.current[id];
    if (tm) {
      window.clearTimeout(tm);
      delete timers.current[id];
    }
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      const id = crypto.randomUUID();
      const t: Toast = {
        id,
        duration: 3000,
        variant: "info",
        ...input,
      };
      setToasts((prev) => [t, ...prev]); // newest on top

      if (t.duration && t.duration > 0) {
        timers.current[id] = window.setTimeout(() => dismiss(id), t.duration);
      }
      return id;
    },
    [dismiss]
  );

  const withVariant = useCallback(
    (variant: ToastVariant) => (msg: string | ToastInput) =>
      push(
        typeof msg === "string"
          ? { description: msg, variant }
          : { ...msg, variant }
      ),
    [push]
  );

  const value = useMemo<Ctx>(
    () => ({
      toast: push,
      dismiss,
      toastSuccess: withVariant("success"),
      toastError: withVariant("error"),
      toastWarning: withVariant("warning"),
      toastInfo: withVariant("info"),
      toasts,
    }),
    [push, dismiss, withVariant, toasts]
  );

  function variantClasses(v: string | undefined) {
    switch (v) {
      case "success":
        return "alert-success";
      case "error":
        return "alert-error";
      case "warning":
        return "alert-warning";
      default:
        return "alert-info";
    }
  }

  function ToastViewportInner({
    toast,
    onClose,
  }: {
    toast: Toast;
    onClose: (id: string) => void;
  }) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`alert ${variantClasses(toast.variant)} shadow`}
      >
        <div className="flex flex-col gap-1">
          {toast.title && <span className="font-semibold">{toast.title}</span>}
          {toast.description && <span>{toast.description}</span>}
          {toast.action && (
            <button
              className="btn btn-sm btn-ghost mt-1 w-fit"
              onClick={() => {
                toast.action?.onClick();
                onClose(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          className="btn btn-sm btn-ghost ml-2"
          aria-label="Dismiss"
          onClick={() => onClose(toast.id)}
        >
          ✕
        </button>
      </div>
    );
  }

  function ToastViewport() {
    const { toasts, dismiss } = useToast();
    return (
      <div className="toast toast-top toast-end z-[9999]">
        {toasts.map((t) => (
          <ToastViewportInner key={t.id} toast={t} onClose={dismiss} />
        ))}
      </div>
    );
  }

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <ToastViewport />
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider />");
  return ctx;
}
