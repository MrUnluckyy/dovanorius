import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Button,
} from "@react-email/components";

export function ConfirmEmail({ url }: { url: string }) {
  return (
    <Html>
      <Head />
      <Body
        style={{
          backgroundColor: "#f5f5f5",
          fontFamily: "Arial",
        }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            padding: "24px",
            borderRadius: "8px",
            maxWidth: "480px",
          }}
        >
          <Heading style={{ color: "#31473A", fontSize: "24px" }}>
            Sveiki! 👋
          </Heading>

          <Text>
            Dėkojame, kad prisiregistravote. Patvirtinkite savo el. pašto adresą
            paspausdami žemiau esantį mygtuką:
          </Text>

          <Button
            href={url}
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
            Patvirtinti el. pašto adresą
          </Button>

          <Text style={{ marginTop: "24px" }}>
            Jei nekūrėte paskyros - galite ignoruoti šį laišką.
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
