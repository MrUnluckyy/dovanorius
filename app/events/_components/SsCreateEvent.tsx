"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { LuArrowLeft, LuChevronRight, LuImagePlus, LuX } from "react-icons/lu";
import { createClient } from "@/utils/supabase/client";
import { generateSlug } from "@/utils/helpers/slugify";
import { useEventCoverUpload } from "@/hooks/useEventCoverUpload";
import { prepareImageForUpload } from "@/utils/images/prepareImage";
import {
  CREATABLE_EVENT_TYPES,
  EVENT_TYPE_META,
} from "@/utils/events/typeMeta";
import type { SsEventType } from "@/types/secret-santa";

type Form = {
  name: string;
  budget?: number;
  event_date?: string;
  notes?: string;
};

const TYPE_COPY: Record<
  SsEventType,
  { tagline: string; description: string; namePlaceholder: string }
> = {
  secret_santa: {
    tagline: "ssTagline",
    description: "ssDescription",
    namePlaceholder: "placeholderNameSS",
  },
  name_draw: {
    tagline: "nameDrawTagline",
    description: "nameDrawDescription",
    namePlaceholder: "placeholderNameDraw",
  },
  group: {
    tagline: "ssTagline",
    description: "ssDescription",
    namePlaceholder: "placeholderNameSS",
  },
};

export default function SsCreateEvent() {
  const t = useTranslations("Events");
  const router = useRouter();
  const sb = createClient();
  const { uploadEventCover, uploading } = useEventCoverUpload();

  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState<SsEventType>("secret_santa");
  const [showExtras, setShowExtras] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverProcessing, setCoverProcessing] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Form>();

  const meta = EVENT_TYPE_META[type];
  const copy = TYPE_COPY[type];

  const pickCover = async (file: File | null) => {
    if (!file) {
      setCoverFile(null);
      setCoverPreview(null);
      return;
    }
    // HEIC → JPEG and compression happen at pick time so the preview works and
    // the upload stays small.
    setCoverProcessing(true);
    try {
      const processed = await prepareImageForUpload(file);
      setCoverFile(processed);
      setCoverPreview(URL.createObjectURL(processed));
    } catch {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    } finally {
      setCoverProcessing(false);
    }
  };

  const onSubmit = async (v: Form) => {
    if (!v.name?.trim()) {
      toast.error(t("errorMissingName"));
      return;
    }
    try {
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) throw new Error("not authenticated");

      const { data: event, error } = await sb
        .from("ss_events")
        .insert({
          slug: generateSlug(v.name),
          owner_id: user.id,
          name: v.name.trim(),
          type,
          budget: meta.showBudget ? v.budget ?? null : null,
          currency: "EUR",
          event_date: v.event_date || null,
          notes: v.notes?.trim() || null,
          status: "open",
        })
        .select("id, slug")
        .single();
      if (error || !event) throw error ?? new Error("create failed");

      if (coverFile) {
        const url = await uploadEventCover(coverFile, event.id);
        if (url) {
          await sb
            .from("ss_events")
            .update({ cover_image_url: url })
            .eq("id", event.id);
        }
      }

      // Land on the event with the invite sheet already open: an event with
      // nobody in it is the one state that is never what the organiser wanted,
      // and the old flow left them on a silent page to work that out.
      router.replace(`/events/${event.slug}?invite=1`);
    } catch (err) {
      console.error("Error creating event:", err);
      toast.error(t("errorCreateFailed"));
    }
  };

  const field =
    "w-full rounded-[var(--nr-radius-input)] border border-(--nr-border) bg-(--nr-surface) px-3.5 py-3 text-[15px] outline-none transition placeholder:text-(--nr-faint) focus:border-(--nr-yellow-deep)";
  const labelCls = "mb-1.5 block text-[13px] font-semibold text-(--nr-ink)";

  // ── Step 1: what kind of event ────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="mx-auto w-full max-w-[440px] px-4 py-8 md:py-12">
        <h1 className="nr-h2 mb-2 text-[28px]">{t("pickTypeQuestion")}</h1>
        <p className="nr-lead mb-7 text-[16px]">{t("pickTypeSubtitle")}</p>

        <div className="grid gap-3">
          {CREATABLE_EVENT_TYPES.map((tp) => {
            const m = EVENT_TYPE_META[tp];
            const c = TYPE_COPY[tp];
            return (
              <button
                key={tp}
                type="button"
                onClick={() => {
                  // One tap picks and advances. The old screen pre-selected a
                  // type and still made you press Continue, so the obvious
                  // action did nothing visible.
                  setType(tp);
                  setStep(2);
                }}
                className="nr-card nr-card-hover flex w-full items-center gap-4 p-4 text-left"
              >
                <span
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-[16px] bg-(--nr-tile) text-2xl"
                  aria-hidden
                >
                  {m.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-heading text-[17px] font-bold text-(--nr-ink)">
                    {t(m.labelKey)}
                  </span>
                  <span className="mt-0.5 block text-[14px] leading-snug text-(--nr-muted)">
                    {t(c.description)}
                  </span>
                </span>
                <LuChevronRight className="w-5 shrink-0 text-(--nr-faint)" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Step 2: the details ───────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-[440px] px-4 py-8 md:py-12">
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setStep(1)}
          aria-label={t("back")}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-(--nr-border) bg-(--nr-surface) text-(--nr-ink) transition hover:bg-(--nr-tile)"
        >
          <LuArrowLeft />
        </button>
        <h1 className="nr-h2 text-[24px]">
          <span aria-hidden>{meta.emoji}</span> {t(meta.labelKey)}
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <label className="mb-4 block">
          <span className={labelCls}>{t("fieldName")}</span>
          <input
            autoFocus
            className={field}
            placeholder={t(copy.namePlaceholder)}
            {...register("name", { required: true })}
          />
        </label>

        <label className="mb-4 block">
          <span className={labelCls}>{t("fieldDateOptional")}</span>
          <input type="date" className={field} {...register("event_date")} />
        </label>

        {meta.showBudget && (
          <label className="mb-4 block">
            <span className={labelCls}>{t("fieldBudgetOptional")}</span>
            <input
              type="number"
              inputMode="numeric"
              className={field}
              placeholder="30"
              {...register("budget", { valueAsNumber: true })}
            />
            <span className="mt-1.5 block text-[13px] text-(--nr-faint)">
              {t("budgetHelp")}
            </span>
          </label>
        )}

        {/* Cover and notes are genuinely optional, so they stay out of the way
            until asked for — the fastest path to a live event is name + Create. */}
        {showExtras ? (
          <>
            <div className="mb-4">
              <span className={labelCls}>{t("addCover")}</span>
              {coverPreview ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverPreview}
                    alt=""
                    className="h-36 w-full rounded-[var(--nr-radius-img)] object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => pickCover(null)}
                    aria-label={t("removeCover")}
                    className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-(--nr-surface) text-(--nr-ink) shadow-[var(--nr-shadow-hover)]"
                  >
                    <LuX size={15} />
                  </button>
                </div>
              ) : (
                <label className="flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--nr-radius-img)] border-2 border-dashed border-(--nr-border) bg-(--nr-surface) transition hover:border-(--nr-yellow-deep)">
                  <LuImagePlus className="text-xl text-(--nr-faint)" />
                  <span className="text-[14px] text-(--nr-muted)">
                    {coverProcessing ? t("savingEvent") : t("addCover")}
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

            <label className="mb-5 block">
              <span className={labelCls}>{t("fieldNotes")}</span>
              <textarea
                rows={3}
                className={`${field} resize-y`}
                placeholder={t("placeholderNotes")}
                {...register("notes")}
              />
            </label>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowExtras(true)}
            className="mb-5 text-[14px] font-semibold text-(--nr-gold-strong) underline underline-offset-2"
          >
            {t("addMoreDetails")}
          </button>
        )}

        <button
          type="submit"
          disabled={isSubmitting || uploading || coverProcessing}
          className="nr-btn nr-btn-primary w-full disabled:opacity-50"
        >
          {isSubmitting || uploading ? t("savingEvent") : t("createEventBtn")}
        </button>
        <p className="mt-3 text-center text-[13px] text-(--nr-faint)">
          {t("createThenInvite")}
        </p>
      </form>
    </div>
  );
}
