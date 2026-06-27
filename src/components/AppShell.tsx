"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useMobileMenu } from "@/hooks";
import { navigationItems } from "@/lib/navigation";
import { isRouteActive } from "@/utils";
import { LogoutButton } from "./LogoutButton";

const iconMap: Record<(typeof navigationItems)[number]["icon"], string> = {
  Inicio: "I",
  Pessoas: "P",
  Chaves: "#",
  Usuarios: "U",
  Servir: "+",
  Agenda: "A",
  Dizimos: "$"
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const mobileMenu = useMobileMenu();
  const permissionCodes = session?.user.permissionCodes ?? [];

  return (
    <div className="min-h-screen bg-[#f7faf8] text-ink-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-hope-100 bg-white px-5 py-6 shadow-soft lg:block">
        <Brand />
        <Navigation pathname={pathname} permissionCodes={permissionCodes} />
        <div className="absolute inset-x-5 bottom-6">
          <LogoutButton className="flex w-full items-center justify-center rounded-md border border-hope-100 px-3 py-3 text-sm font-bold text-ink-700 transition hover:bg-hope-50 hover:text-hope-700" />
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-hope-100 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <Brand compact />
        <button
          type="button"
          aria-label={mobileMenu.isOpen ? "Fechar menu" : "Abrir menu"}
          onClick={mobileMenu.toggle}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-hope-100 text-xl font-semibold text-ink-900"
        >
          {mobileMenu.isOpen ? "x" : "menu"}
        </button>
      </header>

      {mobileMenu.isOpen ? (
        <div className="fixed inset-x-0 top-[69px] z-20 border-b border-hope-100 bg-white px-4 py-4 shadow-soft lg:hidden">
          <Navigation
            pathname={pathname}
            permissionCodes={permissionCodes}
            onNavigate={mobileMenu.close}
          />
          <LogoutButton className="mt-2 flex w-full items-center justify-center rounded-md border border-hope-100 px-3 py-3 text-sm font-bold text-ink-700 transition hover:bg-hope-50 hover:text-hope-700" />
        </div>
      ) : null}

      <main className="lg:pl-72">
        <div className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-hope-600 text-lg font-bold text-white">
        IBE
      </span>
      {!compact ? (
        <span>
          <span className="block text-sm font-bold uppercase tracking-wide text-hope-700">
            Igreja Batista
          </span>
          <span className="block text-lg font-semibold text-ink-900">Esperanca</span>
        </span>
      ) : (
        <span className="text-base font-semibold text-ink-900">IBE Esperanca</span>
      )}
    </Link>
  );
}

function Navigation({
  pathname,
  permissionCodes,
  onNavigate
}: {
  pathname: string;
  permissionCodes: string[];
  onNavigate?: () => void;
}) {
  return (
    <nav className="mt-8 grid gap-2">
      {navigationItems
        .filter((item) => !("permission" in item) || permissionCodes.includes(item.permission))
        .map((item) => {
          const active = isRouteActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold transition ${
                active
                  ? "bg-hope-600 text-white shadow-sm"
                  : "text-ink-700 hover:bg-hope-50 hover:text-hope-700"
              }`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-md text-sm ${
                  active ? "bg-white/15" : "bg-hope-50 text-hope-700"
                }`}
                aria-hidden="true"
              >
                {iconMap[item.icon]}
              </span>
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}
