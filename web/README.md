# Folio · frontend

Interfaz del pipeline de extracción verificable de PDF contables (ver `../ficha.txt`).
**Solo frontend.** Todos los datos son simulados y están marcados como DEMO; "Folio" es un nombre de trabajo.

## Correr

```bash
npm install
npm run dev        # http://localhost:3000 (copia el worker de PDF.js a public/)
npm run build      # build de producción
npm run lint
npm run typecheck
npm run mock:pdfs  # regenera los PDF sintéticos y sus citas
```

Next.js 16 (App Router, Cache Components), React 19, Tailwind CSS 4, PDF.js 6, lucide-react.

## Pantallas

| Ruta | Rol | Qué hace |
|---|---|---|
| `/` | — | Ingreso simulado: elegir rol |
| `/revision` | Estudiante | Cola ordenada por atención (rojo → amarillo) |
| `/revision/[docId]` | Estudiante | Revisión: PDF con la cita enmarcada, variables, corrección, prueba contable en vivo |
| `/revision/historial` | Estudiante | Enviados y correcciones propias |
| `/coordinacion` | Coordinación | Estado del lote por etapa, errores, carga |
| `/coordinacion/documentos[/id]` | Coordinación | Lista filtrable de los 1.200 PDF y detalle (etapas, mapa de folios, variables) |
| `/coordinacion/ingesta` | Coordinación | Subida de PDF (simulada) y cargas |
| `/coordinacion/asignacion` | Coordinación | Asignación manual y reparto equilibrado |
| `/coordinacion/auditoria` | Coordinación | Muestra de verdes y tasa de error |
| `/coordinacion/correcciones` | Coordinación | Registro de correcciones, exportable a CSV |
| `/coordinacion/variables` | Coordinación | Catálogo de variables (Fase 0), exportable a JSON |
| `/coordinacion/dataset` | Coordinación | Dataset final, exportable a CSV |

Solo tres documentos traen PDF y extracción completa: `doc-0001` (Valle Alto), `doc-0002` (San Ramón del Río) y `doc-0003` (La Esperanza del Llano). Cada uno trae fallas inyectadas a propósito (cita inventada, OCR que leyó mal una cifra, descuadre contable, NO_ENCONTRADO).

### Atajos de la revisión

`J`/`K` moverse · `↵` confirmar (en rojo: corregir) · `E` corregir · `N` no está · `U` deshacer · `M` marcar la cita en el PDF · `Ctrl ↵` guardar · `F` volver a la cita · `[` `]` folio · `+` `−` zoom · `1`–`5` filtros · `?` ayuda.

## Cómo conectar el backend

1. **Contrato de datos:** `src/lib/types.ts`. `Extraccion` es lo que debe devolver la etapa de verificación por variable: valor, `valorDocumento`, cita, folio, `caja` (bbox en puntos PDF con origen arriba-izquierda), confianza OCR, `checks` y semáforo.
2. **Capa de datos:** `src/lib/data/index.ts`. Cada función es `async` y hoy lee mocks; reemplace el cuerpo por la llamada a la API (NestJS) sin tocar las páginas.
3. **Estado de revisión:** `src/components/revision/estado.ts` guarda las decisiones en `localStorage`. Con API, `escribir()` debe enviar cada decisión (y la corrección al registro).
4. **Subida:** `src/components/coordinacion/subida.tsx` simula el avance; reemplazar por URL firmada de Supabase Storage + encolado en BullMQ.
5. **Auth:** `/` simula el ingreso; conectar Supabase Auth y derivar el rol.
6. **Variables:** `src/lib/mock/variables.ts` es un **borrador**; la lista real sale de la Fase 0.

Mocks: `src/lib/mock/` (municipios ficticios, semilla fija) y `scripts/generate-mock-pdfs.mjs` → `public/mock/pdfs/*.pdf` + `src/lib/mock/generated/*.json`.

## Diseño

Mundo visual "estado financiero publicado": riel verde botella, papel frío, cifras tabulares, doble regla en totales, semáforo siempre con glifo y palabra, y tinta de sello violeta reservada para la cita y su llamada de folio («f. 47»). Tokens en `src/app/globals.css`; sistema documentado en `../DESIGN.md`.
