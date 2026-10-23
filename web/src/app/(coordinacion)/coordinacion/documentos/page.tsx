import type { Metadata } from "next";
import { Suspense } from "react";
import { ListaDocumentos } from "@/components/coordinacion/lista-documentos";
import { BotonLink, Encabezado, Pagina } from "@/components/ui/base";
import { listarDocumentos, listarEstudiantes } from "@/lib/data";

export const metadata: Metadata = { title: "Documentos" };

export default async function Documentos() {
  const [documentos, estudiantes] = await Promise.all([listarDocumentos(), listarEstudiantes()]);
  return (
    <Pagina ancho="amplio">
      <Encabezado
        titulo="Documentos"
        descripcion="Todos los PDF del lote, en la etapa del pipeline donde están. Abra uno para ver sus folios, sus variables y quién lo revisa."
        acciones={<BotonLink href="/coordinacion/ingesta">Subir PDF</BotonLink>}
      />
      <div className="mt-5">
        <Suspense>
          <ListaDocumentos documentos={documentos} estudiantes={estudiantes} />
        </Suspense>
      </div>
    </Pagina>
  );
}
