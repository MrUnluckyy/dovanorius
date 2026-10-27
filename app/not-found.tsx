import Link from "next/link";
import { NotFoundBeacon } from "@/components/feedback/NotFoundBeacon";

export default function NotFound() {
  return (
    <main className="font-body flex justify-center items-center min-h-screen">
      <NotFoundBeacon />
      <div>
        <h3 className="text-8xl font-bold font-heading">404</h3>
        <h2 className="text-2xl font-bold mb-4">🗒️ Pasibaigė puslapiai...</h2>
        <p>Šis puslapis neegzistuoja.</p>
        <p>Bet norai - visada!</p>
        <Link href="/" className="btn btn-primary mt-4">
          Į pagrindinį
        </Link>
      </div>
    </main>
  );
}
