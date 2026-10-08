/* eslint-disable @next/next/no-img-element -- Satori renders <img>, not next/image */
import type { SlideImage } from "./assets";
import { clip, ideasLabel, priceBand } from "./copy";
import type { DeckProduct } from "./deck";

/**
 * The carousel's slides, as Satori JSX. Satori is not a browser: only flexbox,
 * every element with more than one child needs `display: flex`, and styles
 * must be inline.
 *
 * Look: the Noriuto Instagram feed — brand yellow, heavy Bricolage, ink pills,
 * product photos in thick-bordered sticker cards with a hard offset shadow.
 */

export const SLIDE_W = 1080;
export const SLIDE_H = 1350; // 4:5, the tallest Instagram feed format

const C = {
  yellow: "#ffd166",
  ink: "#231f18",
  cream: "#faf7f0",
  tile: "#fff4d6",
  muted: "#7a705f",
  white: "#ffffff",
};

const BORDER = 6;

function Brand({ logo, color = C.ink }: { logo: string; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <img src={logo} width={60} height={60} alt="" />
      <div
        style={{
          fontFamily: "Bricolage",
          fontWeight: 800,
          fontSize: 40,
          letterSpacing: -1,
          color,
        }}
      >
        noriuto
      </div>
    </div>
  );
}

function SwipeArrow({ color }: { color: string }) {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke={color}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A product photo in a white sticker card. Falls back to a tile when the
 *  merchant's image could not be fetched, so a slide never renders broken. */
function PhotoCard({
  image,
  width,
  height,
  padding,
  radius,
}: {
  image: SlideImage | null;
  width: number;
  height: number;
  padding: number;
  radius: number;
}) {
  if (image?.fill) {
    return (
      <div
        style={{
          display: "flex",
          width,
          height,
          border: `${BORDER}px solid ${C.ink}`,
          borderRadius: radius,
          overflow: "hidden",
          background: C.white,
        }}
      >
        <img
          src={image.src}
          width={width - 2 * BORDER}
          height={height - 2 * BORDER}
          alt=""
          style={{ objectFit: "cover" }}
        />
      </div>
    );
  }

  const innerW = width - 2 * (padding + BORDER);
  const innerH = height - 2 * (padding + BORDER);
  let w = innerW;
  let h = innerH;
  if (image) {
    const scale = Math.min(innerW / image.width, innerH / image.height);
    w = Math.round(image.width * scale);
    h = Math.round(image.height * scale);
  }
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width,
        height,
        background: image ? C.white : C.tile,
        border: `${BORDER}px solid ${C.ink}`,
        borderRadius: radius,
      }}
    >
      {image ? (
        <img src={image.src} width={w} height={h} alt="" />
      ) : (
        <div style={{ fontFamily: "Instrument", fontSize: 30, color: C.muted }}>
          Nuotrauka nepasiekiama
        </div>
      )}
    </div>
  );
}

function headlineSize(title: string) {
  const n = title.length;
  if (n <= 14) return 150;
  if (n <= 24) return 124;
  if (n <= 40) return 100;
  return 82;
}

export function CoverSlide({
  title,
  count,
  images,
  logo,
}: {
  title: string;
  count: number;
  images: (SlideImage | null)[];
  logo: string;
}) {
  // A fanned hand of three cards, bleeding off the bottom edge.
  const fan = images.slice(0, 3);
  const spots = [
    { left: 10, top: 790, rotate: -9 },
    { left: 600, top: 810, rotate: 8 },
    { left: 295, top: 720, rotate: -1 },
  ];
  // Draw the middle card last so it sits on top.
  const order = fan.length === 3 ? [0, 1, 2] : fan.map((_, i) => i);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: SLIDE_W,
        height: SLIDE_H,
        background: C.yellow,
        padding: "64px 72px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Soft cream disc in the corner, echoing the feed's background shapes. */}
      <div
        style={{
          position: "absolute",
          right: -180,
          top: -200,
          width: 560,
          height: 560,
          borderRadius: 9999,
          background: "#ffdf8f",
        }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Brand logo={logo} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontFamily: "Instrument",
            fontWeight: 600,
            fontSize: 30,
            color: C.ink,
          }}
        >
          Braukite
          <SwipeArrow color={C.ink} />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          marginTop: 70,
          fontFamily: "Bricolage",
          fontWeight: 800,
          fontSize: headlineSize(title),
          lineHeight: 0.98,
          letterSpacing: -4,
          color: C.ink,
          maxWidth: 920,
        }}
      >
        {clip(title, 70)}
      </div>

      <div style={{ display: "flex", marginTop: 40 }}>
        <div
          style={{
            display: "flex",
            background: C.ink,
            color: C.yellow,
            fontFamily: "Instrument",
            fontWeight: 600,
            fontSize: 36,
            padding: "16px 34px",
            borderRadius: 9999,
          }}
        >
          {ideasLabel(count)}
        </div>
      </div>

      {order.map((i) => {
        const s = fan.length === 1 ? spots[2] : spots[i];
        return (
          <div
            key={i}
            style={{
              display: "flex",
              position: "absolute",
              left: s.left,
              top: s.top,
              transform: `rotate(${s.rotate}deg)`,
            }}
          >
            <PhotoCard image={fan[i]} width={480} height={590} padding={36} radius={42} />
          </div>
        );
      })}
    </div>
  );
}

export function ProductSlide({
  product,
  image,
  index,
  total,
  showPrice,
  logo,
}: {
  product: DeckProduct;
  image: SlideImage | null;
  index: number;
  total: number;
  showPrice: boolean;
  logo: string;
}) {
  const tilt = index % 2 === 0 ? -1.6 : 1.4;
  const band = showPrice ? priceBand(product.price) : null;
  const name = clip(product.name, 64);
  const reason = product.reason ? clip(product.reason, 90) : null;

  const CARD_W = 900;
  const CARD_H = 830;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: SLIDE_W,
        height: SLIDE_H,
        background: C.cream,
        padding: "56px 72px 64px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Brand logo={logo} />
        <div
          style={{
            fontFamily: "Bricolage",
            fontWeight: 600,
            fontSize: 34,
            color: C.muted,
          }}
        >
          {`${index + 1} / ${total}`}
        </div>
      </div>

      {/* Card with a hard yellow offset shadow, slightly tilted like a sticker. */}
      <div
        style={{
          display: "flex",
          position: "relative",
          marginTop: 52,
          marginLeft: (SLIDE_W - 144 - CARD_W) / 2,
          width: CARD_W + 20,
          height: CARD_H + 20,
          transform: `rotate(${tilt}deg)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 20,
            top: 20,
            width: CARD_W,
            height: CARD_H,
            background: C.yellow,
            border: `${BORDER}px solid ${C.ink}`,
            borderRadius: 48,
          }}
        />
        <div style={{ display: "flex", position: "absolute", left: 0, top: 0 }}>
          <PhotoCard image={image} width={CARD_W} height={CARD_H} padding={56} radius={48} />
        </div>
        {band && (
          <div
            style={{
              display: "flex",
              position: "absolute",
              right: -18,
              top: -22,
              background: C.ink,
              color: C.yellow,
              fontFamily: "Instrument",
              fontWeight: 600,
              fontSize: 32,
              padding: "12px 26px",
              borderRadius: 9999,
              transform: "rotate(5deg)",
            }}
          >
            {`~ ${band}`}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          marginTop: 46,
          fontFamily: "Bricolage",
          fontWeight: 800,
          fontSize: name.length > 38 ? 52 : 62,
          lineHeight: 1.04,
          letterSpacing: -1.5,
          color: C.ink,
        }}
      >
        {name}
      </div>
      {product.brand && (
        <div
          style={{
            display: "flex",
            marginTop: 12,
            fontFamily: "Instrument",
            fontWeight: 600,
            fontSize: 30,
            color: C.muted,
          }}
        >
          {product.brand}
        </div>
      )}
      {reason && (
        <div
          style={{
            display: "flex",
            marginTop: 22,
            fontFamily: "Instrument",
            fontWeight: 400,
            fontSize: 32,
            lineHeight: 1.3,
            color: C.ink,
            borderLeft: `6px solid ${C.yellow}`,
            paddingLeft: 22,
          }}
        >
          {reason}
        </div>
      )}
    </div>
  );
}

export function ClosingSlide({ logo }: { logo: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: SLIDE_W,
        height: SLIDE_H,
        background: C.ink,
        padding: "64px 72px 80px",
      }}
    >
      <Brand logo={logo} color={C.cream} />

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontFamily: "Bricolage",
            fontWeight: 800,
            fontSize: 120,
            lineHeight: 0.98,
            letterSpacing: -4,
            color: C.cream,
          }}
        >
          Dar šimtai idėjų laukia noriuto.lt
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 36,
            fontFamily: "Instrument",
            fontSize: 38,
            lineHeight: 1.35,
            color: "#d9d0bf",
            maxWidth: 820,
          }}
        >
          Susikurk norų sąrašą ir pasidalink juo — kitą kartą niekam nereikės spėlioti.
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            background: C.yellow,
            color: C.ink,
            fontFamily: "Bricolage",
            fontWeight: 800,
            fontSize: 40,
            padding: "22px 40px",
            borderRadius: 9999,
          }}
        >
          noriuto.lt
          <SwipeArrow color={C.ink} />
        </div>
        <div
          style={{
            fontFamily: "Instrument",
            fontWeight: 600,
            fontSize: 30,
            color: "#d9d0bf",
          }}
        >
          Nuoroda profilyje
        </div>
      </div>
    </div>
  );
}
