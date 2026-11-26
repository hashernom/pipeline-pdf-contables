# Base del motor (corpus, catálogo y set de oro) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un paquete Python `motor/` que, con un comando, convierte los PDFs y la Matriz ICA en un corpus plano, un catálogo de variables borrador y un set de oro con cada cita verificada contra su PDF.

**Architecture:** Pasos independientes y reproducibles (inventario → corpus → matriz larga → identidad → catálogo → verificación → informe). Cada paso lee archivos y escribe CSV/YAML/MD; ninguno modifica la fuente. Los módulos comparten helpers de normalización y una configuración de rutas.

**Tech Stack:** Python ≥3.12 con `uv`, PyMuPDF 1.28 (`import pymupdf`), Pydantic 2.12, RapidFuzz (`fuzz.partial_ratio_alignment`), openpyxl 3.1, PyYAML 6, pytest.

**Spec:** `docs/superpowers/specs/2026-11-26-base-set-de-oro-design.md`

## Global Constraints

- **Solo lectura sobre la fuente.** Nunca escribir en `datos/fuente/`, en `Matriz ICA Distribución Curación_verificacion.xlsx` ni en `infoEjemplo/`.
- **Los datos no van a git.** Las salidas de datos van a `datos/` (ignorado). Van a git: el código, `motor/catalogo/variables.yaml`, `docs/informes/*.md` y `docs/informes/catalogo-borrador.xlsx`.
- **CSV legibles en Excel:** UTF-8 con BOM (`encoding="utf-8-sig"`), separador `,`.
- **Valor original junto al normalizado**, siempre. Toda corrección queda registrada con origen y motivo.
- **Alcance de hojas:** `Elementos del tributo`, `Actividades No Sujetas` y `Tarifas`, más la identificación desde `Principios`. Agregar una hoja es solo agregar su nombre a `HOJAS_ALCANCE`.
- **Textos `detalle` en español de Colombia,** dirigidos al estudiante. Ejemplo: "La cita no aparece en el folio 6".
- **Pruebas:** las unitarias usan fixtures sintéticas (xlsx y PDF generados en la prueba). Las que leen datos reales llevan `@pytest.mark.datos` y se saltan si falta `datos/fuente/`.
- **No hay OCR en esta fase.** Las páginas sin texto se marcan `sin_texto`.

## Review Focus

1. **Bogotá y nombres con comas o "D.C."** (fila 17: `11001`, "Distrito capital", "Bogotá D.C"). Se espera DANE aceptado como `11001`, no `dane_sin_resolver`. La prueba va en la Task 5.
2. **Celda "Acuerdo" con varios acuerdos** (51 filas, separados por saltos de línea). Se espera resultado `varios_acuerdos` con la lista de candidatos y sin elegir uno en silencio. Task 5.
3. **Cita partida por salto de línea o guion** ("presu-\npuesto"). Se espera que la normalización una la palabra y que la cita pase. Task 1 y Task 7.
4. **Página anotada fuera de rango** (0, vacía, mayor que el número de páginas). Se espera que no se caiga y quede `falla` con un detalle claro. Task 7.
5. **Celdas con espacio duro (`\xa0`) o solo espacios.** Se espera que cuenten como vacías y no como valor. Task 1.

---

### Task 1: Paquete, configuración y normalización

**Files:**
- Create: `motor/pyproject.toml`, `motor/src/motor/__init__.py`, `motor/src/motor/config.py`, `motor/src/motor/normalizar.py`, `motor/src/motor/cli.py`
- Create: `motor/tests/conftest.py`, `motor/tests/test_normalizar.py`

**Interfaces:**
- Produces:
  - `config.py`: `RAIZ: Path` (raíz del repo), `FUENTE = RAIZ/"datos/fuente"`, `INVENTARIO = RAIZ/"datos/inventario"`, `CORPUS = RAIZ/"datos/corpus"`, `ORO = RAIZ/"datos/oro"`, `MATRIZ = RAIZ/"Matriz ICA Distribución Curación_verificacion.xlsx"`, `DIVIPOLA = RAIZ/"infoEjemplo/DIVIPOLA-_Códigos_municipios_20260726.xlsx"`, `POSIBLES_BORRADORES = FUENTE/"Acuerdos municipale s/Revisión/Posibles proyectos de acuerdo.xlsx"`, `INFORMES = RAIZ/"docs/informes"`, `CATALOGO = RAIZ/"motor/catalogo/variables.yaml"`, `HOJAS_ALCANCE = ("Elementos del tributo", "Actividades No Sujetas", "Tarifas")`, `HOJA_IDENTIDAD = "Principios"`, `UMBRAL_CITA = 90.0`, `MIN_CHARS_CITA = 30`.
  - `normalizar.py`:
    - `es_vacio(v: object) -> bool`
    - `texto_busqueda(s: str) -> str`: NFKD sin tildes, minúsculas, une guion + salto de línea, colapsa todo lo que no sea `[a-z0-9]` en un espacio.
    - `slug(s: str) -> str`: `[a-z0-9_]`.
    - `valor_canonico(v: object) -> str | None`: devuelve `"si"`, `"no"`, `"no_aplica"`, el número con punto decimal, o el texto sin espacios de los bordes.
    - `nombre_lugar(s: str) -> str`: `texto_busqueda` más quitar "departamento de", "d c", "distrito capital", y luego compactar los espacios.
  - `cli.py`: `main(argv: list[str] | None = None) -> int` con argparse y subcomandos `inventario`, `corpus`, `matriz`, `identidad`, `catalogo`, `verificar` y `todo`. Por ahora todos devuelven 0 sin hacer nada; cada tarea conecta el suyo.
  - En `pyproject.toml`, script `motor = "motor.cli:main"` y marker de pytest `datos`.
  - `conftest.py`: si `config.FUENTE` no existe, salta las pruebas marcadas `datos`. Fixture `wb` (scope `session`): `openpyxl.load_workbook(config.MATRIZ, data_only=True)`, que también se salta si el archivo no existe.

- [ ] **Step 1: Crear el proyecto.** `uv init --package motor` en la raíz (o crear los archivos a mano). Luego `uv add pymupdf pydantic rapidfuzz openpyxl pyyaml` y `uv add --dev pytest` dentro de `motor/`.
- [ ] **Step 2: Escribir pruebas que fallen** en `test_normalizar.py`:

```python
def test_vacios(): assert es_vacio(None) and es_vacio("") and es_vacio("\xa0") and es_vacio("   ") and not es_vacio("0")
def test_si_no(): assert [valor_canonico(x) for x in ["Si","SI","si","sí","No","NO","no"]] == ["si"]*4 + ["no"]*3
def test_no_aplica(): assert {valor_canonico(x) for x in ["No aplica","NA","N/A","NG","n/a"]} == {"no_aplica"}
def test_numero(): assert valor_canonico("4,5") == "4.5" and valor_canonico(10) == "10" and valor_canonico(4.5) == "4.5"
def test_guion_salto(): assert texto_busqueda("presu-\npuesto Público") == "presupuesto publico"
def test_lugar(): assert nombre_lugar("Bogotá D.C") == nombre_lugar("BOGOTÁ, D.C.") and nombre_lugar("Departamento de Boyacá") == "boyaca"
```

- [ ] **Step 3: Correrlas.** `cd motor && uv run pytest tests/test_normalizar.py -v`. Esperado: FAIL (ImportError).
- [ ] **Step 4: Implementar** `config.py`, `normalizar.py` y el esqueleto de `cli.py`.
- [ ] **Step 5: Verificar.** `uv run pytest -v` debe dar PASS, y `uv run motor --help` debe listar los 7 subcomandos.
- [ ] **Step 6: Commit.** `git add motor/ && git commit -m "feat(motor): paquete, configuración y normalización"`

---

### Task 2: Inventario y corpus plano

**Files:**
- Create: `motor/src/motor/inventario.py` (trae la lógica de `scripts/inventario_pdfs.py`), `motor/src/motor/corpus.py`, `motor/tests/test_corpus.py`
- Delete: `scripts/inventario_pdfs.py` (queda reemplazado por `motor inventario`)

**Interfaces:**
- Consumes: `config.FUENTE`, `config.INVENTARIO`, `config.CORPUS`.
- Produces:
  - `inventario.generar(fuente: Path, salida: Path) -> tuple[Path, Path]`: escribe `pdfs.csv` y `paginas.csv` con las mismas columnas que hoy, incluida la categoría.
  - `corpus.construir(inventario_csv: Path, destino: Path) -> Path`: copia solo las categorías `udes`, `udes_sobrante`, `corpus_general` y `anadido` a `destino/<sha256[:12]>_<archivo>`. Escribe `destino/corpus.csv` con: `sha256, archivo_corpus, archivo_estandar, categoria, dane, tipo_doc, numero, anio, es_modificacion, paginas, digital, capa_ocr, texto_corrupto, escaneada, vacia, ruta_fuente`.
  - `corpus.paginas_con_texto(sha256: str) -> dict[int, str | None]`: lee `paginas.csv` y el PDF del corpus, y devuelve el texto crudo de cada página, o `None` si la página no es `digital` ni `capa_ocr`.
  - `corpus.fuente_texto(sha256: str, pagina: int) -> Literal["digital","capa_ocr","ninguna"]`.
  - `es_modificacion` es `True` si el nombre estándar termina en `_Modificacion.pdf`.

- [ ] **Step 1: Prueba que falle** (`test_corpus.py`). Arma en `tmp_path` una fuente falsa con 3 PDFs hechos con `pymupdf.open()` + `insert_text`: uno en `.../Acuerdos Municipales/municipios udes/`, uno en `.../duplicados/hash identicos/` y uno en `.../acuerdos añadidos/`. Comprueba:

```python
def test_corpus_excluye_duplicados(tmp_path):
    inv, _ = inventario.generar(fuente, tmp_path/"inv")
    csv_ = corpus.construir(inv, tmp_path/"corpus")
    filas = leer_csv(csv_)
    assert len(filas) == 2 and {f["categoria"] for f in filas} == {"udes", "anadido"}
    for f in filas:
        assert sha256((tmp_path/"corpus"/f["archivo_corpus"]).read_bytes()) == f["sha256"]
def test_fuente_intacta(tmp_path): ...  # hash de todos los archivos de la fuente antes == después
```

- [ ] **Step 2:** `uv run pytest tests/test_corpus.py -v`. Esperado: FAIL.
- [ ] **Step 3: Implementar** `inventario.py` (la clasificación de páginas y `calidad_texto` se copian tal cual del script actual) y `corpus.py`. Conectar los subcomandos `inventario` y `corpus` en `cli.py`.
- [ ] **Step 4: Prueba con datos reales** (`@pytest.mark.datos`): `motor inventario && motor corpus` deja exactamente 638 filas en `corpus.csv`, sin sha256 repetidos.
- [ ] **Step 5:** `uv run pytest -v` debe dar PASS.
- [ ] **Step 6: Commit.** `feat(motor): inventario y corpus plano de los 638 PDFs`

---

### Task 3: Estructura de la matriz (hojas → bloques → campos)

**Files:**
- Create: `motor/src/motor/matriz.py` (parte de estructura), `motor/tests/test_matriz_estructura.py`, `motor/tests/fixtures.py` (constructor de una matriz sintética con openpyxl)

**Interfaces:**
- Consumes: `normalizar.slug`.
- Produces:
  - `@dataclass Columna(col: int, letra: str, hoja: str, bloque: str, bloque_key: str, campo: str, campo_key: str, rol: Literal["art","pag","cita","presencia","campo"])`
  - `estructura(ws) -> tuple[int, list[Columna]]`: devuelve la fila de encabezado y las columnas de datos (desde la G).

**Reglas que la prueba fija:**
- **Fila de encabezado:** la primera fila entre 1 y 20 cuya celda B empieza (sin distinguir mayúsculas) por "código dane".
- **Bloques:** un bloque empieza en cada columna cuyo encabezado es `Art.` y termina antes del siguiente `Art.` o en una columna con encabezado vacío y sin celda combinada. El nombre del bloque es el valor de la fila `encabezado-1` en la columna `Art.`, resuelto a través de las celdas combinadas.
- **Campo:** es el encabezado de esa columna, resuelto por celdas combinadas. Si la celda cruda de la fila `encabezado-1` en esa columna tiene valor y no es la columna `Art.`, se agrega ` · <valor>`. Así se construye "Agricultura… · Mínimo".
- **Rol:** `Art.` → art; `Pág.`/`Pag.` → pag; `Definición` → cita; empieza por `Presencia` → presencia; cualquier otro → campo.
- **Claves:**
  - `bloque_key = slug(hoja) + "." + slug(bloque)`
  - `campo_key = bloque_key + "." + slug(campo)`
  - Si una clave se repite dentro del bloque ("¿Cuál?"), se le agrega `_2`, `_3`, en orden de columna.

- [ ] **Step 1: Pruebas que fallen.** La fixture sintética imita Tarifas: encabezado en la fila 11, `G10:J10` = "Tarifas Actividades Económicas", `K10` = "Mínimo", `L10` = "Máximo", `K11:L11` combinada = "Agricultura". Comprueba que K → campo "Agricultura · Mínimo" y L → "Agricultura · Máximo". Una segunda fixture tiene el encabezado en la fila 10 (caso Territorialidad). La prueba con datos reales:

```python
@pytest.mark.datos
def test_bloques_reales():
    wb = openpyxl.load_workbook(config.MATRIZ)
    arts = lambda h: [c.letra for c in estructura(wb[h])[1] if c.rol == "art"]
    assert arts("Elementos del tributo") == ["G","L","AL","AY","BD","BP","BZ","CK","CT","DQ","ED","EI","EN"]
    assert arts("Actividades No Sujetas") == ["G","AE"]
    assert arts("Tarifas") == ["G","AW"]
    assert len({c.campo_key for h in config.HOJAS_ALCANCE for c in estructura(wb[h])[1]}) == sum(len(estructura(wb[h])[1]) for h in config.HOJAS_ALCANCE)
```

- [ ] **Step 2:** `uv run pytest tests/test_matriz_estructura.py -v`. Esperado: FAIL.
- [ ] **Step 3: Implementar** `estructura`. Para las celdas combinadas usar `ws.merged_cells.ranges`.
- [ ] **Step 4:** pruebas en PASS.
- [ ] **Step 5: Commit.** `feat(motor): estructura de bloques y campos de la matriz`

---

### Task 4: Matriz en formato largo con correcciones de limpieza

**Files:**
- Modify: `motor/src/motor/matriz.py` (parte de filas)
- Create: `motor/tests/test_matriz_larga.py`

**Interfaces:**
- Consumes: `estructura`, `Columna`, `normalizar.valor_canonico`, `normalizar.es_vacio`.
- Produces:
  - `@dataclass Identidad(fila: int, consecutivo: int, dane_original: str, departamento: str, municipio: str, acuerdo: str, anio: str)`
  - `identidades(wb) -> list[Identidad]`: lee la hoja `Principios`. Descarta las filas cuyo DANE no es un entero mayor que 0; eso deja fuera totales, firmas y las filas con fórmula 0.
  - `@dataclass Celda(fila: int, hoja: str, bloque_key: str, campo_key: str, rol: str, valor_original: str | None, valor: str | None, correccion: str | None)`
  - `celdas(wb, hojas: Sequence[str]) -> list[Celda]`: solo filas presentes en `identidades`. Comprueba que el consecutivo de la columna A de cada hoja coincida con el de `Principios`; si no, `ValueError` con la hoja y la fila.
  - `correcciones_limpieza(wb, hojas) -> dict[tuple[str, int, int], str]`: compara cada hoja con su copia `_Limpieza`, encontrando la copia por prefijo de nombre (`Elementos del tributo_Limpiez`, `Actividades No Sujetas Limpieza`). Devuelve `(hoja, fila, col) → valor limpio` para las celdas distintas.
  - Al aplicar una corrección: `valor` sale del valor limpio, `valor_original` conserva el original y `correccion = "limpieza_equipo"`.
  - `escribir_larga(destino: Path) -> Path`: escribe `ORO/matriz_larga.csv` (las columnas de `Celda` más `dane_original`, `municipio`, `acuerdo` y `anio` de la identidad), omitiendo las celdas vacías. Se conecta al subcomando `matriz`.

- [ ] **Step 1: Pruebas que fallen.** Sintética: una matriz de 3 filas reales, una fila "Total Si" sin DANE y una fila con DANE 0; debe dar 3 identidades. Con datos reales:

```python
@pytest.mark.datos
def test_identidades_reales(): assert len(identidades(wb)) == 508
@pytest.mark.datos
def test_tierralta_limpieza():
    c = {(x.fila, x.campo_key): x for x in celdas(wb, config.HOJAS_ALCANCE)}
    u = next(v for (f, k), v in c.items() if f == 18 and k.endswith(".consorcios"))
    assert (u.valor_original, u.valor, u.correccion) == ("No", "si", "limpieza_equipo")
@pytest.mark.datos
def test_conteo_si_igual_al_excel():  # campo Persona Natural (col P) de Elementos
    n = sum(1 for x in celdas(wb, ["Elementos del tributo"]) if x.campo_key.endswith(".persona_natural") and x.valor == "si" and x.correccion is None)
    assert n == conteo_directo_openpyxl("Elementos del tributo", "P", {"si", "SI", "Si", "sí"})  # helper de la prueba, sin pasar por matriz.py
```

- [ ] **Step 2:** `uv run pytest tests/test_matriz_larga.py -v`. Esperado: FAIL.
- [ ] **Step 3: Implementar.** Cargar el libro una sola vez con `openpyxl.load_workbook(MATRIZ, data_only=True)`. La identidad se lee de `Principios`, porque las demás hojas solo tienen fórmulas.
- [ ] **Step 4:** pruebas en PASS, y `uv run motor matriz` escribe `datos/oro/matriz_larga.csv`.
- [ ] **Step 5: Commit.** `feat(motor): matriz en formato largo con correcciones registradas`

---

### Task 5: Identidad — DANE y emparejamiento con PDFs

**Files:**
- Create: `motor/src/motor/identidad.py`, `motor/tests/test_identidad.py`

**Interfaces:**
- Consumes: `matriz.identidades`, `Identidad`, `corpus.csv`, `normalizar.nombre_lugar`, `config.DIVIPOLA`, `config.POSIBLES_BORRADORES`.
- Produces:
  - `cargar_divipola(path) -> dict[str, tuple[str, str]]`: código de 5 dígitos → (departamento, municipio), ya pasados por `nombre_lugar`.
  - `resolver_dane(ident: Identidad, divipola) -> tuple[str | None, str]`: devuelve (código, motivo), con motivo en `ok`, `corregido_nombre`, `corregido_sufijo` o `sin_resolver`. Orden: (1) `zfill(5)` en DIVIPOLA, aceptado si el nombre de uno contiene al del otro tras `nombre_lugar`; (2) candidato único por nombre igual (con y sin espacios) y departamento contenido; (3) candidato único por los últimos 3 dígitos y departamento.
  - `acuerdos_citados(texto: str, anio_respaldo: str) -> list[tuple[int, int]]`: pares (número, año). Primero busca "N de [día de mes de] AAAA"; si no hay año en el texto, usa `anio_respaldo` con los números que siguen a "No.|N°|Nº|acuerdo|decreto".
  - `emparejar(ident, dane, corpus_filas, borradores: set[str]) -> dict`: claves `estado` (`coincide`, `otro_acuerdo`, `sin_pdf`, `sin_numero_legible`, `varios_acuerdos`), `sha256` (o vacío), `candidatos` (lista de `archivo_estandar`), `tipo_doc`, `es_modificacion` y `posible_borrador`.
    - `varios_acuerdos` cuando el texto contiene 2 o más ocurrencias de "acuerdo" o "decreto". En ese caso `sha256` queda vacío y `candidatos` lista los PDFs que coinciden.
    - El emparejamiento compara número y año como enteros, para que `006` sea igual a `6`.
  - `escribir_documentos(destino) -> Path`: escribe `ORO/documentos.csv` y `ORO/correcciones_dane.csv` (`fila, municipio, dane_original, dane_final, motivo`). Se conecta al subcomando `identidad`.

- [ ] **Step 1: Pruebas que fallen** (DIVIPOLA real, que está en git; corpus sintético):

```python
def test_dane_sin_prefijo(): assert resolver_dane(ident(dane="209", dep="Santander", mun="Confines"), div) == ("68209", "corregido_sufijo")
def test_dane_de_otro_municipio(): assert resolver_dane(ident(dane="70823", dep="Sucre", mun="Santiago de Tolu"), div)[0] == "70820"
def test_bogota(): assert resolver_dane(ident(dane="11001", dep="Distrito capital", mun="Bogotá D.C"), div) == ("11001", "ok")
def test_acuerdos_citados():
    assert acuerdos_citados("Acuerdo No 006", "2023") == [(6, 2023)]
    assert acuerdos_citados("022 de 29 Diciembre de 2018", "2018") == [(22, 2018)]
def test_varios(): assert emparejar(ident(acuerdo="Acuerdo N°022 de 2011\nAcuerdo N°014 de 2019"), ...)["estado"] == "varios_acuerdos"
def test_otro_acuerdo(): # Sabaneta: matriz "Acuerdo 199 de 2022", corpus solo 05631_Decreto_20220199_2022 → "otro_acuerdo"
```

- [ ] **Step 2:** `uv run pytest tests/test_identidad.py -v`. Esperado: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Prueba con datos reales** (`@pytest.mark.datos`): los conteos de `documentos.csv` quedan a ±2 de `coincide=430`, `otro_acuerdo=66`, `sin_pdf=5`, `sin_numero_legible=5`, y hay a lo sumo 2 `sin_resolver`. Además, Tierralta (fila 18) da `coincide` con `23807_Acuerdo_006_2023_Tierralta.pdf`. *Los 51 `varios_acuerdos` salen de las coincidencias previas, así que los conteos se comparan después de reclasificar; anotar en el informe las diferencias que pasen de ±2.*
- [ ] **Step 5:** pruebas en PASS.
- [ ] **Step 6: Commit.** `feat(motor): corrección de DANE y emparejamiento fila → PDF`

---

### Task 6: Catálogo borrador

**Files:**
- Create: `motor/src/motor/catalogo.py`, `motor/catalogo/variables.yaml` (generado), `docs/informes/catalogo-borrador.xlsx` (generado), `motor/tests/test_catalogo.py`

**Interfaces:**
- Consumes: `matriz.estructura`, `matriz.celdas`.
- Produces (Pydantic):

```python
class Campo(BaseModel):
    key: str; nombre: str; columna: str
    tipo: Literal["si_no", "numero", "texto_libre"]
    unidad: str | None = None                       # tarifas: "pendiente" (P1)
    valores_permitidos: list[str] | None = None     # si_no: ["si","no","no_aplica"]
    criterio: str = "pendiente"
    critica: bool | None = None                     # None = pendiente
    metodo: Literal["regla", "llm"] | None = None
    estado: Literal["borrador", "aprobada"] = "borrador"
class Bloque(BaseModel):
    key: str; nombre: str; hoja: str
    columnas: dict[Literal["art","pag","cita","presencia"], str]   # rol → letra
    palabras_clave: list[str] = []                  # vacío en el borrador
    campos: list[Campo]
class Catalogo(BaseModel):
    version: str; fuente: str; bloques: list[Bloque]
```

  - `generar(wb, hojas) -> Catalogo`. Tipo de cada campo según sus valores normalizados no vacíos: ≥80 % en {si, no, no_aplica} → `si_no`; ≥80 % numéricos → `numero`; si no, `texto_libre`. Las columnas con rol art/pag/cita/presencia van en `Bloque.columnas`, no como campos.
  - `guardar_yaml(cat, path)` y `cargar_yaml(path) -> Catalogo`, con `model_validate`.
  - `exportar_excel(cat, path)`: una fila por campo con las columnas `hoja, bloque, campo, key, tipo, unidad, criterio, critica`, más columnas vacías `revision_equipo` y `comentario`. Se conecta al subcomando `catalogo`.

- [ ] **Step 1: Pruebas que fallen.**

```python
@pytest.mark.datos
def test_catalogo_real():
    cat = generar(wb, config.HOJAS_ALCANCE)
    assert len([b for b in cat.bloques]) == 13 + 2 + 2
    assert all(c.criterio == "pendiente" for b in cat.bloques for c in b.campos)
    tar = [c for b in cat.bloques if b.hoja == "Tarifas" for c in b.campos if c.tipo == "numero"]
    assert len(tar) >= 38 and all(c.unidad == "pendiente" for c in tar)
def test_ida_y_vuelta(tmp_path): guardar_yaml(cat_sintetico, p := tmp_path/"v.yaml"); assert cargar_yaml(p) == cat_sintetico
```

- [ ] **Step 2:** `uv run pytest tests/test_catalogo.py -v`. Esperado: FAIL.
- [ ] **Step 3: Implementar.** En los campos numéricos de la hoja Tarifas, `unidad="pendiente"`.
- [ ] **Step 4:** pruebas en PASS. `uv run motor catalogo` genera el YAML y el Excel, y el YAML vuelve a validar con `cargar_yaml`.
- [ ] **Step 5: Commit** (con el YAML y el Excel generados). `feat(motor): catálogo borrador de variables`

---

### Task 7: Verificador de citas

**Files:**
- Create: `motor/src/motor/verificacion.py`, `motor/tests/test_verificacion.py`

**Interfaces:**
- Consumes: `normalizar.texto_busqueda`, `config.UMBRAL_CITA`, `config.MIN_CHARS_CITA`.
- Produces:

```python
@dataclass
class ResultadoCita:
    estado: Literal["pasa","pagina_ambigua","pagina_desplazada","no_encontrada","sin_texto","no_verificable","pagina_invalida"]
    pagina_anotada: int | None; pagina_encontrada: int | None; score: float
    check: dict   # {"tipo": "cita_en_pagina", "resultado": "pasa|alerta|falla|no_aplica", "detalle": str}
def verificar_cita(cita: str | None, pag: str | None, paginas: dict[int, str | None]) -> ResultadoCita
def verificar_valor_en_pagina(valor: str, pagina_texto: str | None) -> dict   # check "valor_de_cita": pasa | alerta | no_aplica
```

**Algoritmo** (el que fijan las pruebas):
1. Si la cita normalizada mide menos de `MIN_CHARS_CITA` → `no_verificable` / `no_aplica`.
2. `pag` con varios enteros ("2-238", "16 y 91", "3-196-284"): se separan los números. Si la cita supera el umbral en alguna de esas páginas → `pagina_ambigua` / `alerta`, detalle "La cita aparece en el folio N, uno de los anotados («X»)". Si no, se sigue en el paso 4. Si `pag` está vacío, no es numérico o ningún número cae en `1..len(paginas)` → `pagina_invalida` / `falla`, detalle "El folio anotado («X») no existe en el documento"; aun así se busca en todo el documento (paso 4) y, si aparece, queda `pagina_desplazada`.
3. Página anotada con texto y `fuzz.partial_ratio_alignment(cita_n, pagina_n).score ≥ UMBRAL_CITA` → `pasa`.
4. Si no, se toma la mejor página entre las que tienen texto. Con score ≥ umbral → `pagina_desplazada` / `alerta`, detalle "La cita aparece en el folio N, no en el folio M anotado".
5. Si no, y la página anotada es `None` → `sin_texto` / `no_aplica`, detalle "El folio M es escaneado; se verifica después del OCR".
6. Si no → `no_encontrada` / `falla`, detalle "La cita no aparece en el documento".

Para no comparar citas de varios miles de caracteres, se usan los primeros 400 caracteres de la cita normalizada.

`verificar_valor_en_pagina`: el número se busca como token en la página normalizada, aceptando `4.5` = `4,5` = `4 5`. Si aparece → `pasa`; si no → `alerta` "La tarifa X no aparece en el folio citado"; si la página es `None` → `no_aplica`.

- [ ] **Step 1: Pruebas que fallen** (páginas sintéticas como `dict[int, str | None]`):

```python
P = {1: "portada", 2: "ARTÍCULO 39. Son sujetos pasivos del impuesto de industria y comercio las personas naturales", 3: None}
CITA2 = "Son sujetos pasivos del impuesto de industria y comercio las personas naturales"
INVENTADA_LARGA = "El municipio exonera de por vida a todas las plataformas digitales del pago"
def test_exacta(): assert verificar_cita("Son sujetos pasivos del impuesto de industria y comercio las personas naturales", "2", P).estado == "pasa"
def test_desplazada(): r = verificar_cita("Son sujetos pasivos del impuesto de industria y comercio las personas naturales", "1", P); assert (r.estado, r.pagina_encontrada) == ("pagina_desplazada", 2)
def test_escaneada(): assert verificar_cita("Texto que estaría en la página escaneada número tres del acuerdo", "3", P).estado == "sin_texto"
def test_inventada(): assert verificar_cita("El municipio exonera de por vida a todas las plataformas digitales del pago", "2", P).check["resultado"] == "falla"
def test_corta(): assert verificar_cita("No se evidencia", "2", P).estado == "no_verificable"
def test_pagina_invalida(): assert {verificar_cita(INVENTADA_LARGA, x, P).estado for x in ["0", "", "99"]} == {"pagina_invalida"}
def test_pagina_ambigua(): assert verificar_cita(CITA2, "1-2", P).estado == "pagina_ambigua"
def test_salto_guion(): assert verificar_cita("Son sujetos pa-\nsivos del impuesto de industria y comercio las personas naturales", "2", P).estado == "pasa"
def test_valor(): assert verificar_valor_en_pagina("4.5", "tarifa del 4,5 por mil")["resultado"] == "pasa"
```

- [ ] **Step 2:** `uv run pytest tests/test_verificacion.py -v`. Esperado: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** pruebas en PASS.
- [ ] **Step 5: Calibración con datos reales** (`@pytest.mark.datos`, prueba `test_tasa_elementos_digitales`). En las filas `coincide` de PDFs digitales de la hoja Elementos, la proporción de `pasa` entre las citas verificables debe estar entre 0,80 y 0,95; la medición previa fue 87 %. Si queda fuera, ajustar `UMBRAL_CITA` y escribir el motivo en el informe (Task 8). No bajar de 85 sin revisión humana.
- [ ] **Step 6: Commit.** `feat(motor): verificador de citas cita_en_pagina y valor_de_cita`

---

### Task 8: Set de oro, informe y reproducibilidad

**Files:**
- Create: `motor/src/motor/oro.py`, `motor/src/motor/informe.py`, `motor/tests/test_oro.py`
- Create (generado): `docs/informes/set-de-oro-resumen.md`

**Interfaces:**
- Consumes: `matriz.celdas`, `identidad` (`documentos.csv`), `corpus.paginas_con_texto`, `corpus.fuente_texto`, `verificacion.verificar_cita`, `verificacion.verificar_valor_en_pagina`.
- Produces:
  - `oro.construir(destino: Path) -> Path`: escribe `ORO/set_de_oro.csv`, una fila por celda de rol `campo` o `presencia` de las filas emparejadas. Columnas: `fila, dane, municipio, sha256, archivo, hoja, bloque_key, campo_key, valor_original, valor, correccion, art, pag, cita, check_cita, detalle_cita, pagina_encontrada, desfase, check_valor, fuente_texto, posible_borrador, verificacion, veredicto`.
    - La cita se verifica **una vez por bloque y fila**, y su resultado se copia a todos los campos del bloque.
    - `verificacion`: `verificado` si la cita quedó en `pasa`, `pagina_ambigua` o `pagina_desplazada`; `sin_texto`; o `no_verificable`.
    - `veredicto`: `confiable` (pasa, fuente digital, no es borrador); `revisar` (`pagina_ambigua`, `pagina_desplazada`, `pagina_invalida` encontrada en otra página, fuente `capa_ocr` o `posible_borrador`); `dudosa` (`no_encontrada`, o `pagina_invalida` sin encontrarse); `sin_texto`.
    - Las filas que no son `coincide` (incluidas las `varios_acuerdos`) van con `veredicto = "sin_documento"` y la verificación vacía.
  - `informe.escribir(set_csv: Path, destino_md: Path) -> Path`. El informe trae:
    - conteos por `veredicto` y por `verificacion`;
    - tasa de `pasa` por hoja y por bloque;
    - los 10 desfases más comunes y los documentos con desfase constante (≥3 citas con el mismo desfase);
    - 5 ejemplos de `dudosa` con su detalle;
    - el umbral usado.
  - Subcomandos `verificar` (`oro` + `informe`) y `todo` (`inventario → corpus → matriz → identidad → catalogo → verificar`).

- [ ] **Step 1: Pruebas que fallen.** Sintética de extremo a extremo con 1 PDF y una matriz de 1 fila: `veredicto` debe ser `confiable` para el bloque cuya cita está en la página anotada, y `dudosa` para uno con una cita inventada. Con datos reales:

```python
@pytest.mark.datos
def test_reproducible(tmp_path):
    a = construir(tmp_path/"a"); b = construir(tmp_path/"b")
    assert a.read_bytes() == b.read_bytes()
@pytest.mark.datos
def test_sin_texto_coherente():  # ninguna fila de PDF escaneado puede quedar "confiable"
    assert not any(f["veredicto"] == "confiable" and f["fuente_texto"] != "digital" for f in leer(set_csv))
```

- [ ] **Step 2:** `uv run pytest tests/test_oro.py -v`. Esperado: FAIL.
- [ ] **Step 3: Implementar** `oro.py` e `informe.py`. Ordenar las filas de salida por (fila, hoja, campo_key) para que el resultado sea determinista.
- [ ] **Step 4: Verificación final.** `uv run motor todo` debe terminar sin errores. Luego `uv run pytest -v` con todo en PASS, incluidas las pruebas `datos`. Revisar a mano que `docs/informes/set-de-oro-resumen.md` muestre tasas por hoja coherentes con `docs/matriz-ica-diagnostico.md` (Elementos ≈87 % exacto en digitales).
- [ ] **Step 5: Commit.** `feat(motor): set de oro verificado e informe`
