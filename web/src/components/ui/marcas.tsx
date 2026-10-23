import { Check, CircleSlash, OctagonX, TriangleAlert, Minus } from "lucide-react";
import type { ResultadoCheck, Semaforo } from "@/lib/types";
import { SEMAFORO } from "@/lib/etapas";

const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");

const TONO: Record<Semaforo, string> = {
  verde: "text-verde",
  amarillo: "text-ambar",
  rojo: "text-rojo",
};

const FONDO: Record<Semaforo, string> = {
  verde: "bg-verde-bg text-verde",
  amarillo: "bg-ambar-bg text-ambar",
  rojo: "bg-rojo-bg text-rojo",
};

export function IconoSemaforo({ s, className }: { s: Semaforo; className?: string }) {
  const Icon = s === "verde" ? Check : s === "amarillo" ? TriangleAlert : OctagonX;
  return <Icon aria-hidden className={cx("size-3.5 shrink-0", TONO[s], className)} strokeWidth={2.25} />;
}

/** Semáforo legible sin color: glifo + palabra. */
export function MarcaSemaforo({ s, compacto = false, className }: { s: Semaforo; compacto?: boolean; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-sm font-semibold",
        compacto ? "text-2xs" : "px-1.5 py-0.5 text-2xs",
        !compacto && FONDO[s],
        compacto && TONO[s],
        className,
      )}
    >
      <IconoSemaforo s={s} className="size-3" />
      {SEMAFORO[s].nombre}
    </span>
  );
}

/** Conteo rojo · amarillo · verde de un documento, en el orden de atención. */
export function ConteoSemaforo({ conteo, vacio = "—" }: { conteo: Record<Semaforo, number>; vacio?: string }) {
  const total = conteo.rojo + conteo.amarillo + conteo.verde;
  if (total === 0) return <span className="text-ink-3">{vacio}</span>;
  return (
    <span className="cifra inline-flex items-center gap-2.5 text-xs">
      {(["rojo", "amarillo", "verde"] as const).map((s) => (
        <span
          key={s}
          className={cx("inline-flex items-center gap-0.5", conteo[s] === 0 && "opacity-35")}
          title={`${conteo[s]} en ${SEMAFORO[s].nombre.toLowerCase()}`}
        >
          <IconoSemaforo s={s} className="size-3" />
          <span className={cx("font-semibold", TONO[s])}>{conteo[s]}</span>
        </span>
      ))}
    </span>
  );
}

/** Marca de auditoría de una verificación individual. */
export function MarcaCheck({ r, className }: { r: ResultadoCheck; className?: string }) {
  const props = { "aria-hidden": true, strokeWidth: 2.5, className: cx("size-3.5 shrink-0", className) } as const;
  switch (r) {
    case "pasa":
      return <Check {...props} className={cx(props.className, "text-verde")} />;
    case "alerta":
      return <TriangleAlert {...props} strokeWidth={2.25} className={cx(props.className, "text-ambar")} />;
    case "falla":
      return <CircleSlash {...props} strokeWidth={2.25} className={cx(props.className, "text-rojo")} />;
    default:
      return <Minus {...props} className={cx(props.className, "text-ink-3")} />;
  }
}

export const NOMBRE_RESULTADO: Record<ResultadoCheck, string> = {
  pasa: "Pasa",
  alerta: "Alerta",
  falla: "Falla",
  no_aplica: "No aplica",
};
