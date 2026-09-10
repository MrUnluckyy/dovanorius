import { Text, Button, Section } from "@react-email/components";
import { EmailLayout, EmailHeading, EmailCallout } from "./_components/EmailLayout";
import { brand, buttonPrimary, text, textMuted } from "./_components/theme";

/**
 * The Play opt-in link, sent to someone who asked for it.
 *
 * This follows the dashboard prompt rather than replacing it: the reader has
 * already said they have an Android phone and typed in the Google address to
 * use, so none of the persuading belongs here. What is left is the one fact
 * that decides whether this works — Google needs the app to stay installed for
 * two weeks, and someone who finds that out on day three uninstalls and resets
 * the count.
 *
 * `accountEmail` is the address they gave, echoed back because the link only
 * works on a phone signed in as that Google account, and a typo there is
 * otherwise invisible until the link fails.
 */
export function AndroidTestersEmail({
  optInUrl,
  accountEmail,
}: {
  /** Play Console → closed testing → the "copy link" opt-in URL. */
  optInUrl: string;
  /** The Google address this tester signed up with. */
  accountEmail: string;
}) {
  return (
    <EmailLayout
      preview="Įsidiek ir palik telefone dvi savaites — to visiškai pakanka."
      footnote="Šį laišką gavai todėl, kad Noriuto.lt užsirašei į Android programėlės testuotojus."
    >
      <EmailHeading>Tavo nuoroda į Noriuto programėlę 📱</EmailHeading>

      <Text style={text}>
        Labas! Ačiū, kad sutikai padėti — įtraukėme tave į testuotojų sąrašą.
      </Text>

      <Text style={text}>
        Vienas dalykas, kurį verta žinoti iš anksto: „Google Play“ naujų
        programėlių neišleidžia tol, kol bent 12 žmonių jas dvi savaites išlaiko
        telefone. Tad svarbiausia — <strong>įsidiegus nepašalinti bent 14 dienų</strong>.
      </Text>

      <EmailCallout label="Ko reikia" value="Įsidiegti ir 14 dienų nepašalinti" />

      <Text style={text}>
        Naudotis nebūtina — užtenka, kad programėlė liktų telefone. O jei
        išbandysi ir parašysi, kas neveikia, bus visai puiku.
      </Text>

      <Section style={{ margin: "24px 0 8px" }}>
        <Button href={optInUrl} style={buttonPrimary}>
          Įsidiegti programėlę
        </Button>
      </Section>

      <Text style={{ ...textMuted, margin: "16px 0 10px" }}>
        Nuoroda suveiks tik tame telefone, kuriame esi prisijungęs prie Google
        paskyros{" "}
        <strong style={{ color: brand.ink }}>{accountEmail}</strong>. Jei Google
        parašys, kad prieigos neturi — parašyk man, ir sutvarkysiu.
      </Text>

      {/* The commonest "your link is broken" report is neither a broken link
          nor the wrong account: Play simply has not caught up yet. Saying so
          here costs one sentence and saves the reply. */}
      <Text style={{ ...textMuted, margin: "0 0 14px" }}>
        Patvirtinus programėlė Play parduotuvėje gali atsirasti ne iš karto —
        jei jos dar nematai, palauk kelias minutes ir bandyk dar kartą.
      </Text>

      <Text style={{ ...textMuted, margin: 0, color: brand.faint }}>
        Jei kas nepavyks ar kils klausimų — tiesiog atsakyk į šį laišką.
        <br />
        Ačiū, Justas
      </Text>
    </EmailLayout>
  );
}
