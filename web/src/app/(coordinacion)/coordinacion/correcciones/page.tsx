import type { Metadata } from "next";
import { Encabezado, Pagina } from "@/components/ui/base";
import { Registro } from "@/components/coordinacion/registro";
import { listarCorrecciones, listarDocumentos, listarEstudiantes, listarVariables } from "@/lib/data";

export const metadata: Metadata = { title: "Registro de correcciones" };

export default async function Correcciones() {
  const [correcciones, variables, estudiantes, todos] = await Promise.all([
    listarCorrecciones(),
    listarVariables(),
    listarEstudiantes(),
    listarDocumentos(),
  ]);
  const ids = new Set(correcciones.map((c) => c.documentoId));
  const documentos = todos.filter((d) => ids.has(d.id));

  return (
    <Pagina ancho="amplio">
      <Encabezado
        titulo="Registro de correcciones"
        descripcion="Cada cambio que hace un estudiante sobre lo extraído: el valor anterior, el nuevo, el folio de la cita y el motivo. Sirve para auditar y para mejorar las reglas."
      />
      <div className="mt-5">
        <Registro correcciones={correcciones} documentos={documentos} variables={variables} estudiantes={estudiantes} />
      </div>
    </Pagina>
  );
}
