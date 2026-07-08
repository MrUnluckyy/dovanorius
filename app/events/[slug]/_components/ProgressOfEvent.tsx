import { SsEvent } from "@/types/secret-santa";
import React from "react";
import { LuCircleCheck } from "react-icons/lu";
import { useTranslations } from "next-intl";
import { getEventTypeMeta } from "@/utils/events/typeMeta";

export function ProgressOfEvent({ event }: { event: SsEvent }) {
  const t = useTranslations("Events");
  const meta = getEventTypeMeta(event?.type);
  const lockedOrDrawn =
    event?.status === "locked" || event?.status === "drawn";
  // A gifts step only makes sense for Secret Santa; Name Draw ends at the draw.
  const showGiftStep = meta.type === "secret_santa";

  return (
    <ul className="timeline timeline-vertical lg:timeline-horizontal w-full">
      <li className="flex-1">
        <div className="timeline-start">1.</div>
        <div className="timeline-middle">
          <LuCircleCheck className="text-success text-xl" />
        </div>
        <div className="timeline-end timeline-box">{t("stepCreate")}</div>
        <hr className="bg-success" />
      </li>
      <li className="flex-1">
        <hr className={lockedOrDrawn ? "bg-success" : ""} />
        <div className="timeline-start">2.</div>
        <div className="timeline-middle">
          <LuCircleCheck
            className={`${lockedOrDrawn && "text-success"} text-xl`}
          />
        </div>
        <div className="timeline-end timeline-box">{t("stepJoin")}</div>
        <hr className={lockedOrDrawn ? "bg-success" : ""} />
      </li>
      <li className="flex-1">
        <hr className={event?.status === "drawn" ? "bg-success" : ""} />
        <div className="timeline-start">3.</div>
        <div className="timeline-middle">
          <LuCircleCheck
            className={`${event?.status === "drawn" && "text-success"} text-xl`}
          />
        </div>
        <div className="timeline-end timeline-box">{t("stepDraw")}</div>
        {showGiftStep && (
          <hr className={event?.status === "drawn" ? "bg-success" : ""} />
        )}
      </li>
      {showGiftStep && (
        <li className="flex-1">
          <hr />
          <div className="timeline-start">4.</div>
          <div className="timeline-middle">{meta.emoji}</div>
          <div className="timeline-end timeline-box">{t("stepGifts")}</div>
        </li>
      )}
    </ul>
  );
}
