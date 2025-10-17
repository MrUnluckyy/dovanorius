import { Navigation } from "@/components/navigation/Navigation";
import { UserBar } from "../components/UserBar";
import { WishList } from "./components/WishList";

export default function WishlistPage() {
  return (
    <main>
      <Navigation />

      <div className="max-w-[1400px] mx-auto min-h-screen">
        <div className="py-8 mb-10">
          <UserBar />
        </div>

        <WishList />
      </div>
    </main>
  );
}
