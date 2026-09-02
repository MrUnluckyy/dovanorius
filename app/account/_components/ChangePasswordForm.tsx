"use client";

import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { ChangePasswordSchema } from "@/schemas/AccountSchemas";

type FormValues = z.infer<typeof ChangePasswordSchema>;

export function ChangePasswordForm({ email }: { email: string }) {
  const supabase = createClient();
  const t = useTranslations("Account");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(ChangePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    mode: "onSubmit",
  });

  const onSubmit = async (values: FormValues) => {
    // Prove they know the current one first. updateUser({ password }) acts on
    // the live session alone, so on its own it would let anyone with access to
    // an unlocked browser lock the real owner out.
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email,
      password: values.currentPassword,
    });

    if (reauthError) {
      setError("currentPassword", { message: "errorCurrentPasswordWrong" });
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: values.newPassword,
    });

    if (error) {
      console.error("Password change failed:", error);
      setError("root", { message: "errorGeneric" });
      return;
    }

    toast.success(t("passwordChangedToast"));
    reset();
  };

  const field = (
    name: keyof FormValues,
    label: string,
    autoComplete: string
  ) => (
    <div className="flex flex-col gap-1">
      <label className="label" htmlFor={name}>
        {t(label)}
      </label>
      <input
        id={name}
        type="password"
        autoComplete={autoComplete}
        className={`input w-full ${errors[name] ? "input-error" : ""}`}
        placeholder={t(label)}
        aria-invalid={!!errors[name] || undefined}
        {...register(name)}
      />
      {errors[name]?.message && (
        <p className="text-error text-sm" role="alert">
          {t(errors[name]!.message as string)}
        </p>
      )}
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <fieldset className="fieldset gap-3" disabled={isSubmitting}>
        {field("currentPassword", "currentPasswordLabel", "current-password")}
        {field("newPassword", "newPasswordLabel", "new-password")}
        {field("confirmPassword", "confirmPasswordLabel", "new-password")}

        {errors.root?.message && (
          <p className="text-error text-sm" role="alert">
            {t(errors.root.message)}
          </p>
        )}

        <button
          type="submit"
          className="btn btn-neutral mt-2 self-start"
          data-busy={isSubmitting || undefined}
        >
          {t("ctaChangePassword")}
        </button>
      </fieldset>
    </form>
  );
}
