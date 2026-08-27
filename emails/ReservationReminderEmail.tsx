import { Text, Button, Section } from "@react-email/components";
import { EmailLayout, EmailHeading } from "./_components/EmailLayout";
import { brand, buttonSecondary, text, textMuted } from "./_components/theme";

/**
 * A check-in, not a warning.
 *
 * This email used to say the hold was about to lapse and offered two buttons,
 * keep and release — which made ignoring it the destructive choice. Reservations
 * no longer expire, so silence is now the safe answer and the only action left
 * is the one a giver has an actual reason to take: letting the gift go.
 *
 * Only guests receive it. An account holder gets the same check-in through the
 * notification bell, because they have a dashboard and we are not going to mail
 * them about something they can already see.
 *
 * `keepUrl` is still accepted so already-signed links keep working; nothing
 * links to it here.
 */
export function ReservationReminderEmail({
  itemTitle,
  boardName,
  releaseUrl,
}: {
  itemTitle: string;
  boardName?: string | null;
  keepUrl?: string;
  releaseUrl: string;
}) {
  return (
    <EmailLayout
      preview={`${itemTitle} vis dar rezervuota tavo vardu`}
      footnote="Šį laišką gavai todėl, kad rezervavai dovaną Noriuto.lt ir palikai savo el. pašto adresą."
    >
      <EmailHeading>Vis dar planuoji dovanoti? 🎁</EmailHeading>

      <Text style={text}>
        Prieš kurį laiką rezervavai dovaną <strong>{itemTitle}</strong>
        {boardName ? (
          <>
            {" "}
            norų lentoje <strong>{boardName}</strong>
          </>
        ) : null}
        . Ji vis dar tavo — rezervacija negalioja terminuotai ir savaime nedings.
      </Text>

      <Text style={{ ...text, fontWeight: 600 }}>
        Jei vis dar planuoji ją padovanoti, daryti nieko nereikia. Tiesiog
        ištrink šį laišką.
      </Text>

      <Text style={text}>
        O jei persigalvojai — atlaisvink dovaną, kad ja galėtų pasirūpinti kas
        nors kitas.
      </Text>

      <Section style={{ margin: "24px 0 8px" }}>
        <Button href={releaseUrl} style={buttonSecondary}>
          Atlaisvinti dovaną
        </Button>
      </Section>

      <Text style={{ ...textMuted, margin: "16px 0 0", color: brand.faint }}>
        Lentos savininkas nemato, kad rezervavai būtent tu.
      </Text>
    </EmailLayout>
  );
}
