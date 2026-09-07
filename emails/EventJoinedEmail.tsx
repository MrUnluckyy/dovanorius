import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Button,
} from "@react-email/components";

/**
 * Sent to a guest the moment they join an event through a link.
 *
 * A guest has no account and no dashboard: this mail is the only durable copy
 * of where their event lives. Without it, clearing browser data would lose
 * them their spot — and with Secret Santa, the name they drew — with nothing
 * to fall back on.
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
            Tu dalyvauji: {eventName} 🎉
          </Heading>

          <Text>
            {displayName ? `${displayName}, tu` : "Tu"} sėkmingai prisijungei
            prie renginio <strong>{eventName}</strong>.
          </Text>

          <Text>
            Išsaugok šį laišką — čia esanti nuoroda yra tavo kelias atgal į
            renginį, kai bus ištraukti vardai.
          </Text>

          <Button
            href={eventUrl}
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
            Atidaryti renginį
          </Button>

          <Text style={{ marginTop: "24px", opacity: 0.7 }}>
            Su pagarba,
            <br /> <strong>Noriuto komanda</strong>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
