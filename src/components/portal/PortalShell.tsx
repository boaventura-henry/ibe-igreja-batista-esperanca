"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useMobileMenu } from "@/hooks";
import { isRouteActive } from "@/utils";
import { LogoutButton } from "@/components/LogoutButton";

const portalNavigation = [
  { href: "/portal", label: "Inicio" },
  { href: "/portal/minhas-escalas", label: "Minhas Escalas" },
  { href: "/portal/minhas-contribuicoes", label: "Minhas Contribuicoes" },
  { href: "/portal/meu-cadastro", label: "Meu Cadastro" },
  { href: "/portal/meus-ministerios", label: "Meus Ministerios" },
  { href: "/portal/eventos", label: "Eventos" },
  { href: "/portal/avisos", label: "Avisos" }
] as const;

const adminPermissions = [
  "member.create",
  "member.update",
  "member.delete",
  "user.view",
  "accessRole.view",
  "ministry.create",
  "ministry.update",
  "ministry.delete",
  "memberMinistry.create",
  "memberMinistry.update",
  "memberMinistry.delete",
  "schedule.create",
  "schedule.update",
  "schedule.delete",
  "schedule.publish",
  "schedule.cancel",
  "schedule.complete",
  "event.create",
  "event.update",
  "event.delete",
  "event.publish",
  "event.cancel",
  "event.complete",
  "financialCategory.view",
  "financialEntry.view",
  "financialClosing.view",
  "accessRequest.view",
  "accessRequest.approve",
  "accessRequest.reject"
];

export function PortalShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const mobileMenu = useMobileMenu();
  const permissionCodes = session?.user.permissionCodes ?? [];
  const canAccessAdmin = adminPermissions.some((permission) => permissionCodes.includes(permission));

  return (
    <div className="min-h-screen bg-[#f7faf8] text-ink-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-hope-100 bg-white px-5 py-6 shadow-soft lg:block">
        <Brand />
        <Navigation pathname={pathname} />
        <div className="absolute inset-x-5 bottom-6 grid gap-2">
          {canAccessAdmin ? (
            <Link href="/dashboard" className="rounded-md border border-hope-100 px-3 py-3 text-center text-sm font-bold text-ink-700 transition hover:bg-hope-50 hover:text-hope-700">
              Area Administrativa
            </Link>
          ) : null}
          <LogoutButton className="flex w-full items-center justify-center rounded-md border border-hope-100 px-3 py-3 text-sm font-bold text-ink-700 transition hover:bg-hope-50 hover:text-hope-700" />
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-hope-100 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <Brand compact />
        <button
          type="button"
          aria-label={mobileMenu.isOpen ? "Fechar menu" : "Abrir menu"}
          onClick={mobileMenu.toggle}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-hope-100 text-sm font-semibold text-ink-900"
        >
          {mobileMenu.isOpen ? "Fechar" : "Menu"}
        </button>
      </header>

      {mobileMenu.isOpen ? (
        <div className="fixed inset-x-0 top-[69px] z-20 border-b border-hope-100 bg-white px-4 py-4 shadow-soft lg:hidden">
          <Navigation pathname={pathname} onNavigate={mobileMenu.close} />
          {canAccessAdmin ? (
            <Link href="/dashboard" onClick={mobileMenu.close} className="mt-2 block rounded-md border border-hope-100 px-3 py-3 text-center text-sm font-bold text-ink-700">
              Area Administrativa
            </Link>
          ) : null}
          <LogoutButton className="mt-2 flex w-full items-center justify-center rounded-md border border-hope-100 px-3 py-3 text-sm font-bold text-ink-700 transition hover:bg-hope-50 hover:text-hope-700" />
        </div>
      ) : null}

      <main className="lg:pl-72">
        <div className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/portal" className="flex items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-hope-600 text-lg font-bold text-white">
        IBE
      </span>
      {!compact ? (
        <span>
          <span className="block text-sm font-bold uppercase tracking-wide text-hope-700">Portal do Membro</span>
          <span className="block text-lg font-semibold text-ink-900">Igreja Batista Esperanca</span>
        </span>
      ) : (
        <span className="text-base font-semibold text-ink-900">Portal IBE</span>
      )}
    </Link>
  );
}

function Navigation({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="mt-8 grid gap-2">
      {portalNavigation.map((item) => {
        const active = isRouteActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`rounded-md px-3 py-3 text-sm font-semibold transition ${
              active ? "bg-hope-600 text-white shadow-sm" : "text-ink-700 hover:bg-hope-50 hover:text-hope-700"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
