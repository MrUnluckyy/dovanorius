import { SsEvent } from "@/types/secret-santa";
import { useFormatter } from "next-intl";
import React from "react";
import { LuCalendar, LuGift } from "react-icons/lu";

export default function EventSettings({ event }: { event: SsEvent }) {
  const format = useFormatter();
  const dateTime = new Date(event.event_date!);
  return (
    <div className="card bg-base-200 shadow flex-1">
      <div className="card-body">
        <h3 className="card-title font-heading text-2xl">{event.name}</h3>
        <div className="flex flex-col gap-4">
          <div className="w-full p-4 bg-base-300 rounded-lg flex items-center text-xl gap-2">
            <LuGift className="w-8 h-8" />
            <p>&euro;{event.budget}</p>
          </div>
          <div className="w-full p-4 bg-base-300 rounded-lg flex items-center text-xl gap-2">
            <LuCalendar className="w-8 h-8" />
            <p>
              {format?.dateTime(dateTime, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
