import type { Metadata } from "next";
import { Avance, Encabezado, Pagina } from "@/components/ui/base";
import { Dataset } from "@/components/coordinacion/dataset";
import { filasDataset, listarDocumentos, listarVariables } from "@/lib/data";
import { formatEntero } from "@/lib/format";

export const metadata: Metadata = { title: "Dataset final" };

export default async function PaginaDataset() {
  const [filas, variables, docs] = await Promise.all([filasDataset(), listarVariables(), listarDocumentos()]);
  return (
    <Pagina ancho="amplio">
      <Encabezado
        titulo="Dataset final"
        descripcion="Solo valores aprobados por un estudiante. NO_ENCONTRADO se exporta tal cual: es un resultado, no un vacío."
        acciones={
          <div className="w-56">
            <p className="cifra mb-1 text-xs text-ink-2">
              <b className="text-ink">{formatEntero(filas.length)}</b> de {formatEntero(docs.length)} documentos
            </p>
            <Avance valor={filas.length} total={docs.length} tono="verde" />
          </div>
        }
      />
      <div className="mt-5">
        <Dataset filas={filas} variables={variables} />
      </div>
    </Pagina>
  );
}
