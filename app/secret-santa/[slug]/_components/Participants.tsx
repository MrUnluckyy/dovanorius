// app/secret-santa/[slug]/_components/Participants.tsx
"use client";
import { Avatar } from "@/components/Avatar";
import { Participant, SsEvent } from "@/types/secret-santa";
import Link from "next/link";
import { LuCheck, LuClock, LuCrown, LuX } from "react-icons/lu";

export default function Participants({
  event,
  participants,
}: {
  event: SsEvent;
  participants: Participant[];
}) {
  console.log("invites", participants);
  return (
    <div className="card bg-base-200 shadow">
      <div className="card-body">
        <h3 className="card-title">Dalyviai:</h3>
        <div className="flex flex-col gap-4">
          {participants.map((p) => (
            <div key={p.user_id} className="flex items-center gap-2">
              <Avatar
                avatar_url={p.avatar_url || null}
                name={p.display_name || "?"}
                size={8}
              />
              <p className="text-lg">
                {p.display_name}
                {p.role === "owner" || p.role === "admin" ? (
                  <span className="badge ml-2">
                    <LuCrown />
                  </span>
                ) : null}
              </p>
              <div className="w-6 h-6 flex justify-center items-center bg-success text-success-content rounded-full">
                {p.status === "joined" && <LuCheck />}
                {p.status === "pending" && <LuClock />}
                {p.status === "declined" && <LuX />}
              </div>
            </div>
          ))}
          {!participants.length && (
            <div className="opacity-60">Dalyviu nėra</div>
          )}
        </div>
        {event.status === "drawn" ? (
          <div>
            <Link
              href={`/secret-santa/${event.slug}/my`}
              className="btn btn-primary mt-4"
            >
              Traukti
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
