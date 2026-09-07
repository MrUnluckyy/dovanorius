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
 * Sent when an organiser invites an address to an event.
 *
 * The recipient may well have no Noriuto account, so the mail has to carry the
 * whole answer to "what is this?" — who invited them, to what, when, and for
 * how much — before asking them to click anything.
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
  const hasDetails = !!eventDate || budget != null;

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
            Kvietimas į {eventName} 🎁
          </Heading>

          <Text>
            {inviterName ? <strong>{inviterName}</strong> : "Tave"}
            {inviterName ? " kviečia tave" : " pakvietė"} prisidėti prie
            renginio <strong>{eventName}</strong> Noriuto platformoje.
          </Text>

          {hasDetails && (
            <Section
              style={{
                backgroundColor: "#f3f6f4",
                borderRadius: "8px",
                padding: "16px",
                margin: "20px 0",
              }}
            >
              {eventDate && (
                <Text style={{ margin: 0, fontSize: "14px", color: "#5a6b62" }}>
                  Data: <strong>{eventDate}</strong>
                </Text>
              )}
              {budget != null && (
                <Text
                  style={{
                    margin: eventDate ? "8px 0 0" : 0,
                    fontSize: "14px",
                    color: "#5a6b62",
                  }}
                >
                  Dovanos biudžetas:{" "}
                  <strong>
                    {budget} {currency ?? "EUR"}
                  </strong>
                </Text>
              )}
            </Section>
          )}

          <Text>
            Paskyros kurti nereikia — įrašyk savo vardą ir prisijunk kaip
            svečias:
          </Text>

          <Button
            href={joinUrl}
            style={{
              backgroundColor: "#31473A",
              color: "#ffffff",
              padding: "12px 20px",
              borderRadius: "6px",
              fontWeight: "bold",
              display: "inline-block",
              marginTop: "16px",
              textDecoration: "none",
            }}
          >
            Prisijungti prie renginio
          </Button>

          <Text style={{ marginTop: "24px" }}>
            Jei nesitikėjai šio kvietimo — gali jį ignoruoti.
          </Text>

          <Text style={{ marginTop: "12px", opacity: 0.7 }}>
            Su pagarba,
            <br /> <strong>Noriuto komanda</strong>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
