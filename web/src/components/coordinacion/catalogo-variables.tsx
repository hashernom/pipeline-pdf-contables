"use client";

import { useMemo, useState } from "react";
import { Download, Plus } from "lucide-react";
import type { SeccionVariable, TipoVariable, Variable } from "@/lib/types";
import { SECCIONES } from "@/lib/mock/variables";
import { descargar } from "@/lib/csv";
import { Avance, Boton, Etiqueta, Hoja, TituloSeccion, cx } from "@/components/ui/base";

const TIPOS: { key: TipoVariable; nombre: string }[] = [
  { key: "cifra", nombre: "Cifra (pesos)" },
  { key: "fecha", nombre: "Fecha" },
  { key: "nit", nombre: "NIT" },
  { key: "porcentaje", nombre: "Porcentaje" },
  { key: "opcion", nombre: "Opción de una lista" },
  { key: "anio", nombre: "Año" },
  { key: "texto", nombre: "Texto" },
];
const NOMBRE_TIPO = Object.fromEntries(TIPOS.map((t) => [t.key, t.nombre])) as Record<TipoVariable, string>;

const campo = "h-8 w-full rounded-md border border-line-strong bg-sheet px-2.5 text-[0.8125rem] text-ink";

const nueva = (): Variable => ({
  key: "",
  nombre: "",
  seccion: "situacion_financiera",
  tipo: "cifra",
  metodo: "regla",
  regla: "",
  critica: false,
  palabrasClave: [],
  estado: "borrador",
});

export function CatalogoVariables({ inicial }: { inicial: Variable[] }) {
  const [vars, setVars] = useState(inicial);
  const [editando, setEditando] = useState<{ original: string | null; v: Variable } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const aprobadas = vars.filter((v) => v.estado === "aprobada").length;

  const porSeccion = useMemo(
    () => SECCIONES.map((s) => ({ ...s, items: vars.filter((v) => v.seccion === s.key) })).filter((s) => s.items.length),
    [vars],
  );

  const guardar = () => {
    if (!editando) return;
    const v = editando.v;
    if (!v.nombre.trim()) return setError("Ponga un nombre a la variable.");
    if (!v.regla.trim()) return setError("Describa la regla: dónde y cómo se encuentra el dato.");
    if (v.tipo === "opcion" && !(v.opciones?.length)) return setError("Una variable de opción necesita la lista de opciones.");
    const key =
      editando.original ??
      v.nombre
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
    if (!editando.original && vars.some((x) => x.key === key)) return setError("Ya existe una variable con ese nombre.");
    const final = { ...v, key };
    setVars((xs) => (editando.original ? xs.map((x) => (x.key === editando.original ? final : x)) : [...xs, final]));
    setEditando(null);
    setError(null);
  };

  const set = (p: Partial<Variable>) => editando && setEditando({ ...editando, v: { ...editando.v, ...p } });

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <div className="w-56">
            <p className="cifra mb-1 text-xs text-ink-2">
              <b className="text-ink">{aprobadas}</b> de {vars.length} aprobadas
            </p>
            <Avance valor={aprobadas} total={vars.length} tono="verde" />
          </div>
          <div className="ml-auto flex gap-2">
            <Boton tamano="sm" onClick={() => descargar("variables.json", JSON.stringify(vars, null, 2), "application/json")}>
              <Download className="size-3.5" aria-hidden />
              Exportar JSON
            </Boton>
            <Boton
              tamano="sm"
              variante="primario"
              onClick={() => {
                setEditando({ original: null, v: nueva() });
                setError(null);
              }}
            >
              <Plus className="size-3.5" aria-hidden />
              Nueva variable
            </Boton>
          </div>
        </div>

        <Hoja className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[0.8125rem]">
            <thead>
              <tr className="border-b border-line">
                <th className="th py-2 pl-4">Variable</th>
                <th className="th py-2 pr-4">Tipo</th>
                <th className="th py-2 pr-4">Método</th>
                <th className="th py-2 pr-4">Regla</th>
                <th className="th py-2 pr-4 text-right">Estado</th>
              </tr>
            </thead>
            {porSeccion.map((s) => (
              <tbody key={s.key}>
                <tr className="border-b border-line bg-paper">
                  <th colSpan={5} className="py-1.5 pl-4 text-left text-2xs font-bold text-ink-2">
                    {s.nombre} <span className="cifra font-semibold text-ink-3">· {s.items.length}</span>
                  </th>
                </tr>
                {s.items.map((v) => (
                  <tr
                    key={v.key}
                    onClick={() => {
                      setEditando({ original: v.key, v: { ...v } });
                      setError(null);
                    }}
                    className={cx(
                      "cursor-pointer border-b border-line last:border-b-0 hover:bg-paper",
                      editando?.original === v.key && "bg-sello-bg/40",
                    )}
                  >
                    <td className="py-2 pl-4">
                      <button type="button" className="text-left font-semibold text-ink">
                        {v.nombre}
                      </button>
                      {v.critica && (
                        <span className="ml-1.5">
                          <Etiqueta>· doble pasada</Etiqueta>
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap text-ink-2">{NOMBRE_TIPO[v.tipo]}</td>
                    <td className="py-2 pr-4 text-ink-2">{v.metodo === "regla" ? "Regla" : "LLM"}</td>
                    <td className="max-w-[320px] truncate py-2 pr-4 text-xs text-ink-3" title={v.regla}>
                      {v.regla}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <span className={cx("text-xs font-semibold", v.estado === "aprobada" ? "text-verde" : "text-ink-3")}>
                        {v.estado === "aprobada" ? "Aprobada" : "Borrador"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </Hoja>
      </section>

      <aside className="xl:sticky xl:top-6 xl:self-start">
        {editando ? (
          <section aria-label="Editar variable" className="aparece">
            <TituloSeccion>{editando.original ? "Editar variable" : "Nueva variable"}</TituloSeccion>
            <Hoja className="grid gap-3 p-4">
              <label className="grid gap-1">
                <span className="text-2xs font-semibold text-ink-2">Nombre</span>
                <input autoFocus value={editando.v.nombre} onChange={(e) => set({ nombre: e.target.value })} className={campo} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-2xs font-semibold text-ink-2">Sección</span>
                  <select value={editando.v.seccion} onChange={(e) => set({ seccion: e.target.value as SeccionVariable })} className={campo}>
                    {SECCIONES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-2xs font-semibold text-ink-2">Tipo</span>
                  <select value={editando.v.tipo} onChange={(e) => set({ tipo: e.target.value as TipoVariable })} className={campo}>
                    {TIPOS.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <fieldset className="grid gap-1">
                <legend className="mb-1 text-2xs font-semibold text-ink-2">Método de extracción</legend>
                <div className="flex gap-4 text-[0.8125rem]">
                  {(["regla", "llm"] as const).map((m) => (
                    <label key={m} className="inline-flex items-center gap-1.5">
                      <input type="radio" name="metodo" checked={editando.v.metodo === m} onChange={() => set({ metodo: m })} className="accent-rail" />
                      {m === "regla" ? "Regla (regex)" : "LLM con cita"}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="grid gap-1">
                <span className="text-2xs font-semibold text-ink-2">Regla</span>
                <textarea
                  rows={3}
                  value={editando.v.regla}
                  onChange={(e) => set({ regla: e.target.value })}
                  placeholder="Dónde está el dato y cómo se reconoce"
                  className="w-full resize-none rounded-md border border-line-strong bg-sheet px-2.5 py-1.5 text-[0.8125rem] text-ink"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-2xs font-semibold text-ink-2">Palabras clave para localizar el folio</span>
                <input
                  value={editando.v.palabrasClave.join(", ")}
                  onChange={(e) => set({ palabrasClave: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                  placeholder="total activo, activo total"
                  className={campo}
                />
              </label>
              {editando.v.tipo === "opcion" && (
                <label className="grid gap-1">
                  <span className="text-2xs font-semibold text-ink-2">Opciones, separadas por coma</span>
                  <input
                    value={(editando.v.opciones ?? []).join(", ")}
                    onChange={(e) => set({ opciones: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                    className={campo}
                  />
                </label>
              )}
              <label className="flex items-start gap-2 text-[0.8125rem] text-ink">
                <input type="checkbox" checked={editando.v.critica} onChange={(e) => set({ critica: e.target.checked })} className="mt-0.5 accent-rail" />
                <span>
                  Campo crítico
                  <span className="block text-xs text-ink-3">Se extrae dos veces y se compara antes de dar verde.</span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-[0.8125rem] text-ink">
                <input
                  type="checkbox"
                  checked={editando.v.estado === "aprobada"}
                  onChange={(e) => set({ estado: e.target.checked ? "aprobada" : "borrador" })}
                  className="mt-0.5 accent-rail"
                />
                <span>
                  Aprobada por el equipo
                  <span className="block text-xs text-ink-3">Solo las aprobadas entran al lote completo.</span>
                </span>
              </label>
              {error && (
                <p role="alert" className="text-xs font-semibold text-rojo">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <Boton tamano="sm" variante="fantasma" onClick={() => setEditando(null)}>
                  Cancelar
                </Boton>
                <Boton tamano="sm" variante="primario" onClick={guardar}>
                  Guardar
                </Boton>
              </div>
            </Hoja>
          </section>
        ) : (
          <div className="rounded-md border border-dashed border-line-strong px-4 py-6 text-[0.8125rem] text-ink-2">
            <p className="font-semibold text-ink">Fase 0: definición</p>
            <p className="mt-1">
              Elija una variable para revisar su tipo y su regla. Cuando todas estén aprobadas y el set de oro esté listo, el catálogo se congela para el
              lote completo.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
