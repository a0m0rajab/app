"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/launch", label: "Launch" },
  { href: "/founder", label: "Founder" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="w-full shrink-0 border-b border-line font-display dark:border-white/10">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-4 py-4 sm:px-14 sm:py-6">
        <Link href="/launch" className="flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sun">
            <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden>
              <path d="M1 1 L11 7 L1 13 Z" fill="#0E0E0E" />
            </svg>
          </span>
          <span className="text-xl/6 font-extrabold tracking-[-0.02em]">SupaFastLaunch</span>
        </Link>
        <div className="flex items-center gap-5 sm:gap-8">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm/4.5 font-medium ${
                pathname === link.href ? "text-ink dark:text-white" : "text-muted hover:text-ink dark:hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
