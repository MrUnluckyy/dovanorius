"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import { generateSlug } from "@/utils/helpers/slugify";
import { useEventCoverUpload } from "@/hooks/useEventCoverUpload";
import { prepareImageForUpload } from "@/utils/images/prepareImage";
import {
  CREATABLE_EVENT_TYPES,
  EVENT_TYPE_META,
} from "@/utils/events/typeMeta";
import type { SsEventType } from "@/types/secret-santa";
import toast from "react-hot-toast";
import { LuArrowLeft, LuImagePlus, LuX } from "react-icons/lu";

type Form = {
  name: string;
  budget?: number;
  event_date?: string;
  notes?: string;
};

// Type-specific copy keys for the picker cards + details step.
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
    // Convert iPhone HEIC → JPEG + compress at pick time, so the preview shows
    // and the upload is small.
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
      const slug = generateSlug(v.name);

      const { data: event, error } = await sb
        .from("ss_events")
        .insert({
          slug,
          owner_id: user!.id,
          name: v.name,
          type,
          budget: meta.showBudget ? v.budget ?? null : null,
          currency: "EUR",
          event_date: v.event_date || null,
          notes: v.notes ?? null,
          status: "open",
        })
        .select("id, slug")
        .single();
      if (error || !event) throw error ?? new Error("create failed");

      // Cover is optional — upload after insert so we have the event id, then
      // patch the row. A failed upload shouldn't block event creation.
      if (coverFile) {
        const url = await uploadEventCover(coverFile, event.id);
        if (url) {
          await sb
            .from("ss_events")
            .update({ cover_image_url: url })
            .eq("id", event.id);
        }
      }

      router.replace(`/events/${event.slug}`);
    } catch (err) {
      console.error("Error creating event:", err);
      toast.error(t("errorCreateFailed"));
    }
  };

  // ── Step 1: pick a type ────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="max-w-md mx-auto p-4">
        <h1 className="text-2xl font-bold font-heading mb-1">
          {t("pickTypeQuestion")}
        </h1>
        <p className="opacity-70 mb-6">{t("pickTypeSubtitle")}</p>
        <div className="grid gap-3">
          {CREATABLE_EVENT_TYPES.map((tp) => {
            const m = EVENT_TYPE_META[tp];
            const c = TYPE_COPY[tp];
            const selected = type === tp;
            return (
              <button
                key={tp}
                type="button"
                onClick={() => setType(tp)}
                className={`card bg-base-100 text-left shadow-sm border-2 transition-colors ${
                  selected ? "border-primary" : "border-transparent"
                }`}
              >
                <div className="card-body flex-row items-center gap-4 p-4">
                  <span className="text-4xl">{m.emoji}</span>
                  <div>
                    <h2 className="card-title text-base">{t(m.labelKey)}</h2>
                    <p className="text-sm opacity-70">{t(c.tagline)}</p>
                    <p className="text-xs opacity-60 mt-1">{t(c.description)}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <button
          className="btn btn-primary w-full mt-6"
          onClick={() => setStep(2)}
        >
          {t("continue")}
        </button>
      </div>
    );
  }

  // ── Step 2: details ─────────────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto p-4">
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-circle"
          onClick={() => setStep(1)}
          aria-label={t("back")}
        >
          <LuArrowLeft className="text-lg" />
        </button>
        <h1 className="text-2xl font-bold font-heading">
          {meta.emoji} {t(meta.labelKey)}
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
        {/* Cover image */}
        <div>
          {coverPreview ? (
            <div className="relative">
              <img
                src={coverPreview}
                alt="cover"
                className="w-full h-40 object-cover rounded-lg"
              />
              <button
                type="button"
                className="btn btn-sm btn-circle absolute top-2 right-2"
                onClick={() => pickCover(null)}
                aria-label={t("back")}
              >
                <LuX />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 h-40 border-2 border-dashed border-base-300 rounded-lg cursor-pointer hover:border-primary transition-colors">
              <LuImagePlus className="text-2xl opacity-70" />
              <span className="text-sm opacity-70">{t("addCover")}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pickCover(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
        </div>

        <label className="font-semibold">{t("fieldName")}</label>
        <input
          className="input input-bordered"
          placeholder={t(copy.namePlaceholder)}
          {...register("name", { required: true })}
        />

        <label className="font-semibold">{t("fieldDate")}</label>
        <input
          className="input input-bordered"
          type="date"
          {...register("event_date")}
        />

        {meta.showBudget && (
          <>
            <label className="font-semibold">{t("fieldBudget")}</label>
            <input
              className="input input-bordered"
              type="number"
              placeholder="30"
              {...register("budget", { valueAsNumber: true })}
            />
          </>
        )}

        <label className="font-semibold">{t("fieldNotes")}</label>
        <textarea
          className="textarea textarea-bordered"
          placeholder={t("placeholderNotes")}
          {...register("notes")}
        />

        <button
          className="btn btn-primary"
          disabled={isSubmitting || uploading || coverProcessing}
        >
          {isSubmitting || uploading ? t("savingEvent") : t("createEventBtn")}
        </button>
      </form>
    </div>
  );
}
