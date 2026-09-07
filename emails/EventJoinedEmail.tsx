import { Button, Section, Text } from "@react-email/components";
import { EmailHeading, EmailLayout } from "./_components/EmailLayout";
import { brand, buttonPrimary, text, textMuted } from "./_components/theme";

/**
 * Sent to a guest the moment they join an event through a link.
 *
 * A guest has no account and no dashboard, so this mail is the only durable
 * copy of where their event lives. It also explains the Supabase confirmation
 * mail arriving beside it — two messages at once reads as broken unless the
 * one they expected says why.
 */
export function EventJoinedEmail({
  eventName,
  eventUrl,
  displayName,
}: {
  eventName: string;
  eventUrl: string;
  displayName?: string | null;
}) {
  return (
    <EmailLayout
      preview={`Tu dalyvauji renginyje „${eventName}“`}
      footnote="Šį laišką gavai, nes prisijungei prie renginio Noriuto."
    >
      <EmailHeading>Tu dalyvauji: „{eventName}“</EmailHeading>

      <Text style={text}>
        {displayName ? `${displayName}, tu` : "Tu"} sėkmingai prisijungei prie
        renginio <strong>{eventName}</strong>.
      </Text>

      <Text style={text}>
        Išsaugok šį laišką — nuoroda žemiau yra tavo kelias atgal, kai bus
        ištraukti vardai.
      </Text>

      <Section style={{ padding: "6px 0 4px" }}>
        <Button href={eventUrl} style={buttonPrimary}>
          Atidaryti renginį
        </Button>
      </Section>

      <Text style={{ ...text, margin: "20px 0 0" }}>
        Atsiuntėme ir atskirą laišką el. pašto patvirtinimui. Paspaudęs jame
        esančią nuorodą galėsi grįžti į renginį iš bet kurio įrenginio — be jos
        tavo vieta liks tik šioje naršyklėje.
      </Text>

      <Text style={{ ...textMuted, margin: "16px 0 0", color: brand.faint }}>
        Jei mygtukas neveikia, nukopijuok šią nuorodą: {eventUrl}
      </Text>
    </EmailLayout>
  );
}
