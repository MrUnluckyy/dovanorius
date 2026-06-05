"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error to the console / monitoring.
    console.error(error);
  }, [error]);

  return (
    <main className="font-body flex justify-center items-center min-h-screen px-6">
      <div className="text-center">
        <h3 className="text-8xl font-bold font-heading">😵</h3>
        <h2 className="text-2xl font-bold mb-4 mt-2">Kažkas nepavyko...</h2>
        <p>Įvyko nenumatyta klaida.</p>
        <p>Pabandyk dar kartą — norai niekur nedingo!</p>
        <div className="flex gap-2 justify-center mt-6">
          <button className="btn btn-primary" onClick={() => reset()}>
            Bandyti dar kartą
          </button>
          <Link href="/" className="btn btn-ghost">
            Į pagrindinį
          </Link>
        </div>
      </div>
    </main>
  );
}
