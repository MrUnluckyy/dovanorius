import { PortableText, type PortableTextBlock, stegaClean } from "next-sanity";
import { LuInfo, LuLightbulb, LuTriangleAlert } from "react-icons/lu";

type Tone = "info" | "tip" | "warning";

const TONES: Record<Tone, { className: string; Icon: typeof LuInfo }> = {
  info: { className: "alert-info", Icon: LuInfo },
  tip: { className: "alert-success", Icon: LuLightbulb },
  warning: { className: "alert-warning", Icon: LuTriangleAlert },
};

export default function Callout({
  value,
}: {
  value: { tone?: string; title?: string; content?: PortableTextBlock[] | null };
}) {
  if (!value?.content?.length) return null;

  const cleaned = stegaClean(value.tone) as Tone | undefined;
  const tone: Tone = cleaned && cleaned in TONES ? cleaned : "info";
  const { className, Icon } = TONES[tone];

  return (
    <aside className={`alert ${className} my-8 items-start gap-3`}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0">
        {value.title && <p className="mb-1 font-semibold">{value.title}</p>}
        <div className="[&_p:last-child]:mb-0 [&_p]:mb-2 text-sm">
          <PortableText value={value.content} />
        </div>
      </div>
    </aside>
  );
}
