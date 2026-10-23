"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import type { Variable } from "@/lib/types";
import type { FilaDataset } from "@/lib/data";
import { aCsv, descargar } from "@/lib/csv";
import { formatValor } from "@/lib/format";
import { Boton, Hoja, cx } from "@/components/ui/base";

const BASICAS = ["vigencia", "opinion", "activo_total", "pasivo_total", "patrimonio", "recaudo", "superavit", "ley617", "chip"];

export function Dataset({ filas, variables }: { filas: FilaDataset[]; variables: Variable[] }) {
  const [todas, setTodas] = useState(false);
  const [q, setQ] = useState("");
  const columnas = useMemo(
    () => variables.filter((v) => v.key !== "entidad" && (todas ? true : BASICAS.includes(v.key))),
    [variables, todas],
  );
  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? filas.filter((f) => `${f.documento.entidad} ${f.documento.departamento}`.toLowerCase().includes(t)) : filas;
  }, [filas, q]);

  const exportar = () =>
    descargar(
      "dataset-final.csv",
      aCsv([
        ["documento", ...variables.map((v) => v.key)],
        ...filas.map((f) => [f.documento.id, ...variables.map((v) => f.valores[v.key] ?? "NO_ENCONTRADO")]),
      ]),
    );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrar por municipio o departamento"
          aria-label="Filtrar"
          className="h-8 w-72 rounded-md border border-line-strong bg-sheet px-2.5 text-[0.8125rem] text-ink"
        />
        <label className="inline-flex h-8 items-center gap-2 px-2 text-[0.8125rem] text-ink-2">
          <input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} className="size-3.5 accent-rail" />
          Mostrar las {variables.length} variables
        </label>
        <span className="cifra ml-auto text-xs text-ink-3">{visibles.length} filas</span>
        <Boton tamano="sm" variante="primario" onClick={exportar}>
          <Download className="size-3.5" aria-hidden />
          Exportar CSV completo
        </Boton>
      </div>

      <Hoja className="mt-3 max-h-[70vh] overflow-auto">
        <table className="w-max min-w-full text-[0.8125rem]">
          <thead className="sticky top-0 z-20 bg-sheet">
            <tr className="border-b border-line">
              <th className="th sticky left-0 z-10 min-w-[240px] bg-sheet py-2 pl-4">Entidad</th>
              {columnas.map((v) => (
                <th key={v.key} className={cx("th px-3 py-2", v.tipo === "cifra" && "text-right")}>
                  {v.nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibles.map((f) => (
              <tr key={f.documento.id} className="group border-b border-line last:border-b-0">
                <td className="sticky left-0 z-10 bg-sheet py-1.5 pl-4 font-semibold text-ink group-hover:bg-paper">
                  {f.documento.entidad}
                  <span className="block text-2xs font-normal text-ink-3">{f.documento.departamento}</span>
                </td>
                {columnas.map((v) => {
                  const val = f.valores[v.key];
                  return (
                    <td
                      key={v.key}
                      className={cx(
                        "px-3 py-1.5 whitespace-nowrap group-hover:bg-paper",
                        v.tipo === "cifra" && "cifra text-right",
                        val === null ? "text-2xs font-semibold text-ink-3" : "text-ink",
                      )}
                    >
                      {val === null ? "NO_ENCONTRADO" : formatValor(v.tipo, val)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Hoja>
    </div>
  );
}
