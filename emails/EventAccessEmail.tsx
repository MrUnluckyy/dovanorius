import { Button, Section, Text } from "@react-email/components";
import { EmailCallout, EmailHeading, EmailLayout } from "./_components/EmailLayout";
import { brand, buttonPrimary, text, textMuted } from "./_components/theme";
import { formatEventDate } from "@/lib/events/formatEventDate";

/** The way back into an event, for someone with no account or on a new device. */
export function EventAccessEmail({
  eventName,
  accessUrl,
  eventDate,
  minutes,
}: {
  eventName: string;
  accessUrl: string;
  /** "YYYY-MM-DD" from ss_events.event_date. */
  eventDate?: string | null;
  minutes: number;
}) {
  const when = formatEventDate(eventDate, "lt");
  return (
    <EmailLayout
      preview={`Atidaryk renginį „${eventName}“ šiame įrenginyje`}
      footnote="Šį laišką gavai, nes kažkas paprašė nuorodos į renginį šiuo adresu. Jei tai ne tu, tiesiog nekreipk dėmesio: be šio laiško niekas į renginį nepateks."
    >
      <EmailHeading>Tavo vieta jau laukia</EmailHeading>

      <Text style={text}>
        Paspausk mygtuką ir renginys <strong>{eventName}</strong> atsidarys
        šiame įrenginyje. Slaptažodžio nereikia.
      </Text>

      {when && <EmailCallout label="Kada" value={when} />}

      <Section style={{ padding: "6px 0 4px" }}>
        <Button href={accessUrl} style={buttonPrimary}>
          Atidaryti renginį
        </Button>
      </Section>

      <Text style={{ ...text, margin: "20px 0 0" }}>
        Nuoroda veikia {minutes} minučių ir tik vieną kartą. Vėliau naują gausi
        tiesiog įvedęs savo el. paštą renginio puslapyje.
      </Text>

      <Text style={{ ...textMuted, margin: "16px 0 0", color: brand.faint }}>
        Jei mygtukas neveikia, nukopijuok šią nuorodą: {accessUrl}
      </Text>
    </EmailLayout>
  );
}
