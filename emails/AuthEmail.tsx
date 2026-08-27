import { Text, Button, Section, Link } from "@react-email/components";
import { EmailLayout, EmailHeading } from "./_components/EmailLayout";
import { brand, buttonPrimary, text, textMuted } from "./_components/theme";

/**
 * Every email Supabase Auth would otherwise have sent for us.
 *
 * These used to be Supabase's stock templates: unbranded, English-only, and
 * signed by nobody. The repo did contain ConfirmEmail.tsx and ResetPassword.tsx,
 * but nothing ever imported them — they were written and never wired up, so no
 * user ever saw one.
 *
 * One component rather than five files: the shape is identical every time —
 * heading, a sentence of why, one button, one "ignore this if it wasn't you".
 * Only the words change, so only the words are parameterised.
 */

export type AuthEmailAction =
  | "signup"
  | "recovery"
  | "email_change"
  | "magiclink"
  | "invite";

export type AuthEmailLocale = "lt" | "en";

type Copy = {
  preview: string;
  heading: string;
  body: string;
  cta: string;
  /** Shown when the action was not requested by the reader. */
  ignore: string;
};

const COPY: Record<AuthEmailLocale, Record<AuthEmailAction, Copy>> = {
  lt: {
    signup: {
      preview: "Patvirtink savo el. pašto adresą",
      heading: "Sveikas atvykęs! 👋",
      body: "Dar vienas žingsnis — patvirtink savo el. pašto adresą ir paskyra bus paruošta.",
      cta: "Patvirtinti adresą",
      ignore: "Jei paskyros nekūrei, tiesiog ignoruok šį laišką.",
    },
    recovery: {
      preview: "Nuoroda naujam slaptažodžiui susikurti",
      heading: "Pamiršai slaptažodį?",
      body: "Paspausk mygtuką ir galėsi susikurti naują slaptažodį. Nuoroda galioja ribotą laiką.",
      cta: "Susikurti naują slaptažodį",
      ignore:
        "Jei slaptažodžio keisti neprašei, ignoruok šį laišką — jis nieko nepakeis.",
    },
    email_change: {
      preview: "Patvirtink naują el. pašto adresą",
      heading: "Naujas el. pašto adresas",
      body: "Gavome prašymą pakeisti tavo paskyros el. pašto adresą. Patvirtink, kad adresas tavo.",
      cta: "Patvirtinti adresą",
      ignore:
        "Jei adreso keisti neprašei, ignoruok šį laišką ir nedelsdamas pasikeisk slaptažodį.",
    },
    magiclink: {
      preview: "Tavo prisijungimo nuoroda",
      heading: "Prisijunk vienu paspaudimu",
      body: "Paspausk mygtuką ir būsi prijungtas. Slaptažodžio įvesti nereikia.",
      cta: "Prisijungti",
      ignore: "Jei prisijungti nebandei, ignoruok šį laišką.",
    },
    invite: {
      preview: "Kvietimas į Noriuto.lt",
      heading: "Tave pakvietė 🎁",
      body: "Tave pakvietė prisijungti prie Noriuto.lt. Paspausk mygtuką ir susikurk paskyrą.",
      cta: "Priimti kvietimą",
      ignore: "Jei kvietimo nesitikėjai, gali jį ignoruoti.",
    },
  },
  en: {
    signup: {
      preview: "Confirm your email address",
      heading: "Welcome! 👋",
      body: "One more step — confirm your email address and your account is ready.",
      cta: "Confirm address",
      ignore: "If you didn't create an account, just ignore this email.",
    },
    recovery: {
      preview: "Link to set a new password",
      heading: "Forgot your password?",
      body: "Press the button to choose a new password. The link is valid for a limited time.",
      cta: "Set a new password",
      ignore:
        "If you didn't ask to change your password, ignore this email — nothing will change.",
    },
    email_change: {
      preview: "Confirm your new email address",
      heading: "New email address",
      body: "We received a request to change your account's email address. Confirm the address is yours.",
      cta: "Confirm address",
      ignore:
        "If you didn't request this, ignore this email and change your password right away.",
    },
    magiclink: {
      preview: "Your sign-in link",
      heading: "Sign in with one click",
      body: "Press the button and you're in. No password needed.",
      cta: "Sign in",
      ignore: "If you weren't trying to sign in, ignore this email.",
    },
    invite: {
      preview: "You've been invited to Noriuto.lt",
      heading: "You've been invited 🎁",
      body: "Someone invited you to join Noriuto.lt. Press the button to create your account.",
      cta: "Accept invitation",
      ignore: "If you weren't expecting this, you can ignore it.",
    },
  },
};

export function AuthEmail({
  action,
  locale = "lt",
  actionUrl,
  token,
}: {
  action: AuthEmailAction;
  locale?: AuthEmailLocale;
  actionUrl: string;
  /** The numeric code, for clients that mangle links. */
  token?: string;
}) {
  const copy = COPY[locale][action];
  const isLt = locale === "lt";

  return (
    <EmailLayout preview={copy.preview} footnote={copy.ignore}>
      <EmailHeading>{copy.heading}</EmailHeading>

      <Text style={text}>{copy.body}</Text>

      <Section style={{ margin: "24px 0 8px" }}>
        <Button href={actionUrl} style={buttonPrimary}>
          {copy.cta}
        </Button>
      </Section>

      {/* Some clients rewrite or strip links; the code is the way back in. */}
      {token ? (
        <Text style={{ ...textMuted, margin: "16px 0 0" }}>
          {isLt ? "Arba įvesk kodą: " : "Or enter this code: "}
          <strong style={{ color: brand.ink, letterSpacing: "0.08em" }}>
            {token}
          </strong>
        </Text>
      ) : null}

      <Text style={{ ...textMuted, margin: "16px 0 0", color: brand.faint }}>
        {isLt
          ? "Jei mygtukas neveikia, nukopijuok šią nuorodą į naršyklę:"
          : "If the button doesn't work, copy this link into your browser:"}{" "}
        <Link
          href={actionUrl}
          style={{ color: brand.faint, wordBreak: "break-all" }}
        >
          {actionUrl}
        </Link>
      </Text>
    </EmailLayout>
  );
}
