"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { LuImagePlus, LuTrash2, LuX } from "react-icons/lu";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import { useEventCoverUpload } from "@/hooks/useEventCoverUpload";
import { prepareImageForUpload } from "@/utils/images/prepareImage";
import { getEventTypeMeta } from "@/utils/events/typeMeta";
import { qq } from "@/utils/qq";
import { deleteEvent, leaveEvent, updateEvent } from "@/app/actions/events/manage";
import type { SsEvent } from "@/types/secret-santa";

/**
 * Everything an organiser can change after the event exists.
 *
 * There was no way to fix a typo in an event name, and no way to delete an
 * event at all — the only escape from a mistake was to abandon it in the list
 * forever. Name, date, budget, notes and cover are editable; the type and the
 * slug are not, because both are already baked into links other people hold.
 */
export default function EventSettingsSheet({
  event,
  isOwner,
  open,
  onClose,
}: {
  event: SsEvent;
  isOwner: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("Events");
  const router = useRouter();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { uploadEventCover, uploading } = useEventCoverUpload();
  const meta = getEventTypeMeta(event.type);

  const [name, setName] = useState(event.name);
  const [date, setDate] = useState(event.event_date ?? "");
  const [budget, setBudget] = useState(
    event.budget != null ? String(event.budget) : ""
  );
  const [notes, setNotes] = useState(event.notes ?? "");
  const [cover, setCover] = useState<string | null>(event.cover_image_url);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Re-sync when the sheet reopens, so a cancelled edit does not linger.
  useEffect(() => {
    if (!open) return;
    setName(event.name);
    setDate(event.event_date ?? "");
    setBudget(event.budget != null ? String(event.budget) : "");
    setNotes(event.notes ?? "");
    setCover(event.cover_image_url);
    setCoverFile(null);
  }, [open, event]);

  if (!open) return null;

  const pickCover = async (file: File | null) => {
    if (!file) {
      setCoverFile(null);
      setCover(null);
      return;
    }
    try {
      const processed = await prepareImageForUpload(file);
      setCoverFile(processed);
      setCover(URL.createObjectURL(processed));
    } catch {
      setCoverFile(file);
      setCover(URL.createObjectURL(file));
    }
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error(t("errorMissingName"));
      return;
    }
    setSaving(true);
    try {
      let coverUrl: string | null | undefined;
      if (coverFile) {
        coverUrl = (await uploadEventCover(coverFile, event.id)) ?? undefined;
      } else if (cover === null && event.cover_image_url) {
        coverUrl = null;
      }

      const res = await updateEvent(event.slug, {
        name: name.trim(),
        event_date: date || null,
        budget: meta.showBudget && budget !== "" ? Number(budget) : null,
        notes: notes.trim() || null,
        ...(coverUrl !== undefined ? { cover_image_url: coverUrl } : {}),
      });
      if (!res.ok) throw new Error(res.error);

      qc.invalidateQueries({ queryKey: qq.event(event.slug) });
      qc.invalidateQueries({ queryKey: qq.myEventsAll() });
      toast.success(t("settingsSaved"));
      onClose();
    } catch (err) {
      console.error("Failed to save event:", err);
      toast.error(t("settingsSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: t("deleteConfirmTitle"),
      message: t("deleteConfirmBody", { name: event.name }),
      confirmText: t("deleteConfirmCta"),
    });
    if (!ok) return;

    const res = await deleteEvent(event.slug);
    if (!res.ok) {
      toast.error(t("deleteFailed"));
      return;
    }
    qc.invalidateQueries({ queryKey: qq.myEventsAll() });
    toast.success(t("deleteDone"));
    router.replace("/events");
  };

  const leave = async () => {
    const ok = await confirm({
      title: t("leaveConfirmTitle"),
      message: t("leaveConfirmBody", { name: event.name }),
      confirmText: t("leaveConfirmCta"),
    });
    if (!ok) return;

    const res = await leaveEvent(event.slug);
    if (!res.ok) {
      toast.error(
        res.error === "already_drawn" ? t("leaveAfterDraw") : t("leaveFailed")
      );
      return;
    }
    qc.invalidateQueries({ queryKey: qq.myEventsAll() });
    router.replace("/events");
  };

  const field =
    "w-full rounded-[var(--nr-radius-input)] border border-(--nr-border) bg-(--nr-cream) px-3.5 py-2.5 text-[15px] outline-none transition placeholder:text-(--nr-faint) focus:border-(--nr-yellow-deep)";
  const label = "mb-1.5 block text-[13px] font-semibold text-(--nr-ink)";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-(--nr-ink)/45 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88svh] w-full flex-col overflow-hidden rounded-t-[28px] bg-(--nr-surface) sm:max-w-[480px] sm:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-(--nr-border) px-5 py-4">
          <h2 className="nr-h3 flex-1 text-[19px]">
            {isOwner ? t("settingsTitle") : t("settingsTitleMember")}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("close")}
            className="grid h-8 w-8 place-items-center rounded-full text-(--nr-muted) transition hover:bg-(--nr-tile) hover:text-(--nr-ink)"
          >
            <LuX />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {isOwner ? (
            <>
              <div className="mb-5">
                {cover ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cover}
                      alt=""
                      className="h-36 w-full rounded-[var(--nr-radius-img)] object-cover"
                    />
                    <button
                      onClick={() => pickCover(null)}
                      aria-label={t("removeCover")}
                      className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-(--nr-surface) text-(--nr-ink) shadow-[var(--nr-shadow-hover)]"
                    >
                      <LuX size={15} />
                    </button>
                  </div>
                ) : (
                  <label className="flex h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--nr-radius-img)] border-2 border-dashed border-(--nr-border) bg-(--nr-cream) transition hover:border-(--nr-yellow-deep)">
                    <LuImagePlus className="text-xl text-(--nr-faint)" />
                    <span className="text-[14px] text-(--nr-muted)">
                      {t("addCover")}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => pickCover(e.target.files?.[0] ?? null)}
                    />
                  </label>
                )}
              </div>

              <label className="mb-4 block">
                <span className={label}>{t("fieldName")}</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={field}
                />
              </label>

              <label className="mb-4 block">
                <span className={label}>{t("fieldDate")}</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={field}
                />
              </label>

              {meta.showBudget && (
                <label className="mb-4 block">
                  <span className={label}>{t("fieldBudget")}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="30"
                    className={field}
                  />
                </label>
              )}

              <label className="mb-5 block">
                <span className={label}>{t("fieldNotes")}</span>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("placeholderNotes")}
                  className={`${field} resize-y`}
                />
              </label>

              <button
                onClick={save}
                disabled={saving || uploading}
                className="nr-btn nr-btn-primary w-full disabled:opacity-50"
              >
                {saving || uploading ? t("savingEvent") : t("settingsSave")}
              </button>

              <div className="mt-7 border-t border-(--nr-border) pt-5">
                <p className="mb-3 text-[13px] leading-relaxed text-(--nr-muted)">
                  {t("deleteExplain")}
                </p>
                <button
                  onClick={remove}
                  className="nr-btn nr-btn-sm w-full bg-(--nr-error-soft) text-(--nr-error-ink)"
                >
                  <LuTrash2 className="w-4" />
                  {t("deleteEvent")}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mb-5 text-[15px] leading-relaxed text-(--nr-muted)">
                {t("leaveExplain")}
              </p>
              <button
                onClick={leave}
                className="nr-btn nr-btn-sm w-full bg-(--nr-error-soft) text-(--nr-error-ink)"
              >
                {t("leaveEvent")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
