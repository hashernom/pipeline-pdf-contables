"use client";

import { useMemo, useState } from "react";
import { Shuffle } from "lucide-react";
import type { Documento, Estudiante } from "@/lib/types";
import { Boton, Hoja, TituloSeccion, Vacio, cx } from "@/components/ui/base";
import { ConteoSemaforo } from "@/components/ui/marcas";

interface Carga {
  estudiante: Estudiante;
  enRevision: number;
  enviados: number;
  pendientesRojo: number;
  variablesPendientes: number;
}

/** Peso de un documento para repartir: lo que le falta, con los rojos pesando el triple. */
const peso = (d: Documento) => d.totalVariables - d.revisadas + d.conteo.rojo * 2;

export function Asignacion({ sinAsignar, cargaInicial }: { sinAsignar: Documento[]; cargaInicial: Carga[] }) {
  const [pendientes, setPendientes] = useState(sinAsignar);
  const [carga, setCarga] = useState(cargaInicial);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [destino, setDestino] = useState(cargaInicial[0]?.estudiante.id ?? "");
  const [propuesta, setPropuesta] = useState<Map<string, string> | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const nombre = useMemo(() => new Map(cargaInicial.map((c) => [c.estudiante.id, c.estudiante.nombre])), [cargaInicial]);

  const asignar = (pares: [string, string][]) => {
    const porDoc = new Map(pendientes.map((d) => [d.id, d]));
    setCarga((cs) =>
      cs.map((c) => {
        const suyos = pares.filter(([, e]) => e === c.estudiante.id).map(([d]) => porDoc.get(d)!);
        return {
          ...c,
          enRevision: c.enRevision + suyos.length,
          pendientesRojo: c.pendientesRojo + suyos.reduce((a, d) => a + d.conteo.rojo, 0),
          variablesPendientes: c.variablesPendientes + suyos.reduce((a, d) => a + d.totalVariables - d.revisadas, 0),
        };
      }),
    );
    const ids = new Set(pares.map(([d]) => d));
    setPendientes((ps) => ps.filter((d) => !ids.has(d.id)));
    setSel(new Set());
    setPropuesta(null);
    setAviso(`${pares.length} documentos asignados. Ya aparecen en las colas.`);
  };

  // Reparto voraz: el documento más pesado va a quien tenga menos trabajo pendiente.
  const proponer = () => {
    const trabajo = new Map(carga.map((c) => [c.estudiante.id, c.variablesPendientes]));
    const p = new Map<string, string>();
    for (const d of [...pendientes].sort((a, b) => peso(b) - peso(a))) {
      const [id] = [...trabajo.entries()].sort((a, b) => a[1] - b[1])[0];
      p.set(d.id, id);
      trabajo.set(id, trabajo.get(id)! + peso(d));
    }
    setPropuesta(p);
    setAviso(null);
  };

  const maxPend = Math.max(...carga.map((c) => c.variablesPendientes), 1);
  const todos = pendientes.length > 0 && sel.size === pendientes.length;

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,1fr)]">
      <section className="min-w-0">
        <TituloSeccion extra={`${pendientes.length} documentos en revisión sin estudiante`}>Sin asignar</TituloSeccion>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select
            aria-label="Estudiante destino"
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            className="h-8 rounded-md border border-line-strong bg-sheet px-2.5 text-[0.8125rem] text-ink"
          >
            {carga.map((c) => (
              <option key={c.estudiante.id} value={c.estudiante.id}>
                {c.estudiante.nombre}
              </option>
            ))}
          </select>
          <Boton variante="primario" tamano="sm" disabled={sel.size === 0} onClick={() => asignar([...sel].map((d) => [d, destino]))}>
            Asignar {sel.size || ""} seleccionados
          </Boton>
          <span className="mx-1 h-5 w-px bg-line" aria-hidden />
          {propuesta ? (
            <>
              <Boton variante="primario" tamano="sm" onClick={() => asignar([...propuesta.entries()])}>
                Aplicar reparto
              </Boton>
              <Boton variante="fantasma" tamano="sm" onClick={() => setPropuesta(null)}>
                Descartar
              </Boton>
            </>
          ) : (
            <Boton tamano="sm" onClick={proponer} disabled={pendientes.length === 0}>
              <Shuffle className="size-3.5" aria-hidden />
              Proponer reparto equilibrado
            </Boton>
          )}
        </div>
        {aviso && (
          <p role="status" className="aparece mb-3 text-xs font-semibold text-verde">
            {aviso}
          </p>
        )}

        <Hoja className="overflow-x-auto">
          {pendientes.length === 0 ? (
            <Vacio titulo="Todo lo que está en revisión tiene estudiante.">
              Cuando más documentos terminen la verificación aparecerán aquí para asignarlos.
            </Vacio>
          ) : (
            <table className="w-full min-w-[620px] text-[0.8125rem]">
              <thead>
                <tr className="border-b border-line">
                  <th className="w-10 py-2 pl-4">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todos"
                      checked={todos}
                      onChange={() => setSel(todos ? new Set() : new Set(pendientes.map((d) => d.id)))}
                      className="size-3.5 accent-rail"
                    />
                  </th>
                  <th className="th py-2">Entidad</th>
                  <th className="th py-2 text-right">Vig.</th>
                  <th className="th py-2 pl-5">Por color</th>
                  <th className="th py-2 pr-4">{propuesta ? "Propuesta" : "Pendientes"}</th>
                </tr>
              </thead>
              <tbody>
                {pendientes.map((d) => (
                  <tr key={d.id} className={cx("border-b border-line last:border-b-0", sel.has(d.id) && "bg-[#eef3f0]")}>
                    <td className="py-2 pl-4">
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar ${d.entidad}`}
                        checked={sel.has(d.id)}
                        onChange={() =>
                          setSel((s) => {
                            const n = new Set(s);
                            if (n.has(d.id)) n.delete(d.id);
                            else n.add(d.id);
                            return n;
                          })
                        }
                        className="size-3.5 accent-rail"
                      />
                    </td>
                    <td className="max-w-[240px] truncate py-2 font-semibold text-ink">{d.entidad}</td>
                    <td className="cifra py-2 text-right text-ink-2">{d.vigencia}</td>
                    <td className="py-2 pl-5">
                      <ConteoSemaforo conteo={d.conteo} />
                    </td>
                    <td className="py-2 pr-4 text-ink-2">
                      {propuesta ? (
                        <span className="font-semibold text-sello-ink">{nombre.get(propuesta.get(d.id)!)}</span>
                      ) : (
                        <span className="cifra">{d.totalVariables - d.revisadas} variables</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Hoja>
      </section>

      <section>
        <TituloSeccion extra="Variables por revisar">Carga por estudiante</TituloSeccion>
        <Hoja>
          <ul>
            {carga.map((c) => (
              <li key={c.estudiante.id} className="border-b border-line px-4 py-2.5 last:border-b-0">
                <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
                  <span className="min-w-0 truncate font-semibold text-ink">
                    {c.estudiante.nombre} <span className="text-2xs font-normal text-ink-3">{c.estudiante.grupo}</span>
                  </span>
                  <span className="cifra shrink-0 text-xs text-ink-2">
                    <b className="text-ink">{c.variablesPendientes}</b> · {c.enRevision} docs.
                    {c.pendientesRojo > 0 && <span className="text-rojo"> · {c.pendientesRojo} rojos</span>}
                  </span>
                </div>
                <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-panel" aria-hidden>
                  <span className="block h-full rounded-full bg-rail transition-[width] duration-300" style={{ width: `${(c.variablesPendientes / maxPend) * 100}%` }} />
                </span>
              </li>
            ))}
          </ul>
        </Hoja>
      </section>
    </div>
  );
}
