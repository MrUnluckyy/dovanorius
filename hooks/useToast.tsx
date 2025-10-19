"use client";
import { useState } from "react";

export function useToast() {
  const [toasts, setToasts] = useState<
    { id: number; message: string; type?: string }[]
  >([]);

  const showToast = (message: string, type: string = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      3000
    );
  };

  const ToastContainer = () => (
    <div className="toast toast-center toast-top z-50">
      {toasts.map((t) => (
        <div key={t.id} className={`alert alert-${t.type}`}>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );

  return { showToast, ToastContainer };
}
