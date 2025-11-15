"use client";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import React, { useEffect, useState } from "react";

const themes = ["retro", "silk", "forest", "cmyk", "business"];

export default function ThemeSelector() {
  const { setTheme, theme: selectedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const t = useTranslations("Profile");
  useEffect(() => setMounted(true), []);

  if (!mounted) return null; // avoid hydration mismatch

  return (
    <div className="my-4">
      <p className="mb-2">{t("pickTheme")}</p>
      <div className="join join-horizontal">
        {themes.map((theme) => (
          <input
            key={theme}
            type="radio"
            name="theme-buttons"
            className="btn theme-controller join-item"
            aria-label={theme}
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          />
        ))}
      </div>
    </div>
  );
}
