import { render } from "@react-email/components";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { AuthEmail } from "@/emails/AuthEmail";
import { ReservationConfirmedEmail } from "@/emails/ReservationConfirmedEmail";
import { ReservationReminderEmail } from "@/emails/ReservationReminderEmail";
import { BoardInviteEmail } from "@/emails/BoardInviteEmail";

/**
 * Every email in one scrollable page, for local development only.
 *
 * Email templates are the one part of the product nobody sees while building
 * it: you change the copy, deploy, and find out days later when someone
 * forwards you a screenshot. This renders all of them from the same components
 * the real senders use, so a palette or wording change can be checked in a
 * second.
 *
 * `notFound()` in any non-development environment — this is a build-time
 * constant, so the page is unreachable in production.
 */
export default async function DevEmailPreview() {
  if (process.env.NODE_ENV !== "development") notFound();

  const items: [string, ReactElement][] = [
    [
      "Auth — signup (lt)",
      AuthEmail({
        action: "signup",
        locale: "lt",
        actionUrl: "https://example.com/verify",
        token: "305805",
      }),
    ],
    [
      "Auth — recovery (en)",
      AuthEmail({
        action: "recovery",
        locale: "en",
        actionUrl: "https://example.com/verify",
        token: "305805",
      }),
    ],
    [
      "Auth — email change (lt)",
      AuthEmail({
        action: "email_change",
        locale: "lt",
        actionUrl: "https://example.com/verify",
        token: "305805",
      }),
    ],
    [
      "Reservation confirmed (guest only)",
      ReservationConfirmedEmail({
        itemTitle: "Kindle Colorsoft e-skaityklė",
        boardName: "Romos norai 🍦",
        boardUrl: "https://noriuto.lt/b/romos-norai",
        releaseUrl: "https://noriuto.lt/r/release/token",
      }),
    ],
    [
      "Reservation check-in (guest only)",
      ReservationReminderEmail({
        itemTitle: "LEGO DUPLO skaičių traukinys",
        boardName: "Junai 4! 🧜‍♀️",
        releaseUrl: "https://noriuto.lt/r/release/token",
      }),
    ],
    [
      "Board invite",
      BoardInviteEmail({
        boardName: "Kalėdoms",
        joinUrl: "https://noriuto.lt/boards/join/token",
      }),
    ],
  ];

  const rendered = await Promise.all(
    items.map(async ([name, el]) => [name, await render(el)] as const)
  );

  return (
    <div style={{ background: "#e9e4d8", padding: "20px", minHeight: "100vh" }}>
      <p
        style={{
          font: "600 13px/1.4 system-ui",
          margin: "0 0 16px",
          color: "#3d372d",
        }}
      >
        Email previews — development only. Not reachable in production.
      </p>
      {rendered.map(([name, html]) => (
        <div key={name} style={{ marginBottom: "28px" }}>
          <p
            style={{
              font: "600 13px/1.4 system-ui",
              margin: "0 0 6px",
              color: "#3d372d",
            }}
          >
            {name}
          </p>
          <iframe
            title={name}
            srcDoc={html}
            style={{
              width: "100%",
              height: "660px",
              border: "1px solid #cfc7b6",
              borderRadius: "8px",
              background: "#fff",
            }}
          />
        </div>
      ))}
    </div>
  );
}
