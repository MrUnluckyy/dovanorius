import { createClient } from "@/utils/supabase/admin";
import { Resend } from "resend";
import { ConfirmEmail } from "@/emails/ConfirmEmail";
import { ResetPasswordEmail } from "@/emails/ResetPassword";

const resend = new Resend(process.env.RESEND_API_KEY);

// MOVE TO AUTH ACTIONS LATER

export async function signUp(
  email: string,
  password: string,
  displayName: string
) {
  const supabase = await createClient();

  // 1. Create user in Supabase
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: false, // we will confirm via link
    user_metadata: {
      display_name: displayName,
    },
  });

  if (error || !data?.user) {
    console.error("Error creating user:", error);
    throw new Error("Nepavyko sukurti paskyros.");
  }
  console.log("👨 User has been created");

  // 2. Generate confirmation link
  const { data: linkData, error: linkError } =
    await supabase.auth.admin.generateLink({
      type: "signup",
      email,
      password,
      options: {
        data: { display_name: displayName },
        redirectTo: `${process.env.NEXT_PUBLIC_WEB_URL}/api/auth/callback`,
      },
    });

  console.log("👨 Generated signup link data:", linkData);

  if (linkError || !linkData?.properties?.action_link) {
    console.error("Error generating signup link:", linkError);
    throw new Error("Nepavyko sugeneruoti patvirtinimo nuorodos.");
  }

  const confirmUrl = linkData.properties.action_link;

  // 3. Send via Resend (React Email)
  await resend.emails.send({
    from: "Noriuto <neatsakyti@noriuto.lt>", // ✅ correct format
    to: email,
    subject: "Patvirtinkite savo el. pašto adresą",
    react: ConfirmEmail({ url: confirmUrl }),
  });

  return { success: true, userId: data.user.id };
}

export async function recoverPassword(email: string) {
  "use server";
  const supabase = await createClient();

  const { data: linkData, error: linkError } =
    await supabase.auth.admin.generateLink({
      type: "recovery",
      email: email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_WEB_URL}/reset-password`,
      },
    });

  if (linkError || !linkData?.properties?.action_link) {
    console.error("Failed to generate recovery link", linkError);
    throw new Error("Nepavyko sugeneruoti slaptažodžio atstatymo nuorodos.");
  }

  const recoverUrl = linkData.properties.action_link;

  await resend.emails.send({
    from: "Noriuto <neatsakyti@noriuto.lt>",
    to: email,
    subject: "Atstatykite savo slaptažodį",
    react: ResetPasswordEmail({ url: recoverUrl }),
  });

  return { success: true };
}
