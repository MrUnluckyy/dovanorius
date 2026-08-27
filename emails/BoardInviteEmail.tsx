import { Text, Button, Section } from "@react-email/components";
import { EmailLayout, EmailHeading } from "./_components/EmailLayout";
import { brand, buttonPrimary, text, textMuted } from "./_components/theme";

export function BoardInviteEmail({
  boardName,
  joinUrl,
}: {
  boardName: string;
  joinUrl: string;
}) {
  return (
    <EmailLayout
      preview={`Kvietimas prisidėti prie norų lentos ${boardName}`}
      footnote="Šį laišką gavai todėl, kad kažkas pakvietė tave prisidėti prie savo norų lentos Noriuto.lt."
    >
      <EmailHeading>Kvietimas bendradarbiauti 🎁</EmailHeading>

      <Text style={text}>
        Tave pakvietė prisidėti prie norų lentos <strong>{boardName}</strong>.
        Gali pridėti idėjų ir dovanų pasiūlymų.
      </Text>

      <Text style={text}>
        Paskyros kurti nereikia — tiesiog paspausk mygtuką ir prisijunk kaip
        svečias.
      </Text>

      <Section style={{ margin: "24px 0 8px" }}>
        <Button href={joinUrl} style={buttonPrimary}>
          Prisijungti prie lentos
        </Button>
      </Section>

      <Text style={{ ...textMuted, margin: "16px 0 0", color: brand.faint }}>
        Jei nesitikėjai šio kvietimo — gali jį ignoruoti.
      </Text>
    </EmailLayout>
  );
}
