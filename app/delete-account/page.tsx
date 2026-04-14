import { Metadata } from "next";
import { DeleteAccountForm } from "./DeleteAccountForm";

export const metadata: Metadata = {
  title: "Ištrinti paskyrą",
  robots: { index: false, follow: false },
};

export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-secondary/20 via-base-100 to-[#FFE035] px-4">
      <div className="card bg-base-100 w-full max-w-sm shadow-2xl">
        <div className="card-body">
          <h1 className="card-title text-2xl font-bold text-error">
            Ištrinti paskyrą
          </h1>
          <DeleteAccountForm />
        </div>
      </div>
    </main>
  );
}
