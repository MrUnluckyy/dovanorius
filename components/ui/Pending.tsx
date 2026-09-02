/**
 * The travelling band at its smallest — three dots the light passes along.
 * For places too narrow for a ribbon: inside an input, beside a table row,
 * in a button whose label must not move.
 */
export function PendingPips({ className = "" }: { className?: string }) {
  return (
    <span className={`nr-pips ${className}`} aria-hidden>
      <span className="nr-pip" />
      <span className="nr-pip" />
      <span className="nr-pip" />
    </span>
  );
}
