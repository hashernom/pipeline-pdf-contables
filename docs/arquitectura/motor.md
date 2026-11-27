# Motor (`motor/`)

Paquete de Python que convierte el material del equipo (PDFs y matriz Excel) en un **set de oro verificado** (pasos 1 a 6) y, con el hito 1, extrae los datos de los acuerdos con DeepSeek y los mide contra ese set (pasos 7 y 8). Corre con `uv run motor <paso>`. Los diagramas están en [uml.md](uml.md).

## Los ocho pasos

`uv run motor todo` corre los seis primeros en orden (los pasos 7 y 8 llaman al modelo y cuestan dinero, así que se piden aparte). Cada paso lee lo que dejó el anterior, así que también se pueden correr por separado.

| # | Comando | Lee | Escribe | Qué hace |
|---|---|---|---|---|
| 1 | `inventario` | `datos/fuente/**/*.pdf` | `datos/inventario/pdfs.csv`, `paginas.csv` | Recorre los PDFs y clasifica cada página: `digital`, `capa_ocr`, `texto_corrupto`, `escaneada` o `vacia`. Es lento (decenas de minutos) |
| 2 | `corpus` | `pdfs.csv` | `datos/corpus/<sha256>.pdf`, `corpus.csv` | Deja una sola copia por contenido (sha256), con un nombre estándar `DANE_Tipo_Número_Año` |
| 3 | `matriz` | la matriz Excel | `datos/oro/matriz_larga.csv` | Pasa de "una fila por municipio y 850 columnas" a "una fila por dato". Aplica las 28 correcciones de Tierralta de las hojas `_Limpieza` |
| 4 | `identidad` | matriz, DIVIPOLA, `corpus.csv`, borradores | `datos/oro/documentos.csv`, `correcciones_dane.csv` | Corrige el código DANE y empareja cada fila de la matriz con su PDF |
| 5 | `catalogo` | la matriz Excel | `motor/catalogo/variables.yaml`, `docs/informes/catalogo-borrador.xlsx` | Infiere bloques y campos, con tipo y valores permitidos. Criterios en `pendiente`. Con `--enriquecer` el modelo redacta el criterio de cada campo y elige las palabras clave de cada bloque (hay que revisarlos a mano) |
| 6 | `verificar` | todo lo anterior | `datos/oro/set_de_oro.csv`, `docs/informes/set-de-oro-resumen.md` | Busca cada cita en su página del PDF y le pone un veredicto a cada dato |
| 7 | `extraer --grupo {ajuste,prueba,todos} --estrategia {localizada,completa} [--limite N] [--si]` | `corpus/`, `variables.yaml`, `set_de_oro.csv` | `datos/extraccion/extracciones_<grupo>_<estrategia>.csv`, `resumen_<grupo>_<estrategia>.json`, `particion.csv`, `cache/` | Por cada documento y bloque, pide al modelo la cita y los valores, verifica la cita contra el PDF y asigna un semáforo. Imprime una estimación de costo y se detiene si supera `TOPE_USD_CORRIDA` (10 USD); `--si` no pide confirmación |
| 8 | `evaluar` | `extracciones_*.csv`, `set_de_oro.csv` | `docs/informes/extraccion-piloto.md` | Compara lo extraído con el set de oro: citas reales, cobertura, acierto en valores y costo. Si hay corridas de las dos estrategias, las compara |

## Módulos

| Módulo | Responsabilidad | Funciones públicas |
|---|---|---|
| `config.py` | Rutas y umbrales. **Es el único lugar con rutas** | `RAIZ`, `MATRIZ`, `DIVIPOLA`, `HOJAS_ALCANCE`, `UMBRAL_CITA`... |
| `normalizar.py` | Normalización de texto y valores | `texto_busqueda`, `valor_canonico`, `slug`, `nombre_lugar`, `es_vacio` |
| `inventario.py` | Paso 1 | `generar`, `tipo_pagina`, `categoria` |
| `corpus.py` | Paso 2 y acceso al texto por página | `construir`, `paginas_con_texto`, `fuente_texto` |
| `matriz.py` | Paso 3: estructura de las hojas y celdas | `estructura`, `identidades`, `celdas`, `escribir_larga` |
| `identidad.py` | Paso 4: DANE y emparejamiento | `resolver_dane`, `acuerdos_citados`, `emparejar`, `escribir_documentos` |
| `catalogo.py` | Paso 5: modelo Pydantic del catálogo | `generar`, `guardar_yaml`, `cargar_yaml`, `exportar_excel` |
| `verificacion.py` | Verificador de citas (lo reutiliza el extractor del hito 1) | `verificar_cita`, `verificar_valor_en_pagina` |
| `oro.py` | Paso 6: arma el set de oro | `construir` |
| `informe.py` | Paso 6: resumen en Markdown | `escribir` |
| `llm.py` | Cliente DeepSeek (API compatible con OpenAI) con caché de respuestas en disco y conteo de tokens y costo | `Cliente`, `Uso`, `Respuesta`, `estimar_tokens` |
| `muestras.py` | Partición ajuste/prueba del set de oro (semilla fija) y referencias para evaluar | `particion`, `referencias`, `ejemplos`, `citas_referencia` |
| `localizar.py` | Elige las páginas del documento que se le entregan al modelo para un bloque | `palabras_clave`, `paginas_localizadas`, `paginas_completas` |
| `extractor.py` | Extrae un bloque: arma el pedido, llama al modelo, verifica la cita y asigna el semáforo | `extraer_bloque`, `armar_mensajes`, `Extraccion` |
| `corrida.py` | Paso 7: procesa documentos en paralelo, estima y suma costos, escribe el CSV | `correr`, `estimar_costo`, `documentos_objetivo` |
| `evaluacion.py` | Paso 8: métricas contra el set de oro | `evaluar`, `comparar_estrategias`, `Metricas` |
| `informe_extraccion.py` | Paso 8: informe en Markdown | `escribir` |
| `cli.py` | Línea de comandos | `main` |

## Reglas clave

### Emparejamiento fila → PDF (`identidad.py`)

La fila se empareja **por el número y el año exactos del acuerdo que cita**. Nunca se sustituye por el acuerdo base ni por el más reciente del municipio.

| `estado` | Significado | Filas |
|---|---|---|
| `coincide` | Hay un PDF con ese número y año | 386 |
| `otro_acuerdo` | El municipio tiene PDF, pero de otro acuerdo | 62 |
| `varios_acuerdos` | La celda cita varios acuerdos (pregunta P2) | 51 |
| `sin_numero_legible` | No se pudo leer el número | 5 |
| `sin_pdf` | El municipio no tiene PDF | 4 |

### Verificación de una cita (`verificacion.py`)

`Pág.` es el **índice de página del PDF** (base 1), no el número impreso. La cita y la página se normalizan (minúsculas, sin tildes, solo letras y cifras) y se comparan con `rapidfuzz.fuzz.partial_ratio_alignment`: se busca el tramo de la página más parecido a la cita.

| `estado` de la cita | Cuándo |
|---|---|
| `pasa` | Similitud ≥ `UMBRAL_CITA` (90) en la página anotada |
| `pagina_ambigua` | `Pág.` trae varias páginas y la cita está en una de ellas |
| `pagina_desplazada` | La cita está en otra página del documento |
| `pagina_invalida` | La página anotada no existe en el PDF |
| `no_encontrada` | No aparece en ninguna página |
| `sin_texto` | La página es escaneada |
| `no_verificable` | La cita tiene menos de `MIN_CHARS_CITA` (30) caracteres |

Si la cita cruza un salto de página, se acepta repartida entre dos páginas seguidas solo cuando tiene al menos `MIN_CHARS_CITA_PAR` (120) caracteres. En ese caso queda marcada `entre_paginas` y nunca llega a `confiable`.

### Veredicto de cada dato (`oro.py`)

La cita se verifica **una vez por bloque y fila**. Todos los campos del bloque heredan ese resultado.

| `veredicto` | Regla |
|---|---|
| `confiable` | `pasa`, página digital, no es borrador y no es `entre_paginas` |
| `revisar` | Página ambigua o desplazada, capa OCR, posible borrador o `entre_paginas` |
| `dudosa` | `no_encontrada`, o `pagina_invalida` sin hallazgo en otra página |
| `sin_texto` | La página es escaneada (espera el hito OCR) |
| `sin_cita` | Cita vacía o demasiado corta |
| `sin_documento` | La fila no quedó en `coincide` |

## Archivos generados

Todos son CSV en UTF-8 con BOM, para que Excel los abra bien. La relación entre ellos está en el diagrama de entidades de [uml.md](uml.md#5-archivos-generados-y-sus-relaciones).

| Archivo | Una fila por | Clave |
|---|---|---|
| `inventario/pdfs.csv` | PDF encontrado en la fuente, incluidos duplicados | `ruta` |
| `inventario/paginas.csv` | Página de cada PDF único | `sha256` + `pagina` |
| `corpus/corpus.csv` | PDF único | `sha256` |
| `oro/matriz_larga.csv` | Celda con dato de la matriz | `fila` + `hoja` + `campo_key` |
| `oro/documentos.csv` | Fila de la matriz | `fila` |
| `oro/correcciones_dane.csv` | DANE corregido | `fila` |
| `oro/set_de_oro.csv` | Celda `campo` o `presencia` con dato | `fila` + `hoja` + `campo_key` |
| `extraccion/particion.csv` | Documento con set de oro: grupo `ajuste` (30) o `prueba` (104), semilla fija | `sha256` |
| `extraccion/extracciones_<grupo>_<estrategia>.csv` | Documento, bloque y campo extraído | `sha256` + `hoja` + `campo_key` |
| `extraccion/resumen_<grupo>_<estrategia>.json` | Una corrida: documentos terminados, `documentos_fallidos`, `costo_usd_real`, `segundos_total` | — |
| `extraccion/localizacion_ajuste.csv` | Bloque de ajuste con página de oro: ¿la localización la incluyó? | `sha256` + `bloque_key` |
| `extraccion/cache/` | Respuestas del modelo, una por pedido (clave sha256 del pedido) | — |

**Costo:** las columnas `tokens_*` del CSV de extracciones cuentan también las respuestas que salieron de la caché. El costo real de una corrida, sin lo servido desde la caché, está en `resumen_*.json`.

**Fallos por documento:** si un documento falla (por ejemplo, sin saldo en DeepSeek, HTTP 402), la corrida sigue con los demás y lo anota en `documentos_fallidos`. Volver a correr solo paga los que faltan.

**Tablas largas:** en los bloques de `BLOQUES_TABLA` (las dos tablas de Tarifas), la estrategia `localizada` sigue hacia adelante las páginas con cifras de tarifa, hasta `MAX_PAGINAS_CONTEXTO_TABLA` (24).

**`uv run motor localizar-eval`:** mide, sin llamar al modelo y solo en el grupo de ajuste, qué tan seguido las páginas elegidas incluyen la página del set de oro.

## Pruebas

```powershell
cd motor
uv run pytest -m "not datos"
uv run pytest -m datos
```

- La primera tanda (unas 65 pruebas) es sintética: crea PDFs y matrices pequeñas en memoria y tarda segundos.
- La segunda, `-m datos`, usa los datos reales de `datos/` y tarda varios minutos. Incluye la calibración del verificador: 85,9 % de `pasa` en las citas de Elementos sobre PDFs digitales.

## Cómo extender

- **Agregar una hoja de la matriz:** añádela a `HOJAS_ALCANCE` en `config.py`. `matriz.estructura` detecta bloques y roles de columna (`art`, `pag`, `cita`, `presencia`, `campo`) a partir de los encabezados.
- **Cambiar un umbral:** `config.py`. Después corre `uv run pytest -m datos -k tasa` para ver el efecto en la calibración.
- **Una matriz nueva:** reemplaza el archivo en `datos/matriz/`, mantén el nombre (o cambia `MATRIZ`) y corre `uv run motor todo`.
