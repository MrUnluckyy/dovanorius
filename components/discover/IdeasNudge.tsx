import Link from "next/link";
import { LuSparkles } from "react-icons/lu";

/**
 * The one way the app points at Discover from inside other flows: at the moment
 * someone actually needs an idea (they drew a name, a wishlist is thin), not as
 * a banner everywhere.
 *
 * Quiet by default — a line of text with a link — so it never competes with the
 * page's own primary action. `prominent` is for dead ends (an empty wishlist),
 * where the nudge IS the next step and earns button weight.
 */
export function IdeasNudge({
  lead,
  cta,
  href = "/idejos",
  prominent = false,
  className = "",
}: {
  lead: string;
  cta: string;
  href?: string;
  prominent?: boolean;
  className?: string;
}) {
  if (prominent) {
    return (
      <div className={`flex flex-col items-center gap-2 text-center ${className}`}>
        <p className="text-[14px] text-(--nr-muted)">{lead}</p>
        <Link href={href} className="nr-btn nr-btn-outline gap-2">
          <LuSparkles className="text-[16px]" />
          {cta}
        </Link>
      </div>
    );
  }
  return (
    <p className={`text-[14px] text-(--nr-muted) ${className}`}>
      {lead}{" "}
      <Link
        href={href}
        className="inline-flex items-center gap-1 font-semibold text-(--nr-ink) underline decoration-(--nr-yellow) decoration-2 underline-offset-4 hover:decoration-(--nr-ink)"
      >
        <LuSparkles className="text-[14px]" aria-hidden />
        {cta}
      </Link>
    </p>
  );
}
