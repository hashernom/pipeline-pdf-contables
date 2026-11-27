# Base de datos fuente: verificación del zip (26 nov 2026)

Verificación de solo lectura de `datos/OneDrive_2026-11-26.zip` (antes en `infoEjemplo/`) (8,8 GB), extraído en `datos/fuente/` (ignorado por git). No se movió, renombró ni borró ningún archivo del material.

- Inventario reproducible: `cd motor && uv run motor inventario` → `datos/inventario/pdfs.csv` (1 fila por PDF) y `paginas.csv` (1 fila por página, 105.818 en total).
- Clasificación de página según la FAQ de PyMuPDF 1.28.2 (consultada en context7) + cobertura de imagen + calidad de texto.

## Qué contiene el zip

Es la carpeta de trabajo completa del proyecto anterior de estandarización de acuerdos (julio 2026). **No trae la matriz de variables ni filas diligenciadas.**

Búsqueda de la matriz, repetida a fondo:
- Los 905 archivos del zip quedaron extraídos con verificación CRC.
- Se revisaron los 25 Excel (sin hojas ocultas), los 3 Word, el `Revisión.zip` anidado y las primeras 3 páginas y el título de los 728 PDFs.
- La carpeta `respaldo/Grupo 19/.../Acuerdos municipales matriz/` **contenía 121 PDFs de acuerdos**, no una hoja de cálculo (sección 0 de `DOCUMENTACION_PROCESO.md`). El proyecto anterior arrancó con 710 PDFs y 10 `desktop.ini`, sin ningún Excel de variables.
- Los `desktop.ini` apuntan a Google Drive File Stream y solo hay 9 de 19 grupos (1, 5, 9, 10, 11, 12, 16, 17, 19). La matriz probablemente vive en ese Drive original, quizá como Google Sheet, que no se copia como archivo.

| Contenido | Cantidad |
|---|---|
| PDFs en total | 728 (727 acuerdos + `subregiones.pdf`) |
| PDFs canónicos (únicos, nombre estándar) | **638** |
| Duplicados exactos (mismo SHA-256 que uno canónico) | 85 |
| "Duplicados luego de la estandarización" (otra versión, hash distinto) | 4 |
| Municipios distintos (DANE) en los canónicos | 509 |

Los 638 canónicos se reparten en: `Acuerdos Municipales/` raíz 327, `municipios udes/` 239, `municipios udes/acuerdos sobrantes/` 55 y `acuerdos añadidos/` 17.

## Lo verificado (base sólida)

- **Los 728 PDFs abren sin error.** Ninguno está cifrado ni dañado.
- **Los 638 canónicos tienen nombre estándar** `DANE_Tipo_Número_Año_Municipio[_Modificacion].pdf` y no hay duplicados entre ellos.
- **Los 509 códigos DANE existen en DIVIPOLA** (1.122 municipios, catálogo del 26 jul 2026).
- **El cruce con los 257 municipios UDES es consistente con el disco:** los 312 PDFs que cita `Cruce municipios udes.xlsx` existen, y todo PDF de la carpeta `municipios udes/` aparece en el cruce.
- **`Comparación nombre original vs actual.xlsx` cuadra:** 621 de 625 nombres actuales están en disco. Los 4 restantes son justo los de `duplicados/duplicados luego de la estandarizacion/`.

## Perfil de los PDFs canónicos (dato para el piloto OCR)

90.082 páginas; mediana 147 páginas por PDF; máximo 441.

| Tipo de página | Páginas | % | Qué implica |
|---|---|---|---|
| digital | 37.090 | 41 % | Texto directo con PyMuPDF |
| escaneada (sin texto) | 38.404 | 43 % | Necesita OCR |
| capa OCR previa (texto sobre imagen) | 14.518 | 16 % | Hay texto, pero de calidad desconocida; ver abajo |
| texto corrupto | 65 | <0,1 % | Tratar como escaneada |
| vacía | 5 | — | — |

Por documento: 309 escaneados, 215 digitales, 102 con capa OCR previa y 12 mixtos.

**Capa OCR previa.** En 102 PDFs ya hay texto, puesto por un OCR de quien escaneó el documento. A veces es bueno y a veces trae ruido de sellos y logos (San Antero p. 1: `rre-_"tario 6d Mllt'licirmus.n`). El piloto debe decidir si se confía en esa capa o se vuelve a pasar OCR.

**Sobre el "texto basura" del proyecto anterior.** Su detector marcó 40 archivos. Al revisarlos, la mayoría eran falsos positivos: penalizaba líneas de `____` y los puntos de los índices (Tarso, Apía, Girón tienen texto limpio). Los casos reales son ruido parcial dentro de capas OCR, no capas enteras ilegibles.

## Características del corpus que afectan la extracción

- **124 de 638 son modificaciones** (`_Modificacion`), no estatutos completos. 108 municipios tienen 2 o más PDFs, así que el dato vigente puede estar repartido entre el acuerdo base y sus modificaciones.
- **15 son Decretos**, no Acuerdos (p. ej. decretos de sanción o compilación).
- **3 sin año** (`SINANIO`) y **13 posibles borradores** ("proyecto de acuerdo"), según `Posibles proyectos de acuerdo.xlsx`.
- **Años:** concentrados en 2020 (170) y 2021 (117), por el plazo del Régimen SIMPLE (Ley 2010 de 2019).
- **Lecciones de extracción** documentadas en `Hallazgos - Acuerdos Municipales.docx` y `correcciones_manuales.csv`: la página de certificación o sanción manda sobre la portada, "N°" leído como "N2", el año tomado como número de acuerdo, números de trámite compuestos ("100-02.01"). Sirven como casos de prueba.

## Propuesta de limpieza (no ejecutada; pendiente de aprobación)

**Conservar como base:**
- Los 638 PDFs canónicos, idealmente en una sola carpeta plana con su nombre estándar y la categoría como dato (no como carpeta).
- `DIVIPOLA`, `municipios udes - CORREGIDO.xlsx`, `Cruce municipios udes.xlsx`, `Comparación nombre original vs actual.xlsx` (trazabilidad al nombre original), `Posibles proyectos de acuerdo.xlsx`, `Actualización 2019-2020.xlsx`, `Acuerdos faltantes por municipio.xlsx`.
- `Hallazgos - Acuerdos Municipales.docx`, `DOCUMENTACION_PROCESO.md` (historia) y `correcciones_manuales.csv` (casos de prueba).

**Eliminar o archivar comprimido:**
- `duplicados/hash identicos` y `nombre y hash identicos`: 85 copias exactas, se pueden borrar sin pérdida.
- `duplicados/duplicados luego de la estandarizacion`: 4 versiones distintas. **Revisar antes de borrar.**
- `respaldo/`: carpetas de grupo vacías y `desktop.ini`.
- `respaldo_trabajo_temporal/`: scripts con rutas de otro PC, recortes PNG, `tessdata`, CSV intermedios y `texto_cache.json` (solo página 1, superado por el inventario).
- `Revisión.zip` y las copias de Excel repetidas en raíz y en `Revisión/` (`municipios udes.xlsx` es idéntico a `ORIGINAL SIN EDITAR`).
- `subregiones.pdf` y `dane_reference_subregiones.csv` (censo 2005, superados por DIVIPOLA).
- Los `registro_*.tsv` y `verificacion_*.tsv`: historia de movimientos, ya consolidada en la documentación.
- En el repo: `referencias/` (antes `infoEjemplo/`) duplica parte de `Revisión/`. El duplicado por mayúsculas de `municipios udes - CORREGIDO.xlsx` se resolvió el 26 nov 2026 (la otra versión sigue en `datos/fuente/`). El zip de 8,8 GB (ahora en `datos/`) puede borrarse una vez aprobada la base.

## Preguntas abiertas que bloquean el motor de extracción

1. **La matriz de variables no vino en el zip.** Sin ella no hay catálogo, reglas ni set de oro.
2. **Set de oro:** hoy solo existe para identificación (DANE, número, año, municipio) de los 638 PDFs. No hay valores de referencia para tarifas ni demás variables.
3. **Alcance:** ¿se procesan los 638 PDFs (509 municipios) o solo los 257 municipios UDES (294 PDFs con sobrantes)? La ficha habla de 1.200.
4. **Documento que manda por municipio:** ¿el más reciente, o el estatuto vigente reconstruido con base + modificaciones?
5. **Decretos y borradores:** ¿entran, se marcan o se excluyen?
