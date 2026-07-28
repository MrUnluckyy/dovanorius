import type { PortableTextComponents } from "next-sanity";
import Link from "next/link";

import BodyImage from "@/components/blog/BodyImage";
import Callout from "@/components/blog/Callout";
import Gallery from "@/components/blog/Gallery";
import GiftPicks from "@/components/blog/GiftPicks";

/**
 * A factory rather than a constant: the gift-picks block needs a localised
 * fallback label for its buttons, which only the page knows.
 */
export function getPortableTextComponents(
  t: (key: string) => string
): PortableTextComponents {
  return {
    block: {
      normal: ({ children }) => <p className="mb-4 leading-relaxed">{children}</p>,
      h2: ({ children }) => (
        <h2 className="mt-10 mb-3 text-2xl font-bold">{children}</h2>
      ),
      h3: ({ children }) => (
        <h3 className="mt-8 mb-2 text-xl font-semibold">{children}</h3>
      ),
      blockquote: ({ children }) => (
        <blockquote className="border-primary/40 my-6 border-l-4 pl-4 italic opacity-90">
          {children}
        </blockquote>
      ),
    },

    list: {
      bullet: ({ children }) => (
        <ul className="mb-4 ml-6 list-disc space-y-1">{children}</ul>
      ),
      number: ({ children }) => (
        <ol className="mb-4 ml-6 list-decimal space-y-1">{children}</ol>
      ),
    },

    marks: {
      link: ({ children, value }) => {
        const href: string = value?.href ?? "#";

        if (href.startsWith("/")) {
          return (
            <Link href={href} className="link link-primary">
              {children}
            </Link>
          );
        }

        return (
          <a
            href={href}
            className="link link-primary"
            target={value?.openInNewTab ? "_blank" : undefined}
            rel="noopener noreferrer"
          >
            {children}
          </a>
        );
      },
    },

    types: {
      pteImage: ({ value }) => <BodyImage value={value} />,
      pteGallery: ({ value }) => <Gallery value={value} />,
      pteCallout: ({ value }) => <Callout value={value} />,
      pteGiftPicks: ({ value }) => (
        <GiftPicks value={value} defaultCtaLabel={t("viewItem")} />
      ),
    },
  };
}
