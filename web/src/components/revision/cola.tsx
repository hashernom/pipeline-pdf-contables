"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCheck, X } from "lucide-react";
import type { Documento } from "@/lib/types";
import { formatFecha, formatNit } from "@/lib/format";
import { Avance, Hoja, Kbd, TituloSeccion, Vacio, cx } from "@/components/ui/base";
import { ConteoSemaforo } from "@/components/ui/marcas";

interface Progreso {
  resueltas: number;
  enviado: boolean;
}

// Lee el avance guardado por la vista de revisión (mock en localStorage). La foto
// es un texto para que useSyncExternalStore compare por valor; en el servidor no hay.
function fotoLocal(ids: string[]): string {
  try {
    return JSON.stringify([
      localStorage.getItem("folio:enviados"),
      ...ids.map((id) => localStorage.getItem(`folio:revision:${id}`)),
    ]);
  } catch {
    return "";
  }
}

function useProgresoLocal(docs: Documento[]) {
  const ids = docs.map((d) => d.id);
  const foto = useSyncExternalStore(
    (f) => {
      window.addEventListener("storage", f);
      return () => window.removeEventListener("storage", f);
    },
    () => fotoLocal(ids),
    () => "",
  );
  return useMemo(() => {
    const out: Record<string, Progreso> = {};
    if (!foto) return out;
    const [enviadosRaw, ...revs] = JSON.parse(foto) as (string | null)[];
    const enviados = new Set(enviadosRaw ? (JSON.parse(enviadosRaw) as string[]) : []);
    docs.forEach((d, i) => {
      out[d.id] = { resueltas: revs[i] ? Object.keys(JSON.parse(revs[i]!)).length : d.revisadas, enviado: enviados.has(d.id) };
    });
    return out;
  }, [foto, docs]);
}

export function Cola({ enRevision, enviados }: { enRevision: Documento[]; enviados: Documento[] }) {
  const progreso = useProgresoLocal(enRevision);
  const params = useSearchParams();
  const [aviso, setAviso] = useState<string | null>(params.get("enviado"));

  const activos = enRevision.filter((d) => !progreso[d.id]?.enviado);
  const recienEnviados = enRevision.filter((d) => progreso[d.id]?.enviado);
  // Primero lo que más atención pide: más rojos, luego más amarillos.
  const ordenados = [...activos].sort((a, b) => b.conteo.rojo - a.conteo.rojo || b.conteo.amarillo - a.conteo.amarillo);
  const siguiente = ordenados[0];
  const docAviso = aviso && enRevision.find((d) => d.id === aviso);

  return (
    <div className="grid grid-cols-1 gap-8">
      {docAviso && (
        <div role="status" className="aparece flex items-center gap-3 rounded-md border border-verde-line bg-verde-bg px-4 py-2.5 text-[0.8125rem] text-verde">
          <CheckCheck className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">
            <b>{docAviso.entidad}</b> quedó en el dataset. Sus correcciones están en el registro.
          </span>
          <button type="button" onClick={() => setAviso(null)} className="rounded p-0.5 hover:bg-verde/10" aria-label="Cerrar aviso">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <section>
        <TituloSeccion extra={activos.length > 0 && "Ordenado por atención: rojo, luego amarillo"}>En revisión</TituloSeccion>
        <Hoja className="overflow-x-auto">
          {ordenados.length === 0 ? (
            <Vacio titulo="No tiene documentos pendientes.">
              Cuando coordinación le asigne PDFs procesados aparecerán aquí, ordenados por los que más atención necesitan.
            </Vacio>
          ) : (
            <table className="w-full min-w-[600px] text-[0.8125rem]">
              <thead>
                <tr className="border-b border-line">
                  <th className="th py-2 pl-4">Entidad</th>
                  <th className="th hidden py-2 md:table-cell">NIT</th>
                  <th className="th py-2 text-right">Vigencia</th>
                  <th className="th py-2 pl-6">Por color</th>
                  <th className="th w-44 py-2 pl-6">Avance</th>
                  <th className="py-2 pr-4"><span className="sr-only">Abrir</span></th>
                </tr>
              </thead>
              <tbody>
                {ordenados.map((d) => {
                  const r = progreso[d.id]?.resueltas ?? d.revisadas;
                  return (
                    <tr key={d.id} className="group relative border-b border-line last:border-b-0 hover:bg-paper">
                      <td className="py-3 pl-4">
                        <Link href={`/revision/${d.id}`} className="font-semibold text-ink after:absolute after:inset-0">
                          {d.entidad}
                        </Link>
                        <span className="block text-xs text-ink-3">
                          {d.departamento} · {d.folios} folios{d.foliosEscaneados > 0 && `, ${d.foliosEscaneados} escaneados`}
                        </span>
                      </td>
                      <td className="cifra hidden py-3 text-ink-2 md:table-cell">{formatNit(d.nit)}</td>
                      <td className="cifra py-3 text-right text-ink-2">{d.vigencia}</td>
                      <td className="py-3 pl-6">
                        <ConteoSemaforo conteo={d.conteo} />
                      </td>
                      <td className="py-3 pl-6">
                        <span className="cifra mb-1 block text-xs text-ink-2">
                          {r} de {d.totalVariables}
                        </span>
                        <Avance valor={r} total={d.totalVariables} />
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <ArrowRight className="ml-auto size-4 text-ink-3 group-hover:text-ink" aria-hidden />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Hoja>
        {siguiente && (
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
            En la revisión, <Kbd>J</Kbd> <Kbd>K</Kbd> recorren las variables, <Kbd>↵</Kbd> confirma y <Kbd>?</Kbd> muestra todos los
            atajos.
          </p>
        )}
      </section>

      <section>
        <TituloSeccion extra={`${enviados.length + recienEnviados.length} documentos`}>Enviados al dataset</TituloSeccion>
        <Hoja>
          <ul>
            {[...recienEnviados, ...enviados].map((d) => (
              <li key={d.id} className="flex items-center gap-4 border-b border-line px-4 py-2.5 text-[0.8125rem] last:border-b-0">
                <CheckCheck className={cx("size-3.5 shrink-0 text-verde")} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-ink-2">
                  <span className="font-semibold text-ink">{d.entidad}</span> · {d.departamento}
                </span>
                <span className="cifra text-xs text-ink-3">Vigencia {d.vigencia}</span>
                <span className="cifra hidden w-24 text-right text-xs text-ink-3 sm:block">
                  {progreso[d.id]?.enviado ? "hoy" : formatFecha(d.actualizadoEl)}
                </span>
              </li>
            ))}
          </ul>
        </Hoja>
      </section>
    </div>
  );
}
