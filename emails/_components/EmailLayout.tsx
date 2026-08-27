import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Preview,
  Hr,
} from "@react-email/components";
import type { ReactNode } from "react";
import { brand, font, textMuted } from "./theme";

/**
 * The shell every Noriuto email sits in.
 *
 * Each template used to carry its own copy of the Html/Head/Body/Container
 * boilerplate, its own button styling and its own sign-off — five copies that
 * had already drifted apart, and all still painted in the pre-rebrand green.
 *
 * `preview` is the line shown next to the subject in an inbox list. None of the
 * old templates set one, so mail clients filled it with whatever text came
 * first — usually the greeting, which says nothing.
 */
export function EmailLayout({
  preview,
  children,
  baseUrl = process.env.NEXT_PUBLIC_WEB_URL ?? "https://noriuto.lt",
  footnote,
}: {
  preview: string;
  children: ReactNode;
  baseUrl?: string;
  /** Small print under the divider — why this email was sent, opt-outs. */
  footnote?: ReactNode;
}) {
  return (
    <Html lang="lt">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: brand.page,
          fontFamily: font,
          margin: 0,
          padding: "32px 16px",
        }}
      >
        <Container style={{ maxWidth: "520px", margin: "0 auto" }}>
          <Section style={{ padding: "0 0 20px" }}>
            <Link
              href={baseUrl}
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: brand.ink,
                textDecoration: "none",
                letterSpacing: "-0.01em",
              }}
            >
              Noriuto.lt
            </Link>
          </Section>

          <Section
            style={{
              backgroundColor: brand.surface,
              borderRadius: "20px",
              border: `1px solid ${brand.border}`,
              padding: "32px",
            }}
          >
            {children}
          </Section>

          <Section style={{ padding: "20px 8px 0" }}>
            {footnote ? (
              <>
                <Text
                  style={{
                    ...textMuted,
                    fontSize: "13px",
                    color: brand.faint,
                    margin: "0 0 12px",
                  }}
                >
                  {footnote}
                </Text>
                <Hr
                  style={{
                    borderColor: brand.border,
                    borderTop: `1px solid ${brand.border}`,
                    margin: "0 0 12px",
                  }}
                />
              </>
            ) : null}
            <Text
              style={{
                ...textMuted,
                fontSize: "13px",
                color: brand.faint,
                margin: 0,
              }}
            >
              Noriuto.lt — norų sąrašai, kuriais malonu dalintis.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** Heading for the top of a card. Kept here so every email sizes them alike. */
export function EmailHeading({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        margin: "0 0 16px",
        fontSize: "24px",
        lineHeight: "1.25",
        fontWeight: 700,
        color: brand.ink,
        letterSpacing: "-0.02em",
      }}
    >
      {children}
    </Text>
  );
}

/**
 * The soft yellow panel used to carry the one fact the reader came for — an
 * expiry date, a board name, a status.
 */
export function EmailCallout({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <Section
      style={{
        backgroundColor: brand.tile,
        borderRadius: "14px",
        padding: "16px 18px",
        margin: "0 0 20px",
      }}
    >
      <Text
        style={{
          margin: 0,
          fontSize: "13px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: brand.goldStrong,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          margin: "4px 0 0",
          fontSize: "18px",
          fontWeight: 700,
          color: brand.ink,
        }}
      >
        {value}
      </Text>
    </Section>
  );
}
