# Documentación

Si es tu primera vez en el proyecto, léelos en este orden:

1. [Visión general](arquitectura/vision-general.md): qué problema resuelve, qué piezas hay y en qué hito estamos.
2. [Glosario](glosario.md): términos del dominio (ICA, DANE, folio, bloque, set de oro).
3. [Motor](arquitectura/motor.md): cómo se construye el set de oro, paso a paso.
4. [Diagramas UML](arquitectura/uml.md): componentes, flujo, clases, archivos y decisiones.

## Por carpeta

| Carpeta | Qué hay |
|---|---|
| [arquitectura/](arquitectura/) | [vision-general.md](arquitectura/vision-general.md), [motor.md](arquitectura/motor.md), [uml.md](arquitectura/uml.md), [frontend.md](arquitectura/frontend.md) y [integracion-backend.md](arquitectura/integracion-backend.md) (contrato propuesto entre pipeline e interfaz) |
| [datos/](datos/) | [base-datos-fuente.md](datos/base-datos-fuente.md): los 638 PDFs y la limpieza propuesta. [matriz-ica-diagnostico.md](datos/matriz-ica-diagnostico.md): estructura y problemas de la matriz |
| [informes/](informes/) | Generados por `motor`; no se editan a mano. [set-de-oro-resumen.md](informes/set-de-oro-resumen.md) y `catalogo-borrador.xlsx` (para el equipo de contaduría) |
| [ficha/](ficha/) | Ficha técnica v4 (octubre 2026), en texto y PDF |
| [superpowers/](superpowers/) | Diseño (`specs/`) y plan (`plans/`) de cada hito. Son registros históricos: describen lo que se decidió en su momento |

## Convenciones

- Todo se escribe en español de Colombia.
- Los diagramas van en Mermaid, dentro de bloques ` ```mermaid `. GitHub y VS Code los dibujan.
- Los informes de `informes/` se regeneran con `uv run motor verificar` y `uv run motor catalogo`. Si cambian, se commitean junto con el código que los cambió.
- Las decisiones de cada hito quedan en su diseño de `superpowers/specs/`. La bitácora detallada de ejecución está en `.superpowers/` (local, fuera de git).
