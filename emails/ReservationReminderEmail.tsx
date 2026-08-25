import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Section,
} from "@react-email/components";

/**
 * A check-in, not a warning.
 *
 * This email used to say the hold was about to lapse and offered two buttons,
 * keep and release — which made ignoring it the destructive choice. Reservations
 * no longer expire, so silence is now the safe answer and the only action left
 * is the one a giver has an actual reason to take: letting the gift go.
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
    <Html>
      <Head />
      <Body style={{ backgroundColor: "#f5f5f5", fontFamily: "Arial" }}>
        <Container
          style={{
            backgroundColor: "#ffffff",
            padding: "24px",
            borderRadius: "8px",
            maxWidth: "480px",
          }}
        >
          <Heading style={{ color: "#31473A", fontSize: "24px" }}>
            Vis dar planuoji dovanoti? 🎁
          </Heading>

          <Text>
            Prieš kurį laiką rezervavai dovaną <strong>{itemTitle}</strong>
            {boardName ? (
              <>
                {" "}
                norų lentoje <strong>{boardName}</strong>
              </>
            ) : null}
            . Ji vis dar tavo — rezervacija negalioja terminuotai ir savaime
            nedings.
          </Text>

          <Text>
            <strong>Jei vis dar planuoji ją padovanoti, daryti nieko
            nereikia.</strong> Tiesiog ištrink šį laišką.
          </Text>

          <Text>
            O jei persigalvojai — atlaisvink dovaną, kad ja galėtų pasirūpinti
            kas nors kitas.
          </Text>

          <Section style={{ marginTop: "16px" }}>
            <Button
              href={releaseUrl}
              style={{
                backgroundColor: "#ffffff",
                color: "#31473A",
                padding: "12px 20px",
                borderRadius: "6px",
                fontWeight: "bold",
                display: "inline-block",
                textDecoration: "none",
                border: "1px solid #31473A",
              }}
            >
              Atlaisvinti dovaną
            </Button>
          </Section>

          <Text style={{ marginTop: "24px", opacity: 0.7 }}>
            Su pagarba,
            <br /> <strong>Noriuto komanda</strong>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
