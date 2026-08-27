"use client";
import { createClient } from "@/utils/supabase/client";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { FaGoogle } from "react-icons/fa6";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { RegisterSchema } from "@/schemas/RegisterSchema";

type FormValues = z.infer<typeof RegisterSchema>;

export function RegisterForm() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const supabase = createClient();
  const [completed, setCompleted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    mode: "onSubmit",
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: { display_name: values.displayName, locale },
          emailRedirectTo: `${process.env.NEXT_PUBLIC_WEB_URL}/api/auth/callback`,
        },
      });

      if (error) {
        // `errors.root.message` is rendered through t(), so it has to be a
        // translation KEY. Passing Supabase's raw English string here meant
        // next-intl was asked to look up a whole sentence as a key.
        console.error("Sign-up failed:", error);
        setError("root", {
          message:
            error.code === "user_already_exists" ||
            /already registered/i.test(error.message)
              ? "errorEmailTaken"
              : "errorGeneric",
        });
        toast.error(t("registerGenericErrorToast"));
        return;
      }

      toast.success(t("registerSuccessToast"));
      setCompleted(true);
    } catch (err) {
      console.error("Sign-up threw:", err);
      setError("root", { message: "errorGeneric" });
      toast.error(t("registerGenericErrorToast"));
    }
  };

  if (completed) {
    return (
      <div className="space-y-8">
        <h2 className="text-2xl font-semibold text-center">
          {t("registerCompleteTitle")}
        </h2>
        <p className="text-center">{t("registerCompleteBody")}</p>
        <Link href="/login" className="btn">
          {t("ctaDone")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-2xl font-semibold font-heading mb-6">
        {t("registerFormTitle")}
      </h2>
      <button
        className="btn btn-primary"
        type="button"
        disabled={isSubmitting}
        onClick={() =>
          supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo: `${process.env.NEXT_PUBLIC_WEB_URL}/api/auth/callback`,
            },
          })
        }
      >
        <FaGoogle />
        {t("registerWithGoogle")}
      </button>

      <div className="divider label">{t("or")}</div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <fieldset className="fieldset gap-3" disabled={isSubmitting}>
          <div className="flex flex-col gap-1">
            <label className="label" htmlFor="displayName">
              {t("displayNameLabel")}
            </label>
            <input
              id="displayName"
              type="text"
              className={`input w-full ${errors.displayName ? "input-error" : ""}`}
              placeholder={t("displayNameLabel")}
              {...register("displayName")}
            />
            {errors.displayName?.message && (
              <p className="text-error text-sm">
                {t(errors.displayName.message)}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="label" htmlFor="email">
              {t("emailLabel")}
            </label>
            <input
              id="email"
              type="email"
              className={`input w-full ${errors.email ? "input-error" : ""}`}
              placeholder={t("emailPlaceholder")}
              autoComplete="email"
              {...register("email")}
            />
            {errors.email?.message && (
              <p className="text-error text-sm">{t(errors.email.message)}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="label" htmlFor="password">
              {t("passwordLabel")}
            </label>
            <input
              id="password"
              type="password"
              className={`input w-full ${errors.password ? "input-error" : ""}`}
              placeholder={t("passwordLabel")}
              autoComplete="new-password"
              {...register("password")}
            />
            {errors.password?.message && (
              <p className="text-error text-sm">{t(errors.password.message)}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="flex flex-col gap-1">
            <label className="label" htmlFor="confirmPassword">
              {t("confirmPasswordLabel")}
            </label>
            <input
              id="confirmPassword"
              type="password"
              className={`input w-full ${errors.confirmPassword ? "input-error" : ""}`}
              placeholder={t("confirmPasswordLabel")}
              autoComplete="new-password"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword?.message && (
              <p className="text-error text-sm">
                {t(errors.confirmPassword.message)}
              </p>
            )}
          </div>

          {/* Form-level/server error */}
          {"root" in errors && errors.root?.message && (
            <p className="text-error text-sm">{t(errors.root.message)}</p>
          )}

          <div className="flex flex-col gap-1">
            <Link href="/forgot-password" className="link link-hover">
              {t("forgotPasswordLink")}
            </Link>

            <Link href="/login" className="link link-hover">
              {t("haveAccountLoginLink")}
            </Link>
          </div>

          <button
            type="submit"
            className="btn btn-neutral mt-4"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="loading loading-dots loading-md"></span>
            ) : (
              t("ctaRegister")
            )}
          </button>
        </fieldset>
      </form>
    </>
  );
}
