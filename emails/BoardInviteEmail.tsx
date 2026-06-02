import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Button,
} from "@react-email/components";

export function BoardInviteEmail({
  boardName,
  joinUrl,
}: {
  boardName: string;
  joinUrl: string;
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
            Kvietimas bendradarbiauti 🎁
          </Heading>

          <Text>
            Tave pakvietė prisidėti prie norų lentos{" "}
            <strong>{boardName}</strong> Noriuto platformoje. Gali pridėti idėjų
            ir dovanų pasiūlymų.
          </Text>

          <Text>
            Paskyros kurti nereikia - tiesiog paspausk mygtuką ir prisijunk kaip
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
            Prisijungti prie lentos
          </Button>

          <Text style={{ marginTop: "24px" }}>
            Jei nesitikėjai šio kvietimo - gali jį ignoruoti.
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
