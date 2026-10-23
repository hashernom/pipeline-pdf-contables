# Integración con el backend

El frontend ya define qué necesita. Los tipos están en [`web/src/lib/types.ts`](../web/src/lib/types.ts); cada función de [`web/src/lib/data/index.ts`](../web/src/lib/data/index.ts) corresponde a un endpoint. Los endpoints de abajo son una **propuesta**, no algo implementado.

## Lo que debe producir la verificación (por documento y variable)

```ts
interface Extraccion {
  variableKey: string;
  estado: "ENCONTRADO" | "NO_ENCONTRADO";
  valor: string | null;          // normalizado: cifras sin separadores ("-123" si negativo), fechas ISO
  valorDocumento: string | null; // tal como aparece en el PDF
  cita: string | null;           // literal
  folio: number | null;          // página, base 1
  caja: { x; y; w; h } | null;   // puntos PDF, origen arriba-izquierda
  confianzaOcr: number | null;   // 0-1, null si la página es digital
  metodo: "regla" | "llm";
  checks: { tipo; resultado: "pasa" | "alerta" | "falla" | "no_aplica"; detalle: string }[];
  semaforo: "verde" | "amarillo" | "rojo";
  auditoria: boolean;            // en la muestra aleatoria de verdes
}
```

`checks.tipo`: `cita_en_pagina`, `valor_de_cita`, `formato`, `coherencia`, `doble_pasada`, `confianza_ocr`. El campo `detalle` se muestra tal cual al estudiante: escríbalo en español y diga qué falló ("La cita no aparece en el folio 6").

Semáforo: rojo si `NO_ENCONTRADO` o algún check falla; amarillo si alguno alerta; verde en otro caso.

## Endpoints sugeridos

| Función en `lib/data` | Método y ruta |
|---|---|
| `listarDocumentos(filtro)` | `GET /documentos?q&etapa&semaforo&asignado&estado` (paginado en servidor) |
| `obtenerDocumento(id)` | `GET /documentos/:id` |
| `obtenerPaginas(id)` | `GET /documentos/:id/paginas` |
| `obtenerExtracciones(id)` | `GET /documentos/:id/extracciones` |
| `resumenPipeline()` | `GET /lote/resumen` |
| `listarLotes()` | `GET /lotes` |
| `cargaPorEstudiante()` | `GET /estudiantes/carga` |
| `colaDeEstudiante(id)` | `GET /estudiantes/:id/cola` |
| `listarCorrecciones()` | `GET /correcciones?documentoId&estudianteId&tipo` |
| `listarVariables()` | `GET /variables` · `PUT /variables/:key` |
| `muestraAuditoria()` | `GET /auditoria/muestra` · `PATCH /auditoria/:id` |
| `filasDataset()` | `GET /dataset` · `GET /dataset.csv` |

Escrituras que hoy son locales y deben ir a la API:

| Hoy | Debe ser |
|---|---|
| `estado.ts` → `localStorage` | `PUT /documentos/:id/decisiones/:variableKey` (y registrar la corrección) |
| Enviar al dataset (`localStorage`) | `POST /documentos/:id/enviar` |
| `subida.tsx` (avance simulado) | URL firmada de Supabase Storage + `POST /ingesta` que encola en BullMQ |
| Asignación (estado local) | `PATCH /documentos/:id { asignadoA }` |
| Reprocesar etapa | `POST /documentos/:id/reprocesar` |

## PDF

El visor recibe `documento.pdfUrl`. Con Supabase Storage use una URL firmada de corta duración. El worker de PDF.js se sirve desde `/pdf.worker.min.mjs` (copiado en `predev`/`prebuild`).

## Autenticación

`/` simula el ingreso. Con Supabase Auth: derivar el rol (`estudiante` / `coordinador`) del perfil y proteger `/coordinacion/*`.
