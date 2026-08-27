import z from "zod";

/** Same rules as registration and reset — one password policy, three forms. */
const password = z
  .string()
  .min(6, "errorPasswordTooShort")
  .max(50, "errorPasswordTooLong");

export const ChangeEmailSchema = z.object({
  email: z.email("errorInvalidEmail"),
});

export const ChangePasswordSchema = z
  .object({
    // Re-authentication, not decoration: Supabase's updateUser({ password })
    // will happily act on any live session, so without this anyone who walked
    // up to an unlocked browser could take the account.
    currentPassword: z.string().min(1, "errorCurrentPasswordRequired"),
    newPassword: password,
    confirmPassword: z.string().min(1, "errorConfirmPasswordRequired"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "errorPasswordsDoNotMatch",
    path: ["confirmPassword"],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "errorPasswordUnchanged",
    path: ["newPassword"],
  });
