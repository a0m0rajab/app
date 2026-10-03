"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Chat" },
  { href: "/video", label: "Video" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="mx-auto flex w-full max-w-3xl items-center gap-1 border-b border-black/10 px-4 py-3 dark:border-white/10">
      <span className="mr-4 font-semibold">Gemini Studio</span>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`rounded-lg px-3 py-1.5 text-sm ${
            pathname === link.href ? "bg-black/10 font-medium dark:bg-white/15" : "opacity-60 hover:opacity-100"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
