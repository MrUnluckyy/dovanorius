import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Button,
} from "@react-email/components";

export function ResetPasswordEmail({ url }: { url: string }) {
  return (
    <Html>
      <Head />
      <Body
        style={{ backgroundColor: "#f5f5f5", fontFamily: "Arial, sans-serif" }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            padding: "24px",
            borderRadius: "8px",
            maxWidth: "480px",
          }}
        >
          <Heading
            style={{ color: "#31473A", fontSize: "24px", marginBottom: "16px" }}
          >
            Slaptažodžio atstatymas 🔒
          </Heading>

          <Text style={{ fontSize: "14px", lineHeight: "1.5" }}>
            Gavome užklausą atstatyti jūsų paskyros slaptažodį.
          </Text>

          <Text
            style={{ fontSize: "14px", lineHeight: "1.5", marginTop: "8px" }}
          >
            Paspauskite žemiau esantį mygtuką ir pasirinkite naują slaptažodį:
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
              marginTop: "18px",
              textDecoration: "none",
            }}
          >
            Atstatyti slaptažodį
          </Button>

          <Text
            style={{ fontSize: "12px", lineHeight: "1.5", marginTop: "20px" }}
          >
            Jei slaptažodžio atstatymo neprašėte, galite ignoruoti šį laišką -
            jūsų paskyra išliks nepakitusi.
          </Text>

          <Text
            style={{
              fontSize: "12px",
              lineHeight: "1.5",
              marginTop: "16px",
              opacity: 0.7,
            }}
          >
            Su pagarba,
            <br />
            <strong>Noriuto komanda</strong>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
