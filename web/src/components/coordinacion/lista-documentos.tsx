"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, OctagonX, Search, X } from "lucide-react";
import type { Documento, Estudiante, Etapa, Semaforo } from "@/lib/types";
import { ETAPAS, NOMBRE_ETAPA } from "@/lib/etapas";
import { formatEntero, formatFecha, formatNit } from "@/lib/format";
import { Boton, Hoja, Vacio, cx } from "@/components/ui/base";
import { ConteoSemaforo } from "@/components/ui/marcas";

type Orden = "entidad" | "etapa" | "actualizado" | "rojos";
const POR_PAGINA = 50;
const ORDEN_ETAPA = Object.fromEntries(ETAPAS.map((e, i) => [e.key, i])) as Record<Etapa, number>;

const control = "h-8 rounded-md border border-line-strong bg-sheet px-2.5 text-[0.8125rem] text-ink";

function Th({
  k,
  orden,
  setOrden,
  children,
  className,
}: {
  k: Orden;
  orden: { k: Orden; asc: boolean };
  setOrden: (f: (o: { k: Orden; asc: boolean }) => { k: Orden; asc: boolean }) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={cx("th py-2", className)} aria-sort={orden.k === k ? (orden.asc ? "ascending" : "descending") : undefined}>
      <button
        type="button"
        onClick={() => setOrden((o) => ({ k, asc: o.k === k ? !o.asc : k === "entidad" }))}
        className="inline-flex items-center gap-1 hover:text-ink"
      >
        {children}
        {orden.k === k && (orden.asc ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );
}

export function ListaDocumentos({ documentos, estudiantes }: { documentos: Documento[]; estudiantes: Estudiante[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [etapa, setEtapa] = useState<Etapa | "todas">((params.get("etapa") as Etapa) ?? "todas");
  const [semaforo, setSemaforo] = useState<Semaforo | "todos">("todos");
  const [asignado, setAsignado] = useState(params.get("asignado") ?? "todos");
  const [soloError, setSoloError] = useState(params.get("estado") === "error");
  const [orden, setOrden] = useState<{ k: Orden; asc: boolean }>({ k: "actualizado", asc: false });
  const [pagina, setPagina] = useState(0);
  const nombreEst = useMemo(() => new Map(estudiantes.map((e) => [e.id, e.nombre])), [estudiantes]);

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    const out = documentos.filter((d) => {
      if (t && !`${d.entidad} ${d.departamento} ${d.nit} ${d.id} ${d.archivo}`.toLowerCase().includes(t)) return false;
      if (etapa !== "todas" && d.etapa !== etapa) return false;
      if (semaforo !== "todos" && d.conteo[semaforo] === 0) return false;
      if (asignado === "sin_asignar" && d.asignadoA) return false;
      if (asignado !== "todos" && asignado !== "sin_asignar" && d.asignadoA !== asignado) return false;
      if (soloError && d.estadoEtapa !== "error") return false;
      return true;
    });
    const dir = orden.asc ? 1 : -1;
    out.sort((a, b) => {
      switch (orden.k) {
        case "entidad":
          return a.entidad.localeCompare(b.entidad, "es") * dir;
        case "etapa":
          return (ORDEN_ETAPA[a.etapa] - ORDEN_ETAPA[b.etapa]) * dir;
        case "rojos":
          return (a.conteo.rojo - b.conteo.rojo) * dir;
        default:
          return a.actualizadoEl.localeCompare(b.actualizadoEl) * dir;
      }
    });
    return out;
  }, [documentos, q, etapa, semaforo, asignado, soloError, orden]);

  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const p = Math.min(pagina, paginas - 1);
  const visibles = filtrados.slice(p * POR_PAGINA, (p + 1) * POR_PAGINA);
  const hayFiltros = q || etapa !== "todas" || semaforo !== "todos" || asignado !== "todos" || soloError;

  const limpiar = () => {
    setQ("");
    setEtapa("todas");
    setSemaforo("todos");
    setAsignado("todos");
    setSoloError(false);
    setPagina(0);
    router.replace("/coordinacion/documentos");
  };

  return (
    <div>
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[240px] flex-1 sm:max-w-sm">
          <span className="sr-only">Buscar</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPagina(0);
            }}
            placeholder="Municipio, NIT o archivo"
            className={cx(control, "w-full pl-8")}
          />
        </label>
        <select
          aria-label="Etapa"
          value={etapa}
          onChange={(e) => {
            setEtapa(e.target.value as Etapa | "todas");
            setPagina(0);
          }}
          className={control}
        >
          <option value="todas">Todas las etapas</option>
          {ETAPAS.map((e) => (
            <option key={e.key} value={e.key}>
              {e.nombre}
            </option>
          ))}
        </select>
        <select
          aria-label="Color"
          value={semaforo}
          onChange={(e) => {
            setSemaforo(e.target.value as Semaforo | "todos");
            setPagina(0);
          }}
          className={control}
        >
          <option value="todos">Cualquier color</option>
          <option value="rojo">Con rojos</option>
          <option value="amarillo">Con amarillos</option>
        </select>
        <select
          aria-label="Asignado a"
          value={asignado}
          onChange={(e) => {
            setAsignado(e.target.value);
            setPagina(0);
          }}
          className={control}
        >
          <option value="todos">Cualquier estudiante</option>
          <option value="sin_asignar">Sin asignar</option>
          {estudiantes.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
        <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-[0.8125rem] text-ink-2 hover:bg-panel">
          <input
            type="checkbox"
            checked={soloError}
            onChange={(e) => {
              setSoloError(e.target.checked);
              setPagina(0);
            }}
            className="size-3.5 accent-rojo"
          />
          Solo con error
        </label>
        {hayFiltros && (
          <Boton tamano="sm" variante="fantasma" onClick={limpiar}>
            <X className="size-3.5" aria-hidden />
            Quitar filtros
          </Boton>
        )}
        <span className="cifra ml-auto text-xs text-ink-3">{formatEntero(filtrados.length)} documentos</span>
      </div>

      <Hoja className="mt-3 overflow-x-auto">
        {visibles.length === 0 ? (
          <Vacio titulo="Ningún documento coincide con estos filtros." accion={<Boton tamano="sm" onClick={limpiar}>Quitar filtros</Boton>}>
            Pruebe con otra etapa o busque por el NIT sin dígito de verificación.
          </Vacio>
        ) : (
          <table className="w-full min-w-[980px] text-[0.8125rem]">
            <thead>
              <tr className="border-b border-line">
                <Th orden={orden} setOrden={setOrden} k="entidad" className="pl-4">Entidad</Th>
                <th className="th py-2">NIT</th>
                <th className="th py-2 text-right">Vig.</th>
                <th className="th py-2 pl-5 text-right">Folios</th>
                <Th orden={orden} setOrden={setOrden} k="etapa" className="pl-5">Etapa</Th>
                <Th orden={orden} setOrden={setOrden} k="rojos">Por color</Th>
                <th className="th py-2">Asignado a</th>
                <Th orden={orden} setOrden={setOrden} k="actualizado" className="pr-4">Actualizado</Th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((d) => (
                <tr key={d.id} className="relative border-b border-line last:border-b-0 hover:bg-paper">
                  <td className="max-w-[260px] py-2 pl-4">
                    <Link href={`/coordinacion/documentos/${d.id}`} className="block truncate font-semibold text-ink after:absolute after:inset-0">
                      {d.entidad}
                    </Link>
                    <span className="block truncate text-2xs text-ink-3">{d.departamento}</span>
                  </td>
                  <td className="cifra py-2 text-xs text-ink-2">{formatNit(d.nit)}</td>
                  <td className="cifra py-2 text-right text-ink-2">{d.vigencia}</td>
                  <td className="cifra py-2 pl-5 text-right text-ink-2">
                    {d.folios}
                    {d.foliosEscaneados > 20 && <span className="block text-2xs text-ink-3">{d.foliosEscaneados} esc.</span>}
                  </td>
                  <td className="py-2 pl-5">
                    <span className={cx("inline-flex items-center gap-1.5", d.estadoEtapa === "error" ? "font-semibold text-rojo" : "text-ink")}>
                      {d.estadoEtapa === "error" && <OctagonX className="size-3.5" aria-hidden />}
                      {NOMBRE_ETAPA[d.etapa]}
                    </span>
                    <span className="block text-2xs text-ink-3">
                      {d.estadoEtapa === "error" ? "Con error" : d.estadoEtapa === "en_curso" ? "En curso" : d.estadoEtapa === "completa" ? "Completa" : "En cola"}
                      {d.etapa === "revision" && ` · ${d.revisadas}/${d.totalVariables}`}
                    </span>
                  </td>
                  <td className="py-2">
                    <ConteoSemaforo conteo={d.conteo} vacio="Sin verificar" />
                  </td>
                  <td className="max-w-[180px] truncate py-2 text-ink-2">
                    {d.asignadoA ? nombreEst.get(d.asignadoA) : <span className="text-ink-3">—</span>}
                  </td>
                  <td className="cifra py-2 pr-4 text-xs whitespace-nowrap text-ink-3">{formatFecha(d.actualizadoEl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Hoja>

      {paginas > 1 && (
        <nav aria-label="Paginación" className="mt-3 flex items-center justify-end gap-2 text-xs text-ink-2">
          <span className="cifra">
            {formatEntero(p * POR_PAGINA + 1)}–{formatEntero(Math.min(filtrados.length, (p + 1) * POR_PAGINA))} de {formatEntero(filtrados.length)}
          </span>
          <Boton tamano="sm" onClick={() => setPagina(p - 1)} disabled={p === 0} aria-label="Página anterior">
            <ChevronLeft className="size-3.5" />
          </Boton>
          <Boton tamano="sm" onClick={() => setPagina(p + 1)} disabled={p >= paginas - 1} aria-label="Página siguiente">
            <ChevronRight className="size-3.5" />
          </Boton>
        </nav>
      )}
    </div>
  );
}
