import { Text, Button, Section, Link } from "@react-email/components";
import {
  EmailLayout,
  EmailHeading,
  EmailCallout,
} from "./_components/EmailLayout";
import { brand, buttonPrimary, text, textMuted } from "./_components/theme";

/**
 * Sent the moment a guest reserves a gift.
 *
 * This is the whole reason the address is required: it is the only thing a
 * guest keeps. No account, no dashboard — just this email, with a link back to
 * the board and a way to let the gift go.
 *
 * Account holders do not receive it. They get a notification instead, because
 * the reservation is already sitting on their dashboard.
 */
export function ReservationConfirmedEmail({
  itemTitle,
  boardName,
  boardUrl,
  releaseUrl,
}: {
  itemTitle: string;
  boardName?: string | null;
  boardUrl?: string | null;
  releaseUrl: string;
}) {
  return (
    <EmailLayout
      preview={`${itemTitle} — rezervuota tavo vardu`}
      footnote="Šį laišką gavai todėl, kad rezervavai dovaną Noriuto.lt. Lentos savininkas nemato nei tavo adreso, nei to, kad rezervavai būtent tu."
    >
      <EmailHeading>Dovana rezervuota 🎁</EmailHeading>

      <Text style={text}>
        Rezervavai <strong>{itemTitle}</strong>
        {boardName ? (
          <>
            {" "}
            norų lentoje <strong>{boardName}</strong>
          </>
        ) : null}
        . Niekas kitas šios dovanos nebepasiims.
      </Text>

      <EmailCallout label="Dovana rezervuota" value="kol pats ją atšauksi" />

      <Text style={text}>
        Rezervacija negalioja terminuotai ir savaime nedings. Išsaugok šį laišką
        — jame yra nuoroda grįžti prie lentos ir, jei persigalvotum, atlaisvinti
        dovaną.
      </Text>

      {boardUrl && (
        <Section style={{ margin: "24px 0 8px" }}>
          <Button href={boardUrl} style={buttonPrimary}>
            Atidaryti norų lentą
          </Button>
        </Section>
      )}

      <Text style={{ ...textMuted, margin: "16px 0 0" }}>
        Persigalvojai?{" "}
        <Link
          href={releaseUrl}
          style={{ color: brand.ink, textDecoration: "underline" }}
        >
          Atlaisvink dovaną
        </Link>
        , kad ją galėtų padovanoti kas nors kitas.
      </Text>
    </EmailLayout>
  );
}
