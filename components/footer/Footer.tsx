"use client";

import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer footer-horizontal footer-center bg-secondary text-secondary-content p-10">
      <aside>
        <Image src="/assets/logo.png" alt="noriu.lt" width={100} height={100} />
        <p className="font-bold">
          Noriuto.lt
          <br />
          Tavo norų partneris!
        </p>
      </aside>
      <nav className="flex flex-col md:flex-row gap-4">
        <Link href={"/privatumo-politika"}>Privatumo Politika</Link>
        <Link href={"/slapuku-politika"}>Slapukų Politika</Link>
        <Link href={"/naudojimo-politika"}>Naudojimo Politika</Link>
        <Link href={"/atsakomybes-apribojimas"}>Atsakomybes Apribojimas</Link>
      </nav>
      <p>© {new Date().getFullYear()} Noriuto.lt. Visos teisės saugomos.</p>
    </footer>
  );
}
