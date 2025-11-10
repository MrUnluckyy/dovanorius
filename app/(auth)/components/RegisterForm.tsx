"use client";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { FaGoogle } from "react-icons/fa6";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const schema = z
  .object({
    displayName: z.string().min(1, "Please enter your display name."),
    email: z.string().email("Please enter a valid email."),
    password: z
      .string()
      .min(6, "Password should be at least 6 characters.")
      .max(72, "Password is too long."),
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((vals) => vals.password === vals.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export function RegisterForm() {
  const t = useTranslations("Auth");
  const supabase = createClient();
  const [completed, setCompleted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
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
          data: { display_name: values.displayName },
          emailRedirectTo: `${process.env.NEXT_PUBLIC_WEB_URL}/api/auth/callback`,
        },
      });

      if (error) {
        // Surface Supabase error at form level
        setError("root", { message: error.message });
        toast.error("Opps, klaida registruojantis.");
        return;
      }

      toast.success("Registration successful! Check your email to verify.");
      setCompleted(true);
    } catch (err) {
      setError("root", {
        message: "An unexpected error occurred. Please try again.",
      });
      toast.error("Opps, klaida registruojantis.");
    }
  };

  if (completed) {
    return (
      <div className="space-y-8">
        <h2 className="text-2xl font-semibold text-center">All done! 👋</h2>
        <p className="text-center">
          Registration complete! Please check your email to verify your account.
        </p>
        <Link href="/login" className="btn">
          Done
        </Link>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-2xl font-semibold">Hey There! 👋</h2>

      <button
        className="btn btn-accent"
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

      <div className="divider">{t("or")}</div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <fieldset className="fieldset" disabled={isSubmitting}>
          {/* Display Name */}
          <label className="label" htmlFor="displayName">
            Display name
          </label>
          <input
            id="displayName"
            type="text"
            className={`input ${errors.displayName ? "input-error" : ""}`}
            placeholder="Your name"
            {...register("displayName")}
          />
          {errors.displayName && (
            <p className="text-error text-sm mt-1">
              {errors.displayName.message}
            </p>
          )}

          {/* Email */}
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className={`input ${errors.email ? "input-error" : ""}`}
            placeholder="Email"
            autoComplete="email"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-error text-sm mt-1">{errors.email.message}</p>
          )}

          {/* Password */}
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className={`input ${errors.password ? "input-error" : ""}`}
            placeholder="Password"
            autoComplete="new-password"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-error text-sm mt-1">{errors.password.message}</p>
          )}

          {/* Confirm Password */}
          <label className="label" htmlFor="confirmPassword">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            className={`input ${errors.confirmPassword ? "input-error" : ""}`}
            placeholder="Confirm password"
            autoComplete="new-password"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p className="text-error text-sm mt-1">
              {errors.confirmPassword.message}
            </p>
          )}

          {/* Form-level/server error */}
          {"root" in errors && errors.root?.message && (
            <p className="text-error text-sm mt-1">{errors.root.message}</p>
          )}

          <div>
            <a className="link link-hover">Forgot password?</a>
          </div>

          <Link href="/login" className="link link-hover">
            Already with us? Log in here.
          </Link>

          <button
            type="submit"
            className="btn btn-neutral mt-4"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Signing up..." : "Register"}
          </button>
        </fieldset>
      </form>
    </>
  );
}
