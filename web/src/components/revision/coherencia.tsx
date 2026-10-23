"use client";

import { Check, CircleSlash } from "lucide-react";
import { formatCifra } from "@/lib/format";
import { cx } from "@/components/ui/base";

interface Termino {
  key: string;
  label: string;
  signo: "" | "−" | "+";
}

const PRUEBAS: { titulo: string; base: Termino; restas: Termino[] }[] = [
  {
    titulo: "Activo = Pasivo + Patrimonio",
    base: { key: "activo_total", label: "Activo total", signo: "" },
    restas: [
      { key: "pasivo_total", label: "Pasivo total", signo: "−" },
      { key: "patrimonio", label: "Patrimonio", signo: "−" },
    ],
  },
  {
    titulo: "Recaudo − Obligaciones = Superávit",
    base: { key: "recaudo", label: "Recaudo", signo: "" },
    restas: [
      { key: "obligaciones", label: "Obligaciones", signo: "−" },
      { key: "superavit", label: "Superávit", signo: "−" },
    ],
  },
];

/**
 * Prueba contable en vivo: se recalcula con los valores vigentes, de modo que
 * corregir una cifra mal leída hace cuadrar el estado frente al estudiante.
 */
export function Coherencia({
  valor,
  onSeleccionar,
  activa,
}: {
  valor: (key: string) => string | null;
  onSeleccionar: (key: string) => void;
  activa: string | null;
}) {
  return (
    <div className="grid shrink-0 grid-cols-1 gap-x-6 gap-y-3 border-t border-line bg-paper px-4 py-3 sm:grid-cols-2">
      {PRUEBAS.map((p) => {
        const nums = [p.base, ...p.restas].map((t) => valor(t.key));
        const completo = nums.every((n) => n !== null);
        const dif = completo ? nums.slice(1).reduce((a, n) => a - Number(n), Number(nums[0])) : null;
        const cuadra = dif === 0;
        return (
          <section key={p.titulo} aria-label={p.titulo} className="min-w-0">
            <h3 className="mb-1 text-2xs font-semibold text-ink-3">{p.titulo}</h3>
            <dl className="cifra grid grid-cols-[auto_1fr] gap-x-3 text-xs">
              {[p.base, ...p.restas].map((t, i) => (
                <div key={t.key} className="contents">
                  <dt className="text-ink-2">
                    <span className="inline-block w-2.5 text-ink-3">{t.signo}</span>
                    {t.label}
                  </dt>
                  <dd className="text-right">
                    <button
                      type="button"
                      onClick={() => onSeleccionar(t.key)}
                      className={cx(
                        "rounded-sm px-0.5 font-semibold hover:bg-sello-bg",
                        activa === t.key ? "text-sello" : "text-ink",
                      )}
                    >
                      {nums[i] === null ? "—" : formatCifra(nums[i])}
                    </button>
                  </dd>
                </div>
              ))}
              <dt className="regla-simple mt-0.5 pt-0.5 font-semibold text-ink">Diferencia</dt>
              <dd className="regla-simple mt-0.5 pt-0.5 text-right">
                <span className={cx("doble-regla inline-flex items-center gap-1 font-bold", cuadra ? "text-verde" : "text-rojo")}>
                  {dif === null ? "incompleto" : formatCifra(dif)}
                  {dif !== null &&
                    (cuadra ? (
                      <Check className="size-3" strokeWidth={3} aria-label="Cuadra" />
                    ) : (
                      <CircleSlash className="size-3" strokeWidth={2.5} aria-label="No cuadra" />
                    ))}
                </span>
              </dd>
            </dl>
          </section>
        );
      })}
    </div>
  );
}
