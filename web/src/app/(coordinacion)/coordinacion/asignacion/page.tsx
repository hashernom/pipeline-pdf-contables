import type { Metadata } from "next";
import { Encabezado, Pagina } from "@/components/ui/base";
import { Asignacion } from "@/components/coordinacion/asignacion";
import { cargaPorEstudiante, listarDocumentos } from "@/lib/data";

export const metadata: Metadata = { title: "Asignación" };

export default async function PaginaAsignacion() {
  const [sinAsignar, carga] = await Promise.all([listarDocumentos({ etapa: "revision", asignado: "sin_asignar" }), cargaPorEstudiante()]);
  return (
    <Pagina ancho="amplio">
      <Encabezado
        titulo="Asignación"
        descripcion="Reparta los documentos verificados entre los estudiantes. El reparto equilibrado tiene en cuenta lo que cada uno tiene pendiente y pesa más los rojos."
      />
      <div className="mt-6">
        <Asignacion sinAsignar={sinAsignar} cargaInicial={carga} />
      </div>
    </Pagina>
  );
}
