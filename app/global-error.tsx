"use client";

import { useEffect } from "react";
import "./globals.css";

// global-error.tsx replaces the root layout, so it must render its own
// <html>/<body>. It only catches errors thrown in the root layout itself.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="lt" data-theme="noriuto">
      <body className="antialiased">
        <main className="flex justify-center items-center min-h-screen px-6">
          <div className="text-center">
            <h3 className="text-8xl font-bold">😵</h3>
            <h2 className="text-2xl font-bold mb-4 mt-2">Kažkas nepavyko...</h2>
            <p>Įvyko nenumatyta klaida.</p>
            <button className="btn btn-primary mt-6" onClick={() => reset()}>
              Bandyti dar kartą
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
