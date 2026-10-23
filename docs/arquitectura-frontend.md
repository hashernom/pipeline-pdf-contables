# Arquitectura del frontend

## Capas

```
app/ (rutas, Server Components)
  └── lee datos con  lib/data/index.ts   ← único punto a reemplazar por la API
                       └── hoy usa lib/mock/*  (semilla fija, sin red)
components/ (Client Components: interacción)
lib/types.ts   contrato de dominio
lib/format.ts  formato y validación reales (cifras, NIT con dígito de verificación, fechas)
```

- Las páginas son Server Components que piden datos a `lib/data` y los pasan a componentes cliente.
- Next.js 16 con **Cache Components**: las rutas dinámicas leen `params` dentro de `<Suspense>`; los mocks no usan `Date.now()` ni `Math.random()` en render (fechas fijas, generador con semilla) para que el prerender y la hidratación coincidan.
- `generateStaticParams` prerenderiza los documentos de demostración; el resto se resuelve en el request.

## Flujo de revisión (el corazón del producto)

`components/revision/`:

| Archivo | Responsabilidad |
|---|---|
| `espacio-revision.tsx` | Orquesta: filtros por color, variable activa, atajos (`useEffectEvent`), envío al dataset. |
| `estado.ts` | Decisiones del estudiante (confirmar, corregir, no encontrado, deshacer). Almacén externo con `useSyncExternalStore` sobre `localStorage`. |
| `fila-variable.tsx` | Fila: semáforo, valor, llamada de folio, cita, verificaciones, acciones. |
| `editor-correccion.tsx` | Corrección: exige cita y folio; valida que el valor aparezca dentro de la cita. |
| `coherencia.tsx` | Prueba contable en vivo con los valores vigentes (corregidos > extraídos). |
| `components/pdf/visor-pdf.tsx` | PDF.js: render por página (encadenado, un render por canvas), marco de la cita por bbox, marcado por arrastre que extrae el texto real de la zona con `getTextContent()`. |

Reglas que la interfaz hace cumplir (de la ficha técnica):
1. Una corrección no se guarda sin cita y folio.
2. `NO_ENCONTRADO` es un resultado explícito, nunca un vacío.
3. Rojo abre corrección con `↵`; amarillo y verde se confirman; los verdes de la muestra de auditoría no se confirman en bloque.

## Coordenadas de la cita

`Caja { x, y, w, h }` en **puntos PDF con origen arriba-izquierda**, a escala 1. El visor la multiplica por la escala de render. El OCR/PyMuPDF debe entregar las cajas en ese sistema (PyMuPDF ya usa origen arriba-izquierda; PaddleOCR entrega píxeles de la imagen: dividir por `dpi/72`).

## Datos simulados

- `scripts/generate-mock-pdfs.mjs` crea 3 PDF (`public/mock/pdfs/`) y el JSON de citas y cajas (`src/lib/mock/generated/`). Algunas páginas se dibujan como "escaneadas".
- `lib/mock/extracciones.ts` inyecta fallas por documento: cita inventada (alucinación), OCR que lee mal un dígito (descuadre contable), doble pasada en desacuerdo, baja confianza OCR, `NO_ENCONTRADO`.
- `lib/mock/documentos.ts` genera el lote de 1.200 con distribución por etapa, errores y asignaciones.

## Diseño

Ver [DESIGN.md](../DESIGN.md). Tokens en `web/src/app/globals.css` (`@theme` de Tailwind 4). Primitivas en `components/ui/`.
