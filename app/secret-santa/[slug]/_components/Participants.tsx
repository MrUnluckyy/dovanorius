"use client";
import { Avatar } from "@/components/Avatar";
import { Participant } from "@/types/secret-santa";
import { LuCheck, LuClock, LuCrown, LuX } from "react-icons/lu";

export default function Participants({
  participants,
  onUserSelect,
  isAdmin = false,
}: {
  isAdmin?: boolean;
  participants: Participant[];
  onUserSelect: (id: string) => void;
}) {
  return (
    <div className="card bg-base-200 shadow flex-1">
      <div className="card-body">
        <h3 className="card-title font-heading">Dalyviai:</h3>
        <div className="flex flex-col gap-4">
          {participants.map((p) => (
            <div
              key={p.user_id}
              className={`flex items-center gap-2 ${
                isAdmin ? "cursor-pointer hover:bg-base-300 p-2 rounded-lg" : ""
              }`}
              onClick={() => onUserSelect(p.user_id)}
            >
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
              <div
                className={`w-6 h-6 flex justify-center items-center ${
                  p.status === "joined"
                    ? "bg-success text-success-content"
                    : p.status === "pending"
                    ? "bg-warning text-warning-content"
                    : "bg-error text-error-content"
                } bg-success text-success-content rounded-full`}
              >
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
      </div>
    </div>
  );
}
