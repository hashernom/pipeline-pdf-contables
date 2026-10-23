"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import type { Correccion, Documento, Estudiante, Variable } from "@/lib/types";
import { aCsv, descargar } from "@/lib/csv";
import { Boton, Hoja, Vacio } from "@/components/ui/base";
import { TablaCorrecciones } from "./tabla-correcciones";

const control = "h-8 rounded-md border border-line-strong bg-sheet px-2.5 text-[0.8125rem] text-ink";

export function Registro({
  correcciones,
  documentos,
  variables,
  estudiantes,
}: {
  correcciones: Correccion[];
  documentos: Documento[];
  variables: Variable[];
  estudiantes: Estudiante[];
}) {
  const [tipo, setTipo] = useState<Correccion["tipo"] | "todos">("todos");
  const [est, setEst] = useState("todos");
  const [variable, setVariable] = useState("todas");

  const filtradas = useMemo(
    () =>
      correcciones.filter(
        (c) =>
          (tipo === "todos" || c.tipo === tipo) &&
          (est === "todos" || c.estudianteId === est) &&
          (variable === "todas" || c.variableKey === variable),
      ),
    [correcciones, tipo, est, variable],
  );

  const exportar = () => {
    const doc = new Map(documentos.map((d) => [d.id, d]));
    const nom = new Map(estudiantes.map((e) => [e.id, e.nombre]));
    const vari = new Map(variables.map((v) => [v.key, v.nombre]));
    descargar(
      "registro-correcciones.csv",
      aCsv([
        ["fecha", "documento", "entidad", "vigencia", "variable", "tipo", "antes", "despues", "folio", "motivo", "estudiante"],
        ...filtradas.map((c) => [
          c.fecha,
          c.documentoId,
          doc.get(c.documentoId)?.entidad ?? "",
          doc.get(c.documentoId)?.vigencia ?? "",
          vari.get(c.variableKey) ?? c.variableKey,
          c.tipo,
          c.antes,
          c.despues,
          c.folio,
          c.motivo,
          nom.get(c.estudianteId) ?? "",
        ]),
      ]),
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className={control}>
          <option value="todos">Todos los tipos</option>
          <option value="correccion">Correcciones</option>
          <option value="no_encontrado">No encontrados</option>
          <option value="confirmacion_auditoria">Auditoría</option>
        </select>
        <select aria-label="Estudiante" value={est} onChange={(e) => setEst(e.target.value)} className={control}>
          <option value="todos">Todos los estudiantes</option>
          {estudiantes.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
        <select aria-label="Variable" value={variable} onChange={(e) => setVariable(e.target.value)} className={control}>
          <option value="todas">Todas las variables</option>
          {variables.map((v) => (
            <option key={v.key} value={v.key}>
              {v.nombre}
            </option>
          ))}
        </select>
        <span className="cifra ml-auto text-xs text-ink-3">{filtradas.length} entradas</span>
        <Boton tamano="sm" onClick={exportar} disabled={filtradas.length === 0}>
          <Download className="size-3.5" aria-hidden />
          Exportar CSV
        </Boton>
      </div>
      <Hoja className="mt-3">
        {filtradas.length === 0 ? (
          <Vacio titulo="No hay entradas con estos filtros." />
        ) : (
          <TablaCorrecciones correcciones={filtradas} documentos={documentos} variables={variables} estudiantes={estudiantes} />
        )}
      </Hoja>
    </div>
  );
}
