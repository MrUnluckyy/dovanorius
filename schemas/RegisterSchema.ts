import z from "zod";

export const RegisterSchema = z
  .object({
    displayName: z.string().min(1, "errorDisplayNameRequired"),
    email: z.email("errorInvalidEmail"),
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
