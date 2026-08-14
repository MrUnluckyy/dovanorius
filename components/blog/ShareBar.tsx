"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

type Props = {
  url: string;
  title: string;
  labels: {
    share: string;
    copyLink: string;
    copied: string;
    copyFailed: string;
  };
};

/**
 * Article share controls: copy-to-clipboard plus the device share sheet. The
 * native button only renders once we know `navigator.share` exists, which is
 * checked after mount so it never mismatches the server-rendered markup.
 */
export default function ShareBar({ url, title, labels }: Props) {
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(labels.copied);
    } catch {
      // Clipboard can be blocked (permissions, insecure context).
      toast.error(labels.copyFailed);
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, url });
    } catch (err) {
      // The user dismissing the sheet rejects with AbortError — not an error.
      if ((err as Error)?.name !== "AbortError") {
        console.error(err);
      }
    }
  }

  return (
    <div className="border-base-300/60 mt-12 flex flex-wrap items-center gap-2 border-t pt-6">
      <span className="text-base-content/60 mr-1 text-sm font-medium">
        {labels.share}
      </span>

      <button
        type="button"
        onClick={copyLink}
        className="btn btn-sm btn-outline gap-2"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="size-4"
          aria-hidden
        >
          <path d="M8.75 4.5a2.75 2.75 0 0 0-2.75 2.75v6.5A2.75 2.75 0 0 0 8.75 16.5h4.5A2.75 2.75 0 0 0 16 13.75v-6.5A2.75 2.75 0 0 0 13.25 4.5h-4.5Z" />
          <path d="M4.5 6.75A2.75 2.75 0 0 1 6.75 4.06V3.75A1.75 1.75 0 0 0 5 5.5v6.5a1.75 1.75 0 0 0 1.75 1.75h.19A2.75 2.75 0 0 1 4.5 11.25v-4.5Z" />
        </svg>
        {labels.copyLink}
      </button>

      {canShare && (
        <button
          type="button"
          onClick={nativeShare}
          className="btn btn-sm btn-outline gap-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="size-4"
            aria-hidden
          >
            <path d="M13 4.5a2.5 2.5 0 1 1 .702 1.737L6.97 9.604a2.518 2.518 0 0 1 0 .792l6.733 3.367a2.5 2.5 0 1 1-.671 1.341l-6.733-3.367a2.5 2.5 0 1 1 0-3.475l6.733-3.366A2.52 2.52 0 0 1 13 4.5Z" />
          </svg>
          {labels.share}
        </button>
      )}
    </div>
  );
}
