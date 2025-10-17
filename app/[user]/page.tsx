import { SimpleHero } from "@/components/hero/SimpleHero";
import { Navigation } from "@/components/navigation/Navigation";

export default function Home() {
  return (
    <>
      <Navigation />
      <main>
        <div className="min-h-svh flex justify-center items-center">
          <h2 className="text-2xl">User Details Page</h2>
        </div>
      </main>
    </>
  );
}
