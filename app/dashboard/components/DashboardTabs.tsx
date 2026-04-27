"use client";
import { useState } from "react";
import { User } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
import { BoardsList } from "@/app/boards/components/BoardsList";
import { ReservedItems } from "./ReservedItems";
import { FollowingList } from "./FollowingList";
import MyEvents from "./MyEvents";

type Tab = "wishes" | "events" | "friends";

export function DashboardTabs({ user }: { user: User }) {
  const t = useTranslations("Dashboard");
  const [active, setActive] = useState<Tab>("wishes");

  const tabs: { key: Tab; label: string }[] = [
    { key: "wishes", label: t("tabWishes") },
    { key: "events", label: t("tabEvents") },
    { key: "friends", label: t("tabFriends") },
  ];

  return (
    <div>
      <div role="tablist" className="tabs tabs-border mb-6">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            className={`tab text-base font-semibold${active === key ? " tab-active" : ""}`}
            onClick={() => setActive(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {active === "wishes" && (
        <div>
          <BoardsList user={user} />
          <ReservedItems user={user} />
        </div>
      )}
      {active === "events" && <MyEvents user={user} />}
      {active === "friends" && <FollowingList userId={user.id} />}
    </div>
  );
}
