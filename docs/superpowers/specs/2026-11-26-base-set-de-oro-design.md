# Diseño: base del motor (corpus, catálogo y set de oro verificado)

Fecha: 26 nov 2026 · Estado: borrador para aprobación

## 1. Intención

Antes de construir el motor de extracción hace falta una base confiable contra la cual medirlo. El material existe pero está desordenado:

- 638 PDFs únicos de acuerdos tributarios municipales: [base-datos-fuente.md](../../datos/base-datos-fuente.md).
- Una matriz de investigación (UTS, macroproyecto DIE-PI-001-126) con 508 municipios y 857 columnas: [matriz-ica-diagnostico.md](../../datos/matriz-ica-diagnostico.md).

Este trabajo convierte ese material en tres cosas reproducibles:

1. un **corpus** plano y trazable de PDFs;
2. un **catálogo de variables** borrador (la Fase 0 de la ficha: tipo, valores permitidos, criterio, dónde buscar) para el alcance aprobado;
3. un **set de oro** normalizado, donde cada valor de la matriz queda marcado según si su cita se comprueba en el PDF.

**Por qué:** la ficha exige medir la precisión del motor "contra el set de oro". Si el set de oro tiene citas falsas (16-23 % según la hoja), la medición miente. Además, el verificador de citas que se construye aquí es el mismo check `cita_en_pagina` que usará el motor.

## 2. Alcance aprobado (primera versión)

Hojas de la matriz:
- **Identificación:** DANE, departamento, municipio, acuerdo, año.
- **Elementos del tributo:** 13 bloques con cita y sus casillas.
- **Actividades no sujetas:** 2 bloques.
- **Tarifas:** 19 secciones CIIU con mínimo y máximo, más el bloque de tarifas de e-commerce.

Fuera de la primera versión: Principios, las copias `_Limpieza` y las otras 8 hojas temáticas. El código no debe asumir solo estas tres hojas: agregar una hoja después tiene que ser configuración, no reescritura.

## 3. Metas, no-metas y anti-metas

**Metas**
- Volver a correr todo con un comando desde los archivos fuente, y que el resultado salga igual.
- Que cada fila del set de oro tenga trazabilidad completa: municipio, PDF (sha256), hoja, bloque, campo, valor original, valor normalizado, art., pág., cita y veredicto de verificación.
- Que el catálogo borrador quede revisable por el equipo de contaduría en Excel.

**No-metas**
- OCR. Las páginas escaneadas sin texto quedan como `sin_texto`; la Fase 1 de la ficha las cubre aparte. **Consecuencia:** de las 430 filas emparejadas, 149 caen en PDFs digitales, 70 en PDFs con capa OCR previa, 11 en mixtos y **200 en escaneados**. Sin OCR, como máximo la mitad del set de oro queda verificada en esta versión. Como todo es reproducible, al terminar el piloto OCR basta con volver a correr `motor verificar`. *(Confirmado por el usuario el 26 nov 2026.)*
- LLM, backend (NestJS, Supabase), cola y cambios en el frontend.
- Decidir los criterios contables de cada casilla. El catálogo los deja como `pendiente` para que los apruebe el equipo.

**Anti-metas** (sería un fracaso aunque funcione)
- Corregir valores de la matriz "a ojo" sin dejar rastro. Toda corrección queda registrada con su motivo.
- Borrar o modificar el material original de `datos/fuente/` o la matriz.
- Marcar como "confiable" una cita que el sistema no comprobó en el PDF.

## 4. Restricciones

- **Python 3.12+, entorno con `uv`.** La ficha fija Python para extracción, y `uv` 0.10 ya está instalado.
- **Librerías,** consultadas en context7: PyMuPDF 1.28 (`import pymupdf`), Pydantic 2.12, RapidFuzz (`fuzz.partial_ratio_alignment`), openpyxl 3.1 y PyYAML 6.
- **Los datos reales no van a git** (`datos/` ya está ignorado). Sí van a git el código, el catálogo y los informes resumidos.
- **Interfaz en español de Colombia.** Los `detalle` de los checks se escriben como frases que verá el estudiante, igual que en [integracion-backend.md](../../arquitectura/integracion-backend.md).
- **Catálogo con enums propios** (temas y tipos de la matriz). El tipo `Variable` de `web/src/lib/types.ts` se diseñó para estados financieros y no encaja: sus `seccion` y `tipo` son de balance, y `regla`/`critica` son obligatorios. El frontend se adapta en el diseño del motor, con un adaptador o cambiando el tipo. *Decisión de diseño, tomada tras la revisión del constructor.*

## 5. Enfoques considerados

| Enfoque | Qué es | A favor | En contra |
|---|---|---|---|
| **A. Scripts Python reproducibles** (elegido) | Paquete `motor/` con pasos que leen la fuente y escriben salidas versionadas | Reproducible; reutiliza el verificador en el motor; si llega otra versión de la matriz, se regenera | El equipo revisa un Excel generado, no su matriz |
| B. Cargar directo en Supabase | Esquema Postgres ya, matriz cargada ahí | Queda en la base final | Fija el esquema antes de conocer el set de oro; infraestructura sin backend todavía |
| C. Limpieza manual en Excel | Copia curada a mano | Fácil para el equipo | No reproducible, no detecta citas falsas, contradice la verificación por código |

Lo eligió el usuario el 26 nov 2026. B queda aplazado: las salidas de A se cargan a Supabase cuando exista el backend.

## 6. Diseño

### 6.1 Estructura

```
motor/                      paquete Python (uv)
  pyproject.toml
  src/motor/
    corpus.py               inventario + corpus plano (absorbe scripts/inventario_pdfs.py)
    matriz.py               lectura y normalización de la matriz
    identidad.py            DANE (DIVIPOLA) y emparejamiento fila → PDF
    catalogo.py             esquema Pydantic + generación del borrador
    verificacion.py         checks cita_en_pagina / valor_de_cita
    cli.py                  `motor corpus|matriz|catalogo|verificar|todo`
  catalogo/variables.yaml   catálogo borrador (versionado en git)
  tests/                    pytest, con casos sacados de los hallazgos reales
datos/                      (ignorado)
  fuente/                   original, solo lectura
  corpus/                   638 PDFs con nombre estándar + corpus.csv
  oro/                      salidas del set de oro
docs/informes/              resúmenes versionados (md)
```

### 6.2 Corpus

- Copia los 638 PDFs canónicos a `datos/corpus/<sha256[:12]>_<nombre_estandar>.pdf`. El prefijo de hash evita choques, como el de los dos archivos que en Windows solo difieren en mayúsculas.
- Escribe `datos/corpus/corpus.csv`: sha256, nombre, categoría original (udes / udes_sobrante / corpus_general / anadido), DANE, tipo_doc, número, año, es_modificacion, páginas y la mezcla de tipos de página del inventario.
- El original no se toca. La limpieza de `datos/fuente/` (sección "Propuesta de limpieza" de base-datos-fuente.md) es un paso aparte que el usuario aprueba después de ver el corpus.

### 6.3 Matriz → formato largo

- Detecta la fila de encabezados de cada hoja (la que tiene "Código Dane" en la columna B). No la asume fija: en Territorialidad está una fila más arriba.
- Reconstruye la jerarquía de encabezados (bloque → campo) a partir de las celdas combinadas de las filas `encabezado-1` y `encabezado`.
- Descarta filas sin DANE real: totales, "Media", firmas y las 140 vacías con fórmula 0.
- La identificación se lee de `Principios`, que es la fuente real: las demás hojas la traen con fórmulas por posición. Se valida que la columna A (consecutivo) coincida.
- **Fuente:** las hojas originales de `Matriz ICA Distribución Curación_verificacion.xlsx` (raíz del repo), que es la versión que entregó el equipo. Las diferencias con las copias `_Limpieza` (hoy solo la fila de Tierralta) se aplican como **corrección registrada** con origen `limpieza_equipo`, conservando el valor original en su columna.
- Normaliza valores:
  - Sí/No: `si|SI|Si` → `si`, `no|NO|No` → `no`; `No aplica|NA|N/A|NG` → `no_aplica`.
  - En tarifas, `0` → `no_aplica` solo si la regla del catálogo lo indica.
  - `Art.`/`Pág.` con varios valores se separan en listas y se marca `pagina_ambigua`.
- **Siempre se conserva el valor original junto al normalizado.**
- Salida `datos/oro/matriz_larga.csv`: municipio_fila, hoja, bloque, campo, valor_original, valor_normalizado, art, pag, cita y bandera de normalización.

### 6.4 Identidad

- **DANE:** si el código está en DIVIPOLA y coincide con el nombre, se acepta. Si no, se busca un candidato único por nombre normalizado + departamento, y después por los 3 dígitos del municipio + departamento. Cada corrección queda en `datos/oro/correcciones_dane.csv`. Sin candidato único, la fila queda `dane_sin_resolver` (hoy son 2).
- **Emparejamiento fila → PDF:** se parsean número(s) y año del texto "Acuerdo" (usando la columna F como año de respaldo) y se busca en el corpus por DANE + número + año.
- **Regla de emparejamiento:** se empareja con el PDF cuyo número y año coinciden con lo que cita la fila, sea Acuerdo, Decreto o Modificación. Nunca se sustituye por "el acuerdo base" ni por "el más reciente". Se copian al resultado `tipo_doc`, `es_modificacion` y la marca de posible borrador (`Posibles proyectos de acuerdo.xlsx`). Un borrador sí se empareja, pero su veredicto nunca pasa de `revisar`.
- Resultados posibles: `coincide` (hoy 430), `otro_acuerdo` (66), `sin_pdf` (5), `sin_numero_legible` (5) y `varios_acuerdos` (51 filas citan más de uno; ver P2).
- Salida `datos/oro/documentos.csv`.

### 6.5 Catálogo borrador

- Se genera de los encabezados de las 3 hojas: un `Bloque` (art, pág, cita, presencia) y sus `Campo` (tipo inferido de los valores reales: si_no, numero, texto_libre).
- **Esquema Pydantic:**
  - `Bloque`: key, nombre, hoja, palabras_clave, campos.
  - `Campo`: key, nombre, tipo, unidad, valores_permitidos, criterio, critica, metodo, estado (`borrador`).
- **Lo que no se puede inferir queda `pendiente`**, sin inventarlo: criterio, unidad de las tarifas, qué campos son críticos.
- Se exporta a Excel (`docs/informes/catalogo-borrador.xlsx`, una fila por campo) para que el equipo lo revise. El YAML es la fuente; el Excel es solo para revisar.

### 6.6 Verificación del set de oro

**Convención de página:** `Pág.` se interpreta como índice de página del PDF, base 1. Es lo que usaron los estudiantes en la mayoría de casos: el 77 % de las citas aparece exactamente en ese índice. Cuando la cita aparece en otra página se registra el desfase. Si un PDF muestra un desfase constante (página impresa ≠ índice), el informe lo agrupa por documento en vez de reportarlo cita por cita.

Por cada bloque con cita de una fila `coincide`:
- **`cita_en_pagina`:**
  - Se normaliza el texto (minúsculas, sin tildes ni signos) y se alinea la cita con cada página usando `fuzz.partial_ratio_alignment`.
  - Resultados: `pasa` (página anotada), `pagina_desplazada` (encontrada en otra página; se registra el desfase), `no_encontrada` o `sin_texto` (página escaneada sin capa).
  - Las páginas con capa OCR previa se usan, pero el veredicto queda marcado `fuente_ocr_previa`.
- **`valor_de_cita`:** para tarifas, el número debe aparecer en la cita o en la página citada. Para casillas Sí/No no se verifica en esta versión (necesita el LLM); quedan `no_verificable`.
- **Veredicto por fila:** `confiable` (pasa), `revisar` (desplazada, ambigua, con capa OCR previa o borrador), `dudosa` (no encontrada) o `sin_texto`.
- **El set de oro distingue lo verificado de lo no verificado.** Cada valor lleva `verificacion ∈ {verificado, no_verificable, sin_texto}`, y el informe da los conteos de cada uno. Así nadie confunde "está en la matriz" con "está comprobado". Cómo se calcula la precisión del motor (qué filas cuentan en el denominador) se define en el diseño del motor.
- Salidas:
  - `datos/oro/set_de_oro.csv`: formato largo con veredicto.
  - `docs/informes/set-de-oro-resumen.md`: tasas por hoja y por bloque, desfases típicos y ejemplos.

**Umbrales y casos de prueba:**
- Los valores iniciales del umbral se calibran con los datos ya medidos (77 % exacto con coincidencia literal). Por ejemplo: `pasa` si score ≥ 90 en la página anotada. El umbral es configurable y su valor final es decisión del constructor, documentada en el informe.
- Los tests incluyen casos reales: Tierralta (fila corregida en `_Limpieza`), citas desplazadas ±1, páginas escaneadas y una cita inventada a propósito.

## 7. Qué queda al constructor

- Nombres internos de funciones y estructura de los tests.
- Formato intermedio (CSV o Parquet), siempre que las salidas finales sean CSV legibles en Excel (UTF-8 con BOM).
- Umbrales exactos de RapidFuzz, justificados en el informe.
- Si `scripts/inventario_pdfs.py` se mueve al paquete o se deja como envoltorio.

## 8. Preguntas abiertas

- ~~P0. ¿OCR dentro o fuera de esta fase?~~ **Resuelta: fuera.** Se vuelve a correr la verificación después del piloto OCR (Fase 1).

- **P1. Tarifas:** ¿la unidad es por mil en todas las secciones? Hay valores como 0,03 y 100 que no encajan. ¿Y el `0` (3.139 casos) significa "no aplica" o una tarifa real de cero? Mientras no se responda, los valores de tarifa del set de oro quedan `no_verificable` en su normalización (el valor original se conserva).
- **P2. Filas con varios acuerdos (51):** ¿el valor de la matriz corresponde al más reciente, o a la combinación de todos?
- **P3. Criterio de las casillas Sí/No:** ¿"Sí" exige mención explícita en el acuerdo? (No bloquea esta versión: queda `pendiente` en el catálogo.)

## 9. Plan por nodos y estimación

Base: tabla inicial (el historial no tiene hitos cerrados).

**Nodo 01: Entorno y paquete**
- **Depende de:** ninguno. **Desbloquea:** 02, 03. **En paralelo con:** —.
- **Contrato compartido:** estructura de `motor/`, CLI.
- **Tipo:** infra. **Riesgo:** Bajo (si falla, no instala; se nota de inmediato).
- **Horas dev:** 1–2.
- **Verificación:** `uv run pytest` corre (vacío) y `uv run motor --help` responde.
- **Bloqueos externos:** ninguno.

**Nodo 02: Corpus plano**
- **Depende de:** 01. **Desbloquea:** 04. **En paralelo con:** 03 (no comparten archivos).
- **Contrato compartido:** `corpus.csv` (columnas de 6.2).
- **Tipo:** datos. **Riesgo:** Bajo (copia; el original intacto).
- **Horas dev:** 1–2.
- **Verificación:** 638 archivos, cada sha256 igual al del inventario, y `datos/fuente/` sin cambios (hash antes y después).
- **Bloqueos externos:** ninguno.

**Nodo 03: Matriz a formato largo**
- **Depende de:** 01. **Desbloquea:** 04, 05. **En paralelo con:** 02.
- **Contrato compartido:** `matriz_larga.csv` (6.3).
- **Tipo:** datos. **Riesgo:** Medio (encabezados combinados e irregulares; un error de mapeo desplaza columnas en silencio; se nota en los conteos por hoja).
- **Horas dev:** 4–8 (3–6 × 1,3 por formatos inconsistentes).
- **Verificación:** 508 filas reales; conteos de Sí/No por campo iguales a los del Excel; test con Tierralta.
- **Bloqueos externos:** ninguno.

**Nodo 04: Identidad y emparejamiento**
- **Depende de:** 02, 03. **Desbloquea:** 06. **En paralelo con:** 05 (si `matriz_larga.csv` está fijado).
- **Contrato compartido:** `documentos.csv` (6.4).
- **Tipo:** datos. **Riesgo:** Medio (un DANE mal corregido asigna el PDF de otro municipio; se nota en el cruce de nombres).
- **Horas dev:** 3–6.
- **Verificación:** las cifras de 6.4 se reproducen (±2, con explicación de cada diferencia); correcciones de DANE revisadas una por una en el CSV.
- **Bloqueos externos:** ninguno.

**Nodo 05: Catálogo borrador**
- **Depende de:** 03. **Desbloquea:** 06. **En paralelo con:** 04.
- **Contrato compartido:** esquema Pydantic + `variables.yaml`, mapeable a `Variable` del frontend.
- **Tipo:** datos. **Riesgo:** Medio (si el catálogo se equivoca de tipo, el motor normaliza mal después; se nota en la revisión del equipo).
- **Horas dev:** 4–8 (3–6 × 1,3 por criterios no definidos).
- **Verificación:** el YAML valida con Pydantic; el Excel exportado tiene un campo por columna de las 3 hojas; ningún criterio inventado (todos `pendiente` o derivados del encabezado).
- **Bloqueos externos:** revisión del equipo de contaduría (no bloquea el nodo 06).

**Nodo 06: Verificador de citas**
- **Depende de:** 04, 05. **Desbloquea:** 07. **En paralelo con:** —.
- **Contrato compartido:** `Check` (tipo, resultado, detalle) igual al de `web/src/lib/types.ts`.
- **Tipo:** api (lógica). **Riesgo:** Alto (umbrales con incertidumbre real; un umbral laxo marca como confiables citas falsas y contamina el set de oro; es el mismo check del motor).
- **Horas dev:** 5–10.
- **Verificación:** tests con casos reales (exacta, ±1, escaneada, cita inventada); en PDFs digitales, la tasa de `pasa` queda en el rango ya medido (≈77 % en Elementos y similares por hoja).
- **Bloqueos externos:** ninguno.

**Nodo 07: Set de oro e informe**
- **Depende de:** 06. **Desbloquea:** motor de extracción (siguiente diseño). **En paralelo con:** —.
- **Contrato compartido:** `set_de_oro.csv`.
- **Tipo:** docs. **Riesgo:** Bajo.
- **Horas dev:** 2–3 (fuera de tabla: informe + Excel generados por código).
- **Verificación:** `motor todo` regenera todo desde cero con resultados idénticos; el informe muestra tasas por hoja y bloque.
- **Bloqueos externos:** ninguno.

**Cierre del plan**
- **Camino crítico:** 01 → 03 → 04 → 06 → 07.
- **Paralelismo máximo:** 2 nodos (02 con 03, y luego 04 con 05).
- **Puntos de revisión humana:** nodo 06 (umbrales, riesgo alto); revisión del catálogo por el equipo (nodo 05); aprobación de la limpieza de `datos/fuente/` (fuera de este plan).
- **Supuestos:**
  - La matriz recibida es la versión vigente.
  - Las 3 hojas del alcance no cambian de estructura.
  - El texto digital de PyMuPDF basta para verificar sin OCR.

### Estimación para el cliente

| Hito | Nodos | Horas dev | Días hábiles | Depende del cliente |
|---|---|---|---|---|
| 0. Definición | — | 2–4 | 1 | Respuestas a P1 y P2; aprobación de este diseño |
| 1. Corpus y matriz normalizada | 01, 02, 03, 04 | 11–23 | 3–5 | — |
| 2. Catálogo y set de oro verificado | 05, 06, 07 | 14–26 | 3–6 | Revisión del catálogo por el equipo de contaduría |
| **Total** | | **27–53** | **7–12** | |

**Compromiso sugerido:** 12 días hábiles desde la aprobación de este diseño, con P1 y P2 respondidas. Se reestima al cerrar el nodo 06 (el de riesgo alto). Base: tabla inicial.
