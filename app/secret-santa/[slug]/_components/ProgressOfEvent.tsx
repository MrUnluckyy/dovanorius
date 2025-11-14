import { SsEvent } from "@/types/secret-santa";
import React from "react";
import { LuCheckCheck, LuCircleCheck } from "react-icons/lu";

export function ProgressOfEvent({ event }: { event: SsEvent }) {
  return (
    <ul className="timeline timeline-vertical lg:timeline-horizontal w-full">
      <li className="flex-1">
        <div className="timeline-start">1.</div>
        <div className="timeline-middle">
          <LuCircleCheck className="text-success text-xl" />
        </div>
        <div className="timeline-end timeline-box">Renginio sukūrimas</div>
        <hr className="bg-success" />
      </li>
      <li className="flex-1">
        <hr className={event?.status === "locked" ? "bg-success" : ""} />
        <div className="timeline-start">2.</div>
        <div className="timeline-middle">
          <LuCircleCheck
            className={`${
              event?.status === "locked" && "text-success"
            } text-xl`}
          />
        </div>
        <div className="timeline-end timeline-box">Narių prisijungimas</div>
        <hr />
      </li>
      <li className="flex-1">
        <hr className={event?.status === "drawn" ? "bg-success" : ""} />
        <div className="timeline-start">3.</div>
        <div className="timeline-middle">
          <LuCircleCheck
            className={`${event?.status === "drawn" && "text-success"} text-xl`}
          />
        </div>
        <div className="timeline-end timeline-box">Traukimas</div>
        <hr />
      </li>
      <li className="flex-1">
        <hr className={event?.status === "drawn" ? "bg-success" : ""} />
        <div className="timeline-start">4.</div>
        <div className="timeline-middle">🎅</div>
        <div className="timeline-end timeline-box">Dovanos</div>
      </li>
    </ul>
  );
}
