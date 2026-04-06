"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { LuX, LuMegaphone } from "react-icons/lu";
import Link from "next/link";

type Announcement = {
  id: string;
  message: string;
  cta_label: string | null;
  cta_url: string | null;
};

export function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    supabase
      .from("announcements")
      .select("id, message, cta_label, cta_url")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const key = `announcement_dismissed_${data.id}`;
        if (!localStorage.getItem(key)) {
          setAnnouncement(data);
          setVisible(true);
        }
      });
  }, []);

  const dismiss = () => {
    if (announcement) {
      localStorage.setItem(`announcement_dismissed_${announcement.id}`, "1");
    }
    setVisible(false);
  };

  if (!visible || !announcement) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/8 px-4 py-3 mb-6">
      <LuMegaphone className="mt-0.5 shrink-0 text-primary" size={16} />
      <p className="flex-1 text-sm leading-relaxed">{announcement.message}</p>
      <div className="flex items-center gap-2 shrink-0">
        {announcement.cta_url && announcement.cta_label && (
          <Link
            href={announcement.cta_url}
            className="btn btn-primary btn-xs"
            target={announcement.cta_url.startsWith("http") ? "_blank" : undefined}
            rel={announcement.cta_url.startsWith("http") ? "noopener noreferrer" : undefined}
          >
            {announcement.cta_label}
          </Link>
        )}
        <button
          className="btn btn-ghost btn-xs btn-circle"
          onClick={dismiss}
          aria-label="Uždaryti"
        >
          <LuX size={14} />
        </button>
      </div>
    </div>
  );
}
