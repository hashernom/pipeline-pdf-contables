import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { EspacioRevision } from "@/components/revision/espacio-revision";
import {
  idsDocumentosConPdf,
  listarVariables,
  obtenerDocumento,
  obtenerExtracciones,
  obtenerPaginas,
} from "@/lib/data";

export async function generateStaticParams() {
  const ids = await idsDocumentosConPdf();
  return ids.map((docId) => ({ docId }));
}

export async function generateMetadata({ params }: PageProps<"/revision/[docId]">): Promise<Metadata> {
  const { docId } = await params;
  const doc = await obtenerDocumento(docId);
  return { title: doc ? `Revisión · ${doc.entidad}` : "Revisión" };
}

export default function PaginaRevision({ params }: PageProps<"/revision/[docId]">) {
  return (
    <Suspense fallback={<EsqueletoRevision />}>
      {params.then(({ docId }) => (
        <Revision docId={docId} />
      ))}
    </Suspense>
  );
}

async function Revision({ docId }: { docId: string }) {
  const documento = await obtenerDocumento(docId);
  if (!documento || !documento.pdfUrl) notFound();
  const [extracciones, variables, paginas] = await Promise.all([
    obtenerExtracciones(docId),
    listarVariables(),
    obtenerPaginas(docId),
  ]);
  return <EspacioRevision documento={documento} extracciones={extracciones} variables={variables} paginas={paginas} />;
}

function EsqueletoRevision() {
  return (
    <div className="grid h-dvh grid-rows-[52px_minmax(0,1fr)]" aria-busy="true" aria-label="Cargando documento">
      <div className="border-b border-line bg-sheet" />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.12fr)_minmax(440px,0.88fr)]">
        <div className="hidden bg-[#dfe4e0] lg:block" />
        <div className="bg-sheet">
          <div className="h-11 border-b border-line bg-panel" />
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-line px-4 py-3">
              <span className="size-3 rounded-full bg-panel" />
              <span className="h-2.5 flex-1 animate-pulse rounded bg-panel" style={{ maxWidth: `${40 + ((i * 17) % 35)}%` }} />
              <span className="h-2.5 w-24 animate-pulse rounded bg-panel" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
