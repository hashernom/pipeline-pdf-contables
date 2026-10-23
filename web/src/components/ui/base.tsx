import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");

type Variante = "primario" | "secundario" | "fantasma" | "peligro";
type Tamano = "sm" | "md";

const VARIANTE: Record<Variante, string> = {
  primario: "bg-rail text-rail-ink hover:bg-rail-2 active:bg-[#173029] border border-rail",
  secundario: "bg-sheet text-ink border border-line-strong hover:border-ink-3 hover:bg-paper active:bg-panel",
  fantasma: "text-ink-2 hover:bg-panel hover:text-ink border border-transparent",
  peligro: "bg-sheet text-rojo border border-rojo-line hover:bg-rojo-bg",
};
const TAMANO: Record<Tamano, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5",
  md: "h-8.5 px-3.5 text-[0.8125rem] gap-2",
};

const clasesBoton = (v: Variante, t: Tamano, extra?: string) =>
  cx(
    "inline-flex select-none items-center justify-center rounded-md font-semibold whitespace-nowrap",
    "transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45",
    VARIANTE[v],
    TAMANO[t],
    extra,
  );

export function Boton({
  variante = "secundario",
  tamano = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variante?: Variante; tamano?: Tamano }) {
  return <button type="button" className={clasesBoton(variante, tamano, className)} {...props} />;
}

export function BotonLink({
  variante = "secundario",
  tamano = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variante?: Variante; tamano?: Tamano }) {
  return <Link className={clasesBoton(variante, tamano, className)} {...props} />;
}

/** Tecla de atajo. */
export function Kbd({ children, oscuro = false }: { children: ReactNode; oscuro?: boolean }) {
  return (
    <kbd
      className={cx(
        "inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-[3px] border px-1 font-sans text-[0.625rem] font-semibold leading-none",
        oscuro ? "border-white/25 bg-white/10 text-current" : "border-line-strong bg-sheet text-ink-2 shadow-[0_1px_0_var(--color-line-strong)]",
      )}
    >
      {children}
    </kbd>
  );
}

/** Encabezado de página de trabajo: título + descripción corta + acciones. */
export function Encabezado({
  titulo,
  descripcion,
  acciones,
  migas,
}: {
  titulo: string;
  descripcion?: ReactNode;
  acciones?: ReactNode;
  migas?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-line pb-4">
      <div className="min-w-0">
        {migas && <div className="mb-1.5 text-xs text-ink-3">{migas}</div>}
        <h1 className="text-[1.375rem] font-bold leading-tight tracking-[-0.01em] text-ink">{titulo}</h1>
        {descripcion && <p className="mt-1 max-w-[70ch] text-[0.8125rem] text-ink-2">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </header>
  );
}

/** Contenedor de página del área de trabajo. */
export function Pagina({ children, ancho = "normal" }: { children: ReactNode; ancho?: "normal" | "amplio" }) {
  return (
    <div className={cx("mx-auto w-full px-6 py-6 lg:px-8", ancho === "normal" ? "max-w-[1240px]" : "max-w-[1560px]")}>
      {children}
    </div>
  );
}

/** Hoja: superficie blanca para tablas y formularios. Nunca anidada. */
export function Hoja({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("relative rounded-md border border-line bg-sheet", className)}>{children}</section>;
}

export function TituloSeccion({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="text-[0.9375rem] font-bold text-ink">{children}</h2>
      {extra && <div className="text-xs text-ink-3">{extra}</div>}
    </div>
  );
}

/** Barra de avance delgada (no anillo). */
export function Avance({ valor, total, tono = "rail" }: { valor: number; total: number; tono?: "rail" | "verde" }) {
  const pct = total > 0 ? Math.min(100, (valor / total) * 100) : 0;
  return (
    <span
      className="block h-1 w-full overflow-hidden rounded-full bg-panel"
      role="progressbar"
      aria-valuenow={valor}
      aria-valuemin={0}
      aria-valuemax={total}
    >
      <span className={cx("block h-full rounded-full", tono === "rail" ? "bg-rail" : "bg-verde")} style={{ width: `${pct}%` }} />
    </span>
  );
}

export function Vacio({ titulo, children, accion }: { titulo: string; children?: ReactNode; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 px-6 py-10">
      <p className="text-sm font-semibold text-ink">{titulo}</p>
      {children && <div className="max-w-[60ch] text-[0.8125rem] text-ink-2">{children}</div>}
      {accion && <div className="mt-2">{accion}</div>}
    </div>
  );
}

export function Etiqueta({ children, tono = "neutro" }: { children: ReactNode; tono?: "neutro" | "sello" | "rojo" }) {
  // Marca tipográfica, como una llamada de nota en un estado: sin fondo de color.
  const t = { neutro: "text-ink-3", sello: "text-sello", rojo: "text-rojo" }[tono];
  return <span className={cx("inline-flex items-center gap-1 text-2xs font-semibold", t)}>{children}</span>;
}
