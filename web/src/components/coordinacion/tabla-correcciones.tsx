import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Correccion, Documento, Estudiante, Variable } from "@/lib/types";
import { formatCifra, formatFechaHora } from "@/lib/format";
import { Etiqueta } from "@/components/ui/base";

const TIPO: Record<Correccion["tipo"], { label: string; tono: "sello" | "neutro" | "rojo" }> = {
  correccion: { label: "Corrección", tono: "neutro" },
  no_encontrado: { label: "No encontrado", tono: "rojo" },
  confirmacion_auditoria: { label: "Auditoría", tono: "neutro" },
};

export function TablaCorrecciones({
  correcciones,
  documentos,
  variables,
  estudiantes = [],
  sinEstudiante = false,
}: {
  correcciones: Correccion[];
  documentos: Documento[];
  variables: Variable[];
  estudiantes?: Estudiante[];
  sinEstudiante?: boolean;
}) {
  const doc = new Map(documentos.map((d) => [d.id, d]));
  const vari = new Map(variables.map((v) => [v.key, v]));
  const est = new Map(estudiantes.map((e) => [e.id, e]));

  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[860px] text-[0.8125rem]">
        <thead>
          <tr className="border-b border-line">
            <th className="th py-2 pl-4">Fecha</th>
            <th className="th py-2">Documento</th>
            <th className="th py-2">Variable</th>
            <th className="th py-2 text-right">Antes</th>
            <th className="th py-2"><span className="sr-only">a</span></th>
            <th className="th py-2 text-right">Después</th>
            <th className="th py-2 pl-4">Folio</th>
            <th className="th py-2">Motivo</th>
            {!sinEstudiante && <th className="th py-2 pr-4">Estudiante</th>}
          </tr>
        </thead>
        <tbody>
          {correcciones.map((c) => {
            const d = doc.get(c.documentoId);
            const v = vari.get(c.variableKey);
            const t = TIPO[c.tipo];
            return (
              <tr key={c.id} className="border-b border-line align-top last:border-b-0">
                <td className="cifra py-2.5 pl-4 whitespace-nowrap text-xs text-ink-3">{formatFechaHora(c.fecha)}</td>
                <td className="max-w-[220px] py-2.5 pr-3">
                  {d ? (
                    <Link href={`/coordinacion/documentos/${d.id}`} className="block truncate font-semibold text-ink hover:underline">
                      {d.entidad}
                    </Link>
                  ) : (
                    c.documentoId
                  )}
                  <span className="cifra text-xs text-ink-3">{d?.vigencia}</span>
                </td>
                <td className="py-2.5 pr-3">
                  <span className="block text-ink-2">{v?.nombre ?? c.variableKey}</span>
                  <Etiqueta tono={t.tono}>{t.label}</Etiqueta>
                </td>
                <td className="cifra py-2.5 text-right whitespace-nowrap text-ink-3 line-through decoration-ink-3/50">
                  {c.antes ? formatCifra(c.antes) : "—"}
                </td>
                <td className="px-2 py-2.5 text-ink-3">
                  <ArrowRight className="mt-0.5 size-3" aria-label="pasa a" />
                </td>
                <td className="cifra py-2.5 text-right font-semibold whitespace-nowrap text-ink">
                  {c.despues ? formatCifra(c.despues) : c.tipo === "no_encontrado" ? "NO_ENCONTRADO" : "—"}
                </td>
                <td className="cifra py-2.5 pr-4 pl-4 text-xs font-bold whitespace-nowrap text-sello">{c.folio ? `f. ${c.folio}` : "—"}</td>
                <td className="max-w-[260px] py-2.5 pr-3 text-ink-2">{c.motivo}</td>
                {!sinEstudiante && <td className="py-2.5 pr-4 whitespace-nowrap text-ink-2">{est.get(c.estudianteId)?.nombre ?? "—"}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
