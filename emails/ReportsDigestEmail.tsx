import { Text, Section, Hr } from "@react-email/components";
import { EmailLayout, EmailHeading } from "./_components/EmailLayout";
import { text, textMuted } from "./_components/theme";

export type ReportGroup = { area: string; reason: string | null; count: number };
export type ReportMessage = {
  message: string;
  contactEmail: string | null;
  area: string;
  path: string | null;
};

/**
 * The hourly "something is failing" note.
 *
 * Ordered the way you would want to read it at 3am: how bad, then what people
 * actually said. The counts tell you whether it is one person having a bad
 * time or the whole flow being down; the messages tell you what it felt like.
 */
export function ReportsDigestEmail({
  groups,
  messages,
  adminUrl,
  since,
}: {
  groups: ReportGroup[];
  messages: ReportMessage[];
  adminUrl: string;
  since: string;
}) {
  const total = groups.reduce((n, g) => n + g.count, 0);

  return (
    <EmailLayout
      preview={`${total} nauj${total === 1 ? "as" : "i"} pranešim${
        total === 1 ? "as" : "ai"
      } iš Noriuto`}
      footnote="Automatinis pranešimas iš Noriuto klaidų stebėjimo."
    >
      <EmailHeading>
        {total} naujų pranešimų {total === 1 ? "" : ""}
      </EmailHeading>

      <Text style={textMuted}>Nuo {since}</Text>

      <Section>
        {groups.map((g) => (
          <Text key={`${g.area}:${g.reason}`} style={text}>
            <strong>{g.count}×</strong> {g.area}
            {g.reason ? ` — ${g.reason}` : ""}
          </Text>
        ))}
      </Section>

      {messages.length > 0 && (
        <>
          <Hr />
          <Text style={text}>
            <strong>Ką parašė žmonės:</strong>
          </Text>
          {messages.map((m, i) => (
            <Section key={i}>
              <Text style={text}>“{m.message}”</Text>
              <Text style={textMuted}>
                {m.area}
                {m.path ? ` · ${m.path}` : ""}
                {m.contactEmail ? ` · atsakyti: ${m.contactEmail}` : " · be adreso"}
              </Text>
            </Section>
          ))}
        </>
      )}

      <Hr />
      <Text style={textMuted}>{adminUrl}</Text>
    </EmailLayout>
  );
}
