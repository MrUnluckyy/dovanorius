"use client";

import { useTranslations } from "next-intl";

type Props = {
  onParse: () => void;
  loading: boolean;
  value: string;
  onChange: (value: string) => void;
};

export default function ProductUrlParser({
  onParse,
  loading,
  onChange,
  value,
}: Props) {
  const t = useTranslations("Boards");
  return (
    <div>
      <label className="label">Url</label>
      <div className="join w-full">
        <div className="w-full">
          <label className="input validator join-item w-full">
            <svg
              className="h-[1em] opacity-50"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
            >
              <g
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeWidth="2.5"
                fill="none"
                stroke="currentColor"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </g>
            </svg>
            <input
              type="url"
              placeholder="https://"
              value={value}
              pattern="^(https?://)?([a-zA-Z0-9]([a-zA-Z0-9\-].*[a-zA-Z0-9])?\.)+[a-zA-Z].*$"
              title="Must be valid URL"
              className="w-full"
              onChange={(e) => onChange(e.target.value)}
            />
          </label>
          <div className="validator-hint hidden">{t("urlValidError")}</div>
        </div>
        <button
          type="button"
          className="btn btn-neutral join-item"
          disabled={loading}
          onClick={onParse}
        >
          {loading && (
            <span className="loading loading-spinner loading-sm"></span>
          )}
          {t("getMetadata")}
        </button>
      </div>
    </div>
  );
}
