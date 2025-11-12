// app/secret-santa/[slug]/_components/Participants.tsx
"use client";
import { Avatar } from "@/components/Avatar";
import { SsEvent, SsMember } from "@/types/secret-santa";
import { qq } from "@/utils/qq";
import { createClient } from "@/utils/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { LuCheck, LuClock, LuCrown } from "react-icons/lu";

export default function Participants({
  event,
  members,
}: {
  event: SsEvent;
  members: SsMember[];
}) {
  const sb = createClient();
  const qc = useQueryClient();

  const confirm = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await sb.auth.getUser();
      const me = members.find((m) => m.user_id === user?.id);
      if (me)
        await sb
          .from("ss_members")
          .update({ is_confirmed: true })
          .eq("id", me.id);
      else
        await sb.from("ss_members").insert({
          event_id: event.id,
          user_id: user!.id,
          is_confirmed: true,
        });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qq.members(event.id) }),
  });

  return (
    <div className="card bg-base-200 shadow">
      <div className="card-body">
        <h3 className="card-title">Dalyviai:</h3>
        <div className="flex flex-col gap-4">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <Avatar
                avatar_url={m.profile?.avatar_url}
                name={m.display_name}
                size={8}
              />
              <p className="text-lg">
                {m.display_name || m.profile?.display_name}
                {m.role === "owner" || m.role === "admin" ? (
                  <span className="badge ml-2">
                    <LuCrown />
                  </span>
                ) : null}
              </p>
              <div className="w-6 h-6 flex justify-center items-center bg-success text-success-content rounded-full">
                {m.is_confirmed ? <LuCheck /> : <LuClock />}
              </div>
            </div>
          ))}
          {!members.length && <div className="opacity-60">Dalyviu nėra</div>}
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
