import { Button, Section, Text } from "@react-email/components";
import {
  EmailCallout,
  EmailHeading,
  EmailLayout,
} from "./_components/EmailLayout";
import { brand, buttonPrimary, text, textMuted } from "./_components/theme";
import { formatEventDate } from "@/lib/events/formatEventDate";

/**
 * Sent when an organiser invites an address to an event.
 *
 * The recipient may well have no Noriuto account, so the mail has to answer
 * "what is this?" — who invited them, to what, when, and for how much — before
 * it asks them to click anything.
 */
export function EventInviteEmail({
  eventName,
  inviterName,
  joinUrl,
  eventDate,
  budget,
  currency,
}: {
  eventName: string;
  inviterName?: string | null;
  joinUrl: string;
  eventDate?: string | null;
  budget?: number | null;
  currency?: string | null;
}) {
  const when = formatEventDate(eventDate, "lt");
  return (
    <EmailLayout
      preview={`${inviterName ?? "Tave"} kviečia į „${eventName}“`}
      footnote="Šį laišką gavai, nes kažkas pakvietė tave į renginį Noriuto. Jei nesitikėjai kvietimo — tiesiog ignoruok."
    >
      <EmailHeading>Kvietimas į „{eventName}“</EmailHeading>

      <Text style={text}>
        {inviterName ? <strong>{inviterName}</strong> : "Kažkas"} kviečia tave
        prisidėti prie renginio <strong>{eventName}</strong>.
      </Text>

      {when && <EmailCallout label="Kada" value={when} />}

      {budget != null && (
        <EmailCallout
          label="Dovanos biudžetas"
          value={`${budget} ${currency ?? "EUR"}`}
        />
      )}

      <Text style={text}>
        Paskyros kurti nereikia — įrašai vardą ir esi viduje.
      </Text>

      <Section style={{ padding: "6px 0 4px" }}>
        <Button href={joinUrl} style={buttonPrimary}>
          Prisijungti prie renginio
        </Button>
      </Section>

      <Text style={{ ...textMuted, margin: "16px 0 0", color: brand.faint }}>
        Jei mygtukas neveikia, nukopijuok šią nuorodą: {joinUrl}
      </Text>
    </EmailLayout>
  );
}
