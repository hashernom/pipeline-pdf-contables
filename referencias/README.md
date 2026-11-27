# referencias

Material de trabajo del equipo de investigación que sí va en git: es liviano y sirve de contexto. Los PDFs y la matriz están en `datos/`, fuera de git.

| Archivo | Qué es | ¿Lo usa el motor? |
|---|---|---|
| `DIVIPOLA-_Códigos_municipios_20260726.xlsx` | Códigos DANE oficiales de municipios | **Sí**: `config.DIVIPOLA`, paso `identidad` |
| `Posibles proyectos de acuerdo.xlsx` | PDFs que el equipo marcó como posibles borradores | No: el motor lee la copia de `datos/fuente/…/Revisión/` |
| `municipios udes - ORIGINAL SIN EDITAR.xlsx` | Lista original de municipios UDES | No |
| `municipios udes - CORREGIDO.xlsx` | Lista de municipios UDES corregida por el equipo | No |
| `Cruce municipios udes.xlsx` | Cruce de los 257 municipios UDES con sus PDFs (cita 312, todos en disco) | No |
| `Acuerdos faltantes por municipio.xlsx` | Municipios sin acuerdo encontrado | No |
| `Comparación nombre original vs actual.xlsx` | Nombre original de cada PDF frente a su nombre estandarizado (trazabilidad) | No |
| `Actualización 2019-2020.xlsx` | Seguimiento de actualizaciones de acuerdos | No |
| `Hallazgos - Acuerdos Municipales.docx` | Lecciones de extracción del equipo (certificación sobre portada, "N°" leído como "N2"...): sirven como casos de prueba | No |
| `Revisión.docx`, `documentacion_proceso.docx` | Notas del proceso de recolección y revisión | No |

El análisis completo de este material está en [docs/datos/base-datos-fuente.md](../docs/datos/base-datos-fuente.md).

Las descripciones de `Actualización 2019-2020.xlsx`, `Acuerdos faltantes…`, `Revisión.docx` y `documentacion_proceso.docx` se infieren del nombre. Si alguna no calza, corrígela aquí.
