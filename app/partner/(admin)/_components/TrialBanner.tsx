import { LuTriangleAlert, LuClock } from "react-icons/lu";
import { ltPlural } from "@/lib/lt-plural";
import { PARTNER_CONTACT_EMAIL, TRIAL_MONTHS, trialStatus } from "@/lib/partner/trial";

/**
 * Trial notice at the top of the partner panel. Warning only — the account
 * keeps working after the trial ends.
 */
export function TrialBanner({ createdAt }: { createdAt: string }) {
  const trial = trialStatus(createdAt);
  if (trial.state === "active") return null;

  const date = trial.endsAt.toLocaleDateString("lt-LT");
  const contact = (
    <a href={`mailto:${PARTNER_CONTACT_EMAIL}`} className="link font-semibold">
      {PARTNER_CONTACT_EMAIL}
    </a>
  );

  if (trial.state === "ended") {
    return (
      <div role="alert" className="alert alert-warning mb-6 text-sm">
        <LuTriangleAlert size={18} className="shrink-0" />
        <span>
          {TRIAL_MONTHS} mėnesių bandomasis laikotarpis baigėsi {date}. Norėdami
          tęsti bendradarbiavimą, parašykite mums: {contact}.
        </span>
      </div>
    );
  }

  return (
    <div role="status" className="alert alert-info mb-6 text-sm">
      <LuClock size={18} className="shrink-0" />
      <span>
        Bandomasis laikotarpis baigiasi {date} (liko {trial.daysLeft}{" "}
        {ltPlural(trial.daysLeft, "diena", "dienos", "dienų")}). Dėl tolesnio
        bendradarbiavimo rašykite: {contact}.
      </span>
    </div>
  );
}
