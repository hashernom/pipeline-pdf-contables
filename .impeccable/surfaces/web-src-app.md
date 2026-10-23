---
version: 1
slug: "web-src-app"
primary_target: "web/src/app"
related_targets: []
---

# Surface brief: app web (revisión + coordinación)

Scope: toda la app Next.js en `web/`. Modo: Operate. Usuarios: estudiantes revisores (cola + revisión con PDF al lado) y coordinadores (lote, ingesta, asignación, auditoría, registro, variables, exportación). Todo con mocks detrás de `web/src/lib/data` reemplazable. Restricciones del usuario: nada de look SaaS genérico, no sobrecargar de información, serio pero no frío, revisión operable 100% con teclado. Solo escritorio: sin layout móvil (decisión del usuario).

## Direction contract

THESIS: Cada cifra se lee como en un estado financiero publicado: alineada, con su nota y su folio de origen. Rechaza el panel SaaS de tarjetas, badges de colores sueltos y métricas gigantes.

OWN-WORLD: Riel verde botella (#1F3D36) como shell comprometido; fondo papel frío (#F3F5F2), tinta casi negra verdosa. Libre Franklin para todo, con cifras tabulares alineadas a la derecha. Semáforo verde/ámbar/rojo siempre con glifo + palabra. Totales con doble regla contable. Marcas de auditoría con leyenda fija, en la fila de cada variable.

STORY: El estudiante entiende de dónde sale cada dato, confía porque ve la cita en su folio, y confirma o corrige sin ratón. El coordinador ve dónde está cada PDF en el pipeline y dónde hace falta atención humana (rojo > amarillo > verde).

FIRST VIEWPORT: Revisión: riel 84px a la izquierda (ajustado desde 64px: cada destino lleva icono y palabra debajo, y "Correcciones"/"Documentos" no caben en 64px; en móvil pasa a barra inferior); barra de documento (entidad, NIT, vigencia, progreso 12/34); visor PDF a la izquierda (~55%) con la cita enmarcada; panel de variables a la derecha agrupado por sección, cada fila etiqueta · valor tabular · llamada «f. 47» · marcas; abajo la ecuación Activo = Pasivo + Patrimonio con doble regla. Acción primaria: Confirmar (Enter) en la fila activa.

FORM: Estado financiero publicado, candidato 7 de 7 de la lista ordenada; seed key 03c37b64. Firma: la llamada de folio que salta la página y enmarca la cita literal.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
