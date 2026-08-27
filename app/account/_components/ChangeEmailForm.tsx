"use client";

import { createClient } from "@/utils/supabase/client";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { LuMailCheck } from "react-icons/lu";
import { ChangeEmailSchema } from "@/schemas/AccountSchemas";

type FormValues = z.infer<typeof ChangeEmailSchema>;

export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const supabase = createClient();
  const t = useTranslations("Account");
  const locale = useLocale();
  const [pendingAddress, setPendingAddress] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(ChangeEmailSchema),
    defaultValues: { email: "" },
    mode: "onSubmit",
  });

  const onSubmit = async ({ email }: FormValues) => {
    const next = email.trim().toLowerCase();

    if (next === currentEmail.toLowerCase()) {
      setError("email", { message: "errorEmailUnchanged" });
      return;
    }

    // Carries the locale so the confirmation lands in the language they are
    // reading right now, not whatever they signed up in.
    const { error } = await supabase.auth.updateUser({
      email: next,
      data: { locale },
    });

    if (error) {
      console.error("Email change failed:", error);
      setError("email", {
        message:
          error.code === "email_exists" ||
          /already been registered|already registered/i.test(error.message)
            ? "errorEmailTaken"
            : "errorGeneric",
      });
      return;
    }

    setPendingAddress(next);
    reset({ email: "" });
  };

  if (pendingAddress) {
    return (
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--nr-tile) text-(--nr-gold-strong)"
        >
          <LuMailCheck size={20} />
        </span>
        <div>
          <p className="font-semibold">{t("emailPendingTitle")}</p>
          <p className="mt-1 text-sm text-base-content/70">
            {t("emailPendingBody", { email: pendingAddress })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <fieldset className="fieldset gap-3" disabled={isSubmitting}>
        <div className="flex flex-col gap-1">
          <label className="label" htmlFor="current-email">
            {t("currentEmailLabel")}
          </label>
          <input
            id="current-email"
            type="email"
            className="input w-full"
            value={currentEmail}
            disabled
            readOnly
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="label" htmlFor="new-email">
            {t("newEmailLabel")}
          </label>
          <input
            id="new-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            className={`input w-full ${errors.email ? "input-error" : ""}`}
            placeholder={t("newEmailPlaceholder")}
            aria-invalid={!!errors.email || undefined}
            {...register("email")}
          />
          {errors.email?.message && (
            <p className="text-error text-sm" role="alert">
              {t(errors.email.message)}
            </p>
          )}
        </div>

        {/* Supabase's secure email change writes to BOTH addresses, and the
            change only lands once both are confirmed. People who miss the
            second one think it silently failed. */}
        <p className="text-sm text-base-content/60">{t("emailChangeNote")}</p>

        <button type="submit" className="btn btn-neutral mt-2 self-start">
          {isSubmitting ? (
            <span className="loading loading-dots loading-md" />
          ) : (
            t("ctaChangeEmail")
          )}
        </button>
      </fieldset>
    </form>
  );
}
