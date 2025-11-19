"use client";

import { useTranslations } from "next-intl";
import React, {
  createContext,
  useCallback,
  useContext,
  useState,
  ReactNode,
} from "react";

type ConfirmOptions = {
  title?: string;
  message?: string | ReactNode;
  confirmText?: string;
  cancelText?: string;
};

type ConfirmContextValue = (options?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within ConfirmDialogProvider");
  }
  return ctx;
}

type Props = {
  children: ReactNode;
};

export function ConfirmDialogProvider({ children }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({});
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(
    null
  );
  const t = useTranslations("Actions");

  const confirm = useCallback((opts?: ConfirmOptions) => {
    setOptions(opts || {});
    setIsOpen(true);

    return new Promise<boolean>((resolve) => {
      setResolver(() => resolve);
    });
  }, []);

  const handleClose = (value: boolean) => {
    setIsOpen(false);
    if (resolver) {
      resolver(value);
      setResolver(null);
    }
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {isOpen && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">
              {options.title ?? "Ar tikrai?"}
            </h3>
            <p className="py-4">
              {options.message ?? "This action cannot be undone."}
            </p>
            <div className="modal-action">
              <button
                className="btn"
                type="button"
                onClick={() => handleClose(false)}
              >
                {options.cancelText ?? t("cancel")}
              </button>
              <button
                className="btn btn-error"
                type="button"
                onClick={() => handleClose(true)}
              >
                {options.confirmText ?? t("delete")}
              </button>
            </div>
          </div>
          {/* backdrop */}
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={() => handleClose(false)}>
              {t("close")}
            </button>
          </form>
        </dialog>
      )}
    </ConfirmContext.Provider>
  );
}
