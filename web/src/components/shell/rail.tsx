"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  ClipboardCheck,
  Database,
  FileStack,
  Gauge,
  History,
  Inbox,
  ListChecks,
  Tags,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cx } from "@/components/ui/base";
import type { Role } from "@/lib/types";

interface Item {
  href: string;
  label: string;
  icon: LucideIcon;
  exacto?: boolean;
}

const NAV: Record<Role, Item[]> = {
  estudiante: [
    { href: "/revision", label: "Mi cola", icon: Inbox },
    { href: "/revision/historial", label: "Enviados", icon: History },
  ],
  coordinador: [
    { href: "/coordinacion", label: "Lote", icon: Gauge, exacto: true },
    { href: "/coordinacion/documentos", label: "Documentos", icon: FileStack },
    { href: "/coordinacion/ingesta", label: "Ingesta", icon: Upload },
    { href: "/coordinacion/asignacion", label: "Asignación", icon: Users },
    { href: "/coordinacion/auditoria", label: "Auditoría", icon: ClipboardCheck },
    { href: "/coordinacion/correcciones", label: "Registro", icon: ListChecks },
    { href: "/coordinacion/variables", label: "Variables", icon: Tags },
    { href: "/coordinacion/dataset", label: "Dataset", icon: Database },
  ],
};

export function Rail({ rol, usuario }: { rol: Role; usuario: { nombre: string; iniciales: string } }) {
  const pathname = usePathname();
  const activo = (it: Item) =>
    it.exacto ? pathname === it.href : pathname === it.href || (pathname.startsWith(it.href + "/") && !NAV[rol].some((o) => o !== it && o.href.length > it.href.length && pathname.startsWith(o.href)));

  return (
    <nav
      aria-label="Navegación principal"
      className="sticky top-0 flex h-dvh w-[84px] shrink-0 flex-col items-stretch bg-rail text-rail-ink max-md:fixed max-md:inset-x-0 max-md:top-auto max-md:bottom-0 max-md:z-40 max-md:h-14 max-md:w-full max-md:flex-row"
    >
      <Link
        href={rol === "estudiante" ? "/revision" : "/coordinacion"}
        className="flex flex-col items-center gap-0.5 px-2 pt-4 pb-3 max-md:hidden"
        aria-label="Folio, inicio"
      >
        <span className="text-[1.0625rem] font-extrabold tracking-[-0.02em] leading-none">Folio</span>
        <span className="text-[0.5625rem] font-semibold tracking-[0.06em] text-rail-muted">DEMO</span>
      </Link>

      <ul className="mt-2 flex flex-1 flex-col gap-0.5 px-2 max-md:mt-0 max-md:flex-row max-md:items-center max-md:overflow-x-auto max-md:px-1">
        {NAV[rol].map((it) => {
          const on = activo(it);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={on ? "page" : undefined}
                className={cx(
                  "group flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[0.6875rem] font-semibold leading-none transition-colors duration-150 max-md:min-w-[68px] max-md:py-1.5",
                  on ? "bg-rail-2 text-white" : "text-rail-muted hover:bg-white/6 hover:text-rail-ink",
                )}
              >
                <it.icon aria-hidden className="size-[18px]" strokeWidth={on ? 2.25 : 1.85} />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col items-center gap-2 border-t border-white/10 px-2 py-3 max-md:hidden">
        <span
          className="flex size-8 items-center justify-center rounded-full bg-rail-2 text-[0.6875rem] font-bold"
          title={`${usuario.nombre} · ${rol === "estudiante" ? "Estudiante" : "Coordinación"}`}
        >
          {usuario.iniciales}
        </span>
        <Link
          href="/"
          className="flex items-center gap-1 rounded px-1 py-0.5 text-[0.625rem] font-semibold text-rail-muted hover:text-rail-ink"
        >
          <ArrowLeftRight aria-hidden className="size-3" />
          Rol
        </Link>
      </div>
    </nav>
  );
}
