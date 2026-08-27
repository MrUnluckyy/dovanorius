import z from "zod";

/**
 * Same password rules as registration, deliberately: a rule the sign-up form
 * enforces but the reset form does not is a rule that does not exist. The
 * message strings are Auth translation keys, resolved by the form.
 */
export const ResetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(6, "errorPasswordTooShort")
      .max(50, "errorPasswordTooLong"),
    confirmPassword: z.string().min(1, "errorConfirmPasswordRequired"),
  })
  .refine((vals) => vals.password === vals.confirmPassword, {
    message: "errorPasswordsDoNotMatch",
    path: ["confirmPassword"],
  });
