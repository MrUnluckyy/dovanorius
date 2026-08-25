import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Section,
  Link,
  Hr,
} from "@react-email/components";

/**
 * Sent the moment someone reserves a gift.
 *
 * This is the whole reason the address is now required: it is the only thing a
 * guest keeps. No account, no dashboard — just this email, with the date the
 * hold runs out and a link back to the board.
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
            Dovana rezervuota 🎁
          </Heading>

          <Text>
            Rezervavai <strong>{itemTitle}</strong>
            {boardName ? (
              <>
                {" "}
                norų lentoje <strong>{boardName}</strong>
              </>
            ) : null}
            . Niekas kitas šios dovanos nebepasiims — o lentos savininkas
            nemato, kad ją rezervavai būtent tu.
          </Text>

          <Section
            style={{
              backgroundColor: "#f3f6f4",
              borderRadius: "8px",
              padding: "16px",
              margin: "20px 0",
            }}
          >
            <Text style={{ margin: 0, fontSize: "14px", color: "#5a6b62" }}>
              Dovana rezervuota
            </Text>
            <Text
              style={{
                margin: "2px 0 0",
                fontSize: "18px",
                fontWeight: "bold",
                color: "#31473A",
              }}
            >
              kol pats ją atšauksi
            </Text>
          </Section>

          <Text>
            Rezervacija negalioja terminuotai ir savaime nedings. Išsaugok šį
            laišką — jame yra nuoroda grįžti prie lentos ir, jei persigalvotum,
            atlaisvinti dovaną.
          </Text>

          {boardUrl && (
            <Section style={{ marginTop: "16px" }}>
              <Button
                href={boardUrl}
                style={{
                  backgroundColor: "#31473A",
                  color: "#ffffff",
                  padding: "12px 20px",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  display: "inline-block",
                  textDecoration: "none",
                }}
              >
                Atidaryti norų lentą
              </Button>
            </Section>
          )}

          <Hr style={{ borderColor: "#e6e6e6", margin: "24px 0 16px" }} />

          <Text style={{ fontSize: "14px", color: "#6b6357", margin: 0 }}>
            Persigalvojai?{" "}
            <Link href={releaseUrl} style={{ color: "#31473A" }}>
              Atlaisvink dovaną
            </Link>{" "}
            , kad ją galėtų padovanoti kas nors kitas.
          </Text>

          <Text style={{ marginTop: "24px", opacity: 0.7 }}>
            Su pagarba,
            <br /> <strong>Noriuto komanda</strong>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
