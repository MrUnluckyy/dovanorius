"use client";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { generateSlug } from "@/utils/helpers/slugify";

type Form = {
  name: string;
  budget?: number;
  currency?: string;
  event_date?: string;
  notes?: string;
};

export default function SsCreateEvent() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ defaultValues: { currency: "EUR" } });
  const router = useRouter();
  const sb = createClient();

  const onSubmit = async (v: Form) => {
    const {
      data: { user },
    } = await sb.auth.getUser();
    const slug = generateSlug(v.name);
    const { data, error } = await sb
      .from("ss_events")
      .insert({
        slug,
        owner_id: user!.id,
        name: v.name,
        budget: v.budget ?? null,
        currency: v.currency,
        event_date: v.event_date || null,
        notes: v.notes ?? null,
        status: "open",
      })
      .select("slug")
      .single();
    if (error) return alert(error.message);
    router.replace(`/secret-santa/${data!.slug}`);
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Sukurti renginį</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
        <label className="font-semibold">Renginio pavadinimas</label>
        <input
          className="input input-bordered"
          placeholder="Kalėdos 2024, Biuro dovanos, etc."
          {...register("name", { required: true })}
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            className="input input-bordered"
            type="number"
            placeholder="Biudžetas"
            {...register("budget", { valueAsNumber: true })}
          />
          <input
            className="input input-bordered"
            placeholder="eur"
            disabled
            {...register("currency")}
          />
        </div>
        <input
          className="input input-bordered"
          type="date"
          {...register("event_date")}
        />
        <textarea
          className="textarea textarea-bordered"
          placeholder="Aprašymas"
          {...register("notes")}
        />
        <button
          className={`btn btn-primary ${isSubmitting ? "loading" : ""}`}
          disabled={isSubmitting}
        >
          Sukurti
        </button>
      </form>
    </div>
  );
}
