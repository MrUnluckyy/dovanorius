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

export function ReservationReminderEmail({
  itemTitle,
  boardName,
  keepUrl,
  releaseUrl,
}: {
  itemTitle: string;
  boardName?: string | null;
  keepUrl: string;
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
            Prieš kurį laiką rezervavai dovaną{" "}
            <strong>{itemTitle}</strong>
            {boardName ? (
              <>
                {" "}
                norų lentoje <strong>{boardName}</strong>
              </>
            ) : null}
            . Netrukus ši rezervacija baigs galioti ir taps laisva kitiems.
          </Text>

          <Text>
            Jei vis dar ketini ją padovanoti - palik rezervaciją. Jei
            persigalvojai - atlaisvink ją, kad galėtų pasirūpinti kažkas kitas.
          </Text>

          <Section style={{ marginTop: "16px" }}>
            <Button
              href={keepUrl}
              style={{
                backgroundColor: "#31473A",
                color: "#ffffff",
                padding: "12px 20px",
                borderRadius: "6px",
                fontWeight: "bold",
                display: "inline-block",
                textDecoration: "none",
                marginRight: "12px",
              }}
            >
              Palikti rezervaciją
            </Button>

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
              Atlaisvinti
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
