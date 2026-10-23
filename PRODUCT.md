# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router) + PDF.js para el visor, según la ficha técnica (`ficha.txt`). Backend previsto: NestJS + BullMQ/Redis, Supabase (Postgres + Storage), OCR PaddleOCR en Modal, extracción DeepSeek. **Estado actual: solo frontend, todo con datos simulados (mocks) detrás de una capa de datos reemplazable.**

## Users

- **Estudiantes revisores** (contaduría): validan los datos extraídos de cada PDF con el documento a la vista. Pasan de digitar a revisar. Trabajan en portátil/escritorio, sesiones largas, con teclado.
- **Coordinadores** (equipo responsable y profesores): suben los PDFs, siguen el avance del lote por el pipeline, asignan documentos a estudiantes, auditan y exportan el dataset final.

## Product Purpose

Extraer 30–40 variables (cifras, fechas, estados, conceptos) de ~1.200 PDFs estatales de ~200 páginas, sustituyendo la digitación manual propensa a errores y el uso de chatbots que inventaban datos. Éxito: un dataset final aprobado por humanos en el que cada valor es trazable a una cita y una página.

## Positioning

Ningún dato llega al estudiante sin la cita literal y la página de donde salió. Si no se encuentra, se marca NO_ENCONTRADO; nunca se inventa. La verificación es por código (la cita existe en la página, el valor sale de la cita, formato, coherencia contable, doble pasada), no por confianza en el modelo.

## Operating Context

Pipeline de 7 etapas: Ingesta → Texto y OCR → Localización → Extracción → Verificación → Revisión → Dataset final. Semáforo de verificación:

- **Verde**: pasa todo → confirmación rápida (auditoría aleatoria 5–10%).
- **Amarillo**: pasa con alertas → revisión obligatoria.
- **Rojo**: falla o no encontrado → corrección manual con el PDF a la vista.

Parte de los PDFs son escaneos (OCR con confianza por palabra). Verificaciones: cita existe en la página, valor sale de la cita, formato (fechas, NIT con dígito de verificación, cifras normalizadas), coherencia contable (Activo = Pasivo + Patrimonio; subtotales), doble pasada en campos críticos y confianza OCR. Toda corrección queda registrada.

## Capabilities and Constraints

- Idioma de la interfaz: español (Colombia). Cifras en COP con formato colombiano.
- Solo escritorio/portátil. El layout móvil está fuera de alcance por decisión del equipo (23 oct 2026).
- Variables aún no definidas (Fase 0): la lista de variables debe ser configurable, no fija en la UI.
- Sin nombre de producto aún: nombre de trabajo reemplazable.
- Datos actuales: ninguno real. Todo mock.

## Evidence on Hand

- `ficha.txt` / `ficha-tecnica-v4.pdf`: ficha técnica v4 (octubre 2026), Santiago Afanador Aguello y Mariana Acero.
- No hay PDFs de muestra, variables definitivas, set de oro, ni métricas reales. No inventar cifras de precisión, clientes ni testimonios.

## Product Principles

1. Trazabilidad antes que velocidad: cada valor visible va con su cita y página.
2. NO_ENCONTRADO es un resultado honesto, no un error a esconder.
3. La atención humana se gasta donde el sistema duda (rojo > amarillo > verde).
4. Toda corrección deja rastro.
5. Herramienta de trabajo diario: escaneable, consistente, operable con teclado.

## Accessibility & Inclusion

El semáforo nunca depende solo del color: siempre etiqueta/icono. Operación completa por teclado en la revisión.
