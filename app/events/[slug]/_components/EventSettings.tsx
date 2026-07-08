import { SsEvent } from "@/types/secret-santa";
import { useFormatter } from "next-intl";
import React from "react";
import { LuCalendar, LuGift } from "react-icons/lu";
import { getEventTypeMeta } from "@/utils/events/typeMeta";

export default function EventSettings({ event }: { event: SsEvent }) {
  const format = useFormatter();
  const meta = getEventTypeMeta(event.type);
  const showBudget = meta.showBudget && event.budget != null;
  const eventDate = event.event_date ? new Date(event.event_date) : null;

  return (
    <div className="card bg-base-200 shadow flex-1">
      <div className="card-body">
        <h3 className="card-title font-heading text-2xl">{event.name}</h3>
        <div className="flex flex-col gap-4">
          {showBudget && (
            <div className="w-full p-4 bg-base-300 rounded-lg flex items-center text-xl gap-2">
              <LuGift className="w-8 h-8" />
              <p>
                &euro;{event.budget} {event.currency ?? "EUR"}
              </p>
            </div>
          )}
          {eventDate && (
            <div className="w-full p-4 bg-base-300 rounded-lg flex items-center text-xl gap-2">
              <LuCalendar className="w-8 h-8" />
              <p>
                {format?.dateTime(eventDate, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
