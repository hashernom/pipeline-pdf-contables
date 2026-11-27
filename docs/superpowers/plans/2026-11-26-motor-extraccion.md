# Motor de extracción (hito 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extraer los campos del catálogo, con artículo, página y cita verificada, de los acuerdos en PDF digitales, y medir el resultado contra el set de oro.

**Architecture:** Se agregan módulos nuevos al paquete `motor/` existente:
- `muestras` arma la partición ajuste/prueba y las referencias del set de oro;
- `localizar` elige las páginas de contexto;
- `llm` es el cliente DeepSeek con caché en disco;
- `extractor` arma el pedido de cada bloque, verifica la respuesta con `verificacion.py` y le pone semáforo;
- `evaluacion` e `informe_extraccion` miden y escriben el informe.

Cada paso deja un CSV en `datos/extraccion/`.

**Tech Stack:** Python 3.12, uv, el SDK `openai` apuntando a DeepSeek (`deepseek-flash`), Pydantic 2, RapidFuzz, PyMuPDF y pytest.

**Spec:** `docs/superpowers/specs/2026-11-26-motor-extraccion-design.md` (en especial §6.8). Contexto del código: `docs/arquitectura/motor.md`.

## Global Constraints

- Modelo `deepseek-flash`, `base_url="https://api.deepseek.com"`, `temperature=0`, `response_format={"type": "json_object"}`, `extra_body={"thinking": {"type": "disabled"}}`. El pedido mismo dice "JSON".
- La clave sale de `os.environ["DEEPSEEK_API_KEY"]`. Nunca se escribe en archivos, registros ni excepciones.
- Rutas y constantes solo en `motor/src/motor/config.py`.
- CSV en UTF-8 con BOM (`utf-8-sig`), `newline=""`, filas ordenadas, salida determinista.
- Las pruebas que no son `datos` **nunca** llaman a la red: el cliente del modelo se inyecta.
- Ningún ejemplo, cita de referencia ni palabra clave sale de un documento del grupo `prueba`.
- Ningún bloque `ENCONTRADO` llega a la salida con una cita que el verificador no encontró en el documento.
- Textos para personas (detalles de checks, informe) en español de Colombia.
- Las pruebas de red reales llevan el marcador `datos` y requieren `DEEPSEEK_API_KEY`.

## Review Focus

1. **Respuesta del modelo que no es JSON, viene vacía (solo espacios) o se corta (`finish_reason="length"`):** el bloque queda `NO_ENCONTRADO` con el detalle, sin excepción. Lo prueba la Task 5.
2. **El modelo inventa una página fuera del documento (0, negativa o mayor que el total) o un `campo_key` que no existe:** página inválida, que se verifica igual que en el hito 0; las claves desconocidas se descartan. Lo prueba la Task 5.
3. **Correr dos veces da lo mismo y no paga dos veces:** la caché cubre todo pedido idéntico, incluido el reintento. Lo prueba la Task 2.
4. **Documento sin páginas digitales:** todos sus bloques quedan `NO_ENCONTRADO` sin llamar al modelo. Lo prueba la Task 5.
5. **Correr `motor catalogo` después de enriquecer no borra criterios ni palabras clave editados.** Lo prueba la Task 4.

---

### Task 1: Configuración, partición y referencias del set de oro

**Files:**
- Modify: `motor/src/motor/config.py`
- Create: `motor/src/motor/muestras.py`
- Test: `motor/tests/test_muestras.py`

**Interfaces:**
- Produces, en `config`:
  - `EXTRACCION = RAIZ / "datos/extraccion"`
  - `DEEPSEEK_MODELO = "deepseek-flash"`, `DEEPSEEK_BASE_URL = "https://api.deepseek.com"`
  - `PRECIO_USD_MTOK = {"entrada": 0.30, "cache": 0.014, "salida": 1.20}` (tarifa de hora pico, la más cara: así la estimación queda del lado seguro)
  - `TOPE_USD_CORRIDA = 10.0`, `N_AJUSTE = 30`, `SEMILLA = 20261126`
  - `MAX_PAGINAS_CONTEXTO = 6`, `N_EJEMPLOS = 3`, `CONCURRENCIA = 8`
- Produces, en `muestras`:
  - `Clave = tuple[str, str, str]`, que es `(sha256, hoja, campo_key)`.
  - `@dataclass(frozen=True) Referencia`: `sha256, hoja, bloque_key, campo_key, valor, veredicto, pag, pagina_encontrada: int | None, cita, check_cita`.
  - `particion(set_csv: Path, n_ajuste: int = config.N_AJUSTE, semilla: int = config.SEMILLA) -> dict[str, str]`. Devuelve sha256 → `"ajuste"` o `"prueba"`. La población son los sha256 con al menos un campo `confiable`, ordenados; se elige con `random.Random(semilla).sample`.
  - `escribir_particion(part: dict[str, str], destino: Path) -> Path`. Escribe `particion.csv` con las columnas `sha256, grupo`.
  - `leer_particion(path: Path) -> dict[str, str]`
  - `referencias(set_csv: Path) -> tuple[dict[Clave, Referencia], int]`. Toma solo los veredictos `confiable` y `revisar`. Los duplicados de una clave se fusionan si todos tienen el mismo `valor`; si no, se excluyen. El `int` es la cantidad de claves excluidas.
  - `@dataclass(frozen=True) Ejemplo`: `sha256, cita: str, valores: dict[str, str]`.
  - `ejemplos(refs, part, bloque_key: str, excluir: str | None = None, n: int = config.N_EJEMPLOS) -> list[Ejemplo]`. Toma solo documentos `ajuste`, veredicto `confiable`, sin el sha256 `excluir`. Un `Ejemplo` por documento y bloque. Elige los n primeros por sha256, para ser determinista.
  - `citas_referencia(refs, part, bloque_key, excluir: str | None = None) -> list[str]`. Las citas únicas de ese bloque en documentos `ajuste`.

- [ ] **Step 1: Write the failing tests** in `tests/test_muestras.py`. Usa un `set_de_oro.csv` sintético que se escribe en `tmp_path`, con el encabezado real (columnas de `oro.COLUMNAS`):

```python
def test_particion_determinista_y_fija(tmp_path): # 40 docs confiable
    a = particion(set_csv, n_ajuste=10, semilla=1); b = particion(set_csv, n_ajuste=10, semilla=1)
    assert a == b and sum(g == "ajuste" for g in a.values()) == 10 and len(a) == 40
def test_particion_ignora_docs_sin_confiable(tmp_path):
    assert "sha_solo_dudosa" not in particion(set_csv, n_ajuste=1)
def test_referencias_fusiona_iguales_y_excluye_conflictos(tmp_path):
    refs, excl = referencias(set_csv)   # clave X en 2 filas con "si"/"si", clave Y con "si"/"no"
    assert ("shaA", "Tarifas", "X") in refs and ("shaA", "Tarifas", "Y") not in refs and excl == 1
def test_ejemplos_solo_de_ajuste_y_excluye_doc(tmp_path):
    ej = ejemplos(refs, {"shaA": "ajuste", "shaB": "prueba"}, "b1", excluir=None)
    assert {e.sha256 for e in ej} == {"shaA"}
    assert ejemplos(refs, {"shaA": "ajuste"}, "b1", excluir="shaA") == []
```

- [ ] **Step 2:** `cd motor && uv run pytest tests/test_muestras.py -v`. Esperado: FAIL (`ModuleNotFoundError: motor.muestras`).
- [ ] **Step 3:** Agregar las constantes a `config.py` e implementar `muestras.py` con las firmas de arriba. `pagina_encontrada` se convierte con `int(...)` si no está vacía.
- [ ] **Step 4:** `uv run pytest tests/test_muestras.py -v` y luego `uv run pytest -m "not datos" -q`. Esperado: PASS en todo.
- [ ] **Step 5: Commit** `feat(motor): partición ajuste/prueba y referencias del set de oro`

### Task 2: Cliente DeepSeek con caché en disco

**Files:**
- Modify: `motor/pyproject.toml` (`uv add openai`)
- Create: `motor/src/motor/llm.py`
- Test: `motor/tests/test_llm.py`

**Interfaces:**
- Produces:
  - `@dataclass Uso`: `entrada: int, cache: int, salida: int, segundos: float`. Tiene `costo_usd(self) -> float` con `config.PRECIO_USD_MTOK`; `entrada` cuenta solo los tokens que fallan la caché.
  - `@dataclass Respuesta`: `texto: str, finish_reason: str, uso: Uso, desde_cache: bool`.
  - `Transporte = Callable[[dict], dict]`. Recibe los kwargs del pedido y devuelve `{"texto", "finish_reason", "uso": {"entrada", "cache", "salida"}}`.
  - `class Cliente`, con `__init__(self, cache_dir: Path, transporte: Transporte | None = None)`. Si no se pasa transporte, se crea uno real con `openai.OpenAI(api_key=os.environ["DEEPSEEK_API_KEY"], base_url=config.DEEPSEEK_BASE_URL, timeout=120.0, max_retries=4)`. Los tokens se leen de `usage.prompt_cache_miss_tokens`, `usage.prompt_cache_hit_tokens` y `usage.completion_tokens`.
  - `Cliente.completar(self, mensajes: list[dict], max_tokens: int = 4000) -> Respuesta`. La clave de caché es el sha256 del JSON canónico (`sort_keys=True`) de `{modelo, mensajes, max_tokens, temperature, response_format, thinking}`. El archivo es `cache_dir/<clave[:2]>/<clave>.json`. Si existe, se devuelve con `desde_cache=True` y sin llamar al transporte. Las respuestas con `finish_reason` distinto de `"stop"` **no** se guardan.
  - `estimar_tokens(texto: str) -> int`, calculado como `ceil(len(texto) / 3)`: es conservador para español.

- [ ] **Step 1: Write the failing tests:**

```python
def test_segunda_llamada_sale_de_cache(tmp_path):
    llamadas = []
    t = lambda req: llamadas.append(req) or {"texto": '{"a":1}', "finish_reason": "stop", "uso": {"entrada": 10, "cache": 0, "salida": 5}}
    c = Cliente(tmp_path, transporte=t)
    r1 = c.completar([{"role": "user", "content": "x JSON"}]); r2 = c.completar([{"role": "user", "content": "x JSON"}])
    assert len(llamadas) == 1 and not r1.desde_cache and r2.desde_cache and r2.texto == '{"a":1}'
def test_respuesta_cortada_no_se_guarda(tmp_path): # finish_reason "length" -> 2 llamadas
def test_pedido_lleva_parametros_fijos(tmp_path):
    req = llamadas[0]
    assert req["model"] == "deepseek-flash" and req["temperature"] == 0
    assert req["response_format"] == {"type": "json_object"} and req["extra_body"] == {"thinking": {"type": "disabled"}}
def test_costo():
    assert Uso(1_000_000, 0, 0, 0).costo_usd() == pytest.approx(0.30)
```

- [ ] **Step 2:** `uv run pytest tests/test_llm.py -v`. Esperado: FAIL.
- [ ] **Step 3:** Implementar `llm.py` y correr `uv add openai`. La escritura en caché es atómica: se escribe a `.tmp` y luego `os.replace`.
- [ ] **Step 4:** `uv run pytest tests/test_llm.py -v`. Esperado: PASS.
- [ ] **Step 5: Prueba real** marcada `datos`: `test_deepseek_responde` hace un pedido mínimo que devuelve JSON y comprueba que el uso tenga `salida > 0`. Se salta si no existe `DEEPSEEK_API_KEY`. Correr `uv run pytest tests/test_llm.py -m datos -v`. Esperado: PASS.
- [ ] **Step 6: Commit** `feat(motor): cliente DeepSeek con caché en disco`

### Task 3: Localización de páginas

**Files:**
- Create: `motor/src/motor/localizar.py`
- Test: `motor/tests/test_localizar.py`

**Interfaces:**
- Consumes: `normalizar.texto_busqueda`, `rapidfuzz.fuzz.partial_ratio`.
- Produces:
  - `palabras_clave(nombre_bloque: str, citas_bloque: list[str], citas_otros: list[str], n: int = 12) -> list[str]`. Junta los tokens de 4 letras o más del nombre del bloque y los tokens de 5 letras o más más distintivos de `citas_bloque`. "Distintivo" se mide como frecuencia relativa en el bloque dividida por (frecuencia relativa en los otros + 1e-3). Se descartan los tokens que aparecen en menos de 2 citas. Desempate alfabético.
  - `puntaje_pagina(texto_norm: str, citas_ref_norm: list[str], claves: list[str]) -> float`. Es `max(partial_ratio contra cada cita de referencia recortada a 300 caracteres) + 5 * (palabras clave presentes)`. Si no hay citas de referencia, solo cuentan las palabras clave.
  - `paginas_localizadas(paginas: dict[int, str | None], citas_ref: list[str], claves: list[str], k: int = 3, tope: int = config.MAX_PAGINAS_CONTEXTO) -> list[int]`. Toma las k páginas de mayor puntaje entre las que tienen texto, les suma sus vecinas ±1 con texto, ordena y recorta a `tope`, priorizando las k originales. Si ninguna página tiene texto, devuelve `[]`.
  - `paginas_completas(paginas) -> list[int]`: todas las páginas con texto, ordenadas.
  - `ESTRATEGIAS = {"localizada": ..., "completa": ...}`. Son funciones con la firma `(paginas, citas_ref, claves) -> list[int]`.

- [ ] **Step 1: Write the failing tests:**

```python
def test_encuentra_la_pagina_con_el_articulo():
    paginas = {1: "portada del acuerdo", 2: "indice", 3: "ARTICULO 12 SUJETO PASIVO son sujetos pasivos del impuesto las personas naturales", 4: "tarifas", 5: None}
    assert 3 in paginas_localizadas(paginas, ["son sujetos pasivos del impuesto de industria y comercio las personas naturales"], ["sujeto", "pasivo"], k=1)
def test_agrega_vecinas_y_respeta_tope():
    assert paginas_localizadas(p10, refs, [], k=3, tope=6) == sorted(...)  # len <= 6, incluye p±1 de cada top
def test_sin_texto_devuelve_vacio():
    assert paginas_localizadas({1: None, 2: None}, ["x"], ["y"]) == []
def test_palabras_clave_distintivas():
    pc = palabras_clave("Sujeto pasivo", ["son sujetos pasivos ...", "sujetos pasivos del impuesto ..."], ["la tarifa del impuesto ..."])
    assert "pasivos" in pc and "impuesto" not in pc
```

- [ ] **Step 2:** `uv run pytest tests/test_localizar.py -v`. Esperado: FAIL.
- [ ] **Step 3:** Implementar `localizar.py` con las firmas de arriba. El texto de cada página se normaliza una sola vez por documento.
- [ ] **Step 4:** `uv run pytest tests/test_localizar.py -v`. Esperado: PASS.
- [ ] **Step 5: Commit** `feat(motor): localización de páginas por bloque`

### Task 4: Catálogo enriquecido (presencia, palabras clave y criterios)

**Files:**
- Modify: `motor/src/motor/catalogo.py`, `motor/src/motor/cli.py`
- Modify (generado): `motor/catalogo/variables.yaml`
- Test: `motor/tests/test_catalogo.py`

**Interfaces:**
- Consumes: `muestras.referencias/particion/citas_referencia/ejemplos` (Task 1), `localizar.palabras_clave` (Task 3) y `llm.Cliente` (Task 2).
- Produces:
  - `Bloque.presencia_key: str | None = None`. Es el `campo_key` de la columna de rol `presencia`, por ejemplo `elementos_del_tributo.sujeto_activo.presencia_ausencia`, y se llena en `generar`.
  - `Campo.unidad`: en los campos `numero` de Tarifas queda `"por_mil"`.
  - `fusionar(nuevo: Catalogo, previo: Catalogo) -> Catalogo`. Conserva del previo, por `key`, los valores `criterio`, `palabras_clave`, `unidad`, `critica` y `metodo` de bloques y campos cuando el previo es distinto del valor por defecto. Las claves nuevas entran tal cual y las que ya no existen se descartan.
  - `enriquecer(cat: Catalogo, refs, part, cliente: llm.Cliente) -> Catalogo`:
    - Las `palabras_clave` de cada bloque salen de `localizar.palabras_clave`, usando como "otros" las citas de los demás bloques.
    - Por cada campo con `criterio == "pendiente"`, una llamada a DeepSeek con el nombre del bloque, el nombre del campo, los valores permitidos y hasta 5 ejemplos (cita y valor). El campo de presencia se trata como un campo `si_no` más. La llamada devuelve `{"criterio": "<1-2 frases>"}`.
    - No toca lo que ya no está `pendiente`.
  - CLI: `motor catalogo` ahora fusiona con el YAML existente si lo hay. `motor catalogo --enriquecer` además corre `enriquecer` y guarda.
  - El criterio de la presencia de cada bloque se guarda en un campo nuevo `Bloque.criterio_presencia: str = "pendiente"`.

- [ ] **Step 1: Write the failing tests:**

```python
def test_fusionar_conserva_lo_editado():
    previo = cat_con(criterio="si nombra a las personas naturales", palabras=["pasivo"])
    f = fusionar(generar_sintetico(), previo)
    assert campo(f, "...persona_natural").criterio == "si nombra a las personas naturales" and bloque(f).palabras_clave == ["pasivo"]
def test_presencia_key_se_llena(wb_sintetico):
    assert bloque(generar(wb_sintetico, ["Tarifas"])).presencia_key.endswith("presencia_tarifa")
def test_enriquecer_no_llama_si_no_hay_pendientes(tmp_path):  # transporte que falla si se llama
def test_enriquecer_escribe_criterio(tmp_path):  # transporte devuelve {"criterio": "Vale si ..."}
    assert campo(cat2, k).criterio == "Vale si ..." and cat2.bloques[0].criterio_presencia == "Vale si ..."
```

- [ ] **Step 2:** `uv run pytest tests/test_catalogo.py -v`. Esperado: FAIL.
- [ ] **Step 3:** Implementar los cambios en `catalogo.py` y `cli.py` (subcomando `catalogo` con la opción `--enriquecer`). El cliente real usa `config.EXTRACCION / "cache"`.
- [ ] **Step 4:** `uv run pytest -m "not datos" -q`. Esperado: PASS. Luego `uv run motor catalogo` y comprobar que `git diff motor/catalogo/variables.yaml` solo agregue `presencia_key`, `criterio_presencia` y `unidad: por_mil`.
- [ ] **Step 5: Commit** `feat(motor): catálogo con presencia, fusión y enriquecimiento`

### Task 5: Extractor de un bloque

**Files:**
- Create: `motor/src/motor/extractor.py`
- Test: `motor/tests/test_extractor.py`

**Interfaces:**
- Consumes: `catalogo.Bloque` (Task 4), `llm.Cliente` y `Respuesta` (Task 2), `muestras.Ejemplo` (Task 1), `localizar.ESTRATEGIAS` (Task 3), y `verificacion.verificar_cita` y `verificar_valor_en_pagina`.
- Produces:
  - `class RespuestaModelo(BaseModel)`: `estado: Literal["ENCONTRADO", "NO_ENCONTRADO"]`, `articulo: str | None = None`, `pagina: int | None = None`, `cita: str | None = None`, `campos: dict[str, str | None] = {}`, `unidades: dict[str, str] = {}`.
  - `@dataclass ResultadoCampo`: `campo_key, rol, valor: str | None, unidad: str | None, check_valor: str`.
  - `@dataclass Extraccion`: `sha256, hoja, bloque_key, estado, articulo, pagina, cita, check_cita, detalle_cita, pagina_encontrada, semaforo, estrategia, intentos: int, paginas_contexto: list[int], campos: list[ResultadoCampo], uso: llm.Uso`.
  - `armar_mensajes(bloque, paginas_ctx: dict[int, str], ejemplos: list[Ejemplo], estrategia: str) -> list[dict]`:
    - Sistema: reglas y formato JSON, con la palabra "JSON".
    - Usuario, con `localizada`: bloque, campos con tipo, valores permitidos y criterio, más el criterio de presencia, los ejemplos y las páginas marcadas `=== PÁGINA n ===`.
    - Con `completa`: las páginas van **primero**, en un mensaje de usuario propio, y la pregunta del bloque en un segundo mensaje, para aprovechar la caché del prefijo.
  - `a_por_mil(valor: str, unidad: str | None) -> str | None`:
    - `porcentaje` → ×10;
    - `por_mil` o `None` → igual;
    - `pesos` → `None`.
    - Devuelve el número canónico con `valor_canonico`.
  - `extraer_bloque(bloque, paginas: dict[int, str | None], cliente, ejemplos, citas_ref: list[str], estrategia: str = "localizada", sha256: str = "") -> Extraccion`. Flujo:
    1. Si no hay ninguna página con texto: `NO_ENCONTRADO` sin llamar al modelo.
    2. Elegir el contexto con `ESTRATEGIAS[estrategia](paginas, citas_ref, bloque.palabras_clave)`.
    3. Llamar al modelo e interpretar con `RespuestaModelo.model_validate_json`. Si el JSON es inválido, vacío o cortado: `NO_ENCONTRADO`, con `detalle_cita` igual a `"El modelo no devolvió una respuesta válida"`.
    4. Verificar con `verificar_cita(cita, str(pagina), paginas)`. Si queda `no_encontrada`, o `pagina_invalida` sin hallazgo, se hace **un** reintento. Se agrega la respuesta anterior como mensaje `assistant` y un mensaje `user`: `"La cita no aparece literal en la página {p}. Cópiala exactamente del texto o responde NO_ENCONTRADO."`. Si vuelve a fallar: `NO_ENCONTRADO`, con el detalle del verificador y los campos en `None`.
    5. Campos: solo las claves del bloque más `presencia_key`. Las desconocidas se descartan. Un valor fuera de `valores_permitidos` se convierte en `None`, con `check_valor="falla"`.
    6. Números de Tarifas: `verificar_valor_en_pagina(valor_original, texto de la página citada + "\n" + página siguiente)` antes de normalizar, y luego se guarda `a_por_mil`.
    7. Semáforo:
       - verde: la cita `pasa`, `entre_paginas` es falso y ningún `check_valor` es `alerta` o `falla`;
       - amarillo: la cita está en otra página o repartida entre páginas, o algún `check_valor` es `alerta`;
       - rojo: `NO_ENCONTRADO`.
    8. `uso`: suma de los intentos.

- [ ] **Step 1: Write the failing tests.** Todos usan un transporte falso que devuelve el texto indicado:

```python
P = {1: "portada", 2: "ARTICULO 5. Son sujetos pasivos del impuesto de industria y comercio las personas naturales y juridicas", 3: None}
def test_cita_real_queda_verde(tmp_path):
    e = extraer_bloque(bloque_sp, P, cli(tmp_path, ok_json(pagina=2, cita="Son sujetos pasivos del impuesto de industria y comercio las personas naturales")), [], [])
    assert e.estado == "ENCONTRADO" and e.semaforo == "verde" and e.intentos == 1
def test_cita_inventada_reintenta_y_queda_no_encontrado(tmp_path):
    e = extraer_bloque(bloque_sp, P, cli(tmp_path, ok_json(pagina=2, cita="El municipio exonera a todas las plataformas digitales del pago"), repetir=True), [], [])
    assert e.estado == "NO_ENCONTRADO" and e.semaforo == "rojo" and e.intentos == 2 and all(c.valor is None for c in e.campos)
def test_json_invalido_no_revienta(tmp_path):        # texto "   " y texto "no es json"
def test_respuesta_cortada_no_revienta(tmp_path):    # finish_reason "length"
def test_pagina_fuera_de_rango(tmp_path):            # pagina=99 -> check pagina_invalida; si la cita está en p2 -> amarillo
def test_clave_desconocida_se_descarta(tmp_path):
def test_valor_fuera_de_permitidos(tmp_path):        # "quizas" en si_no -> None, check_valor "falla"
def test_documento_sin_texto_no_llama(tmp_path):     # transporte que falla si se llama
def test_tarifa_porcentaje_a_por_mil():
    assert a_por_mil("0.5", "porcentaje") == "5" and a_por_mil("4,5", "por_mil") == "4.5" and a_por_mil("100000", "pesos") is None
def test_completa_pone_paginas_primero():
    m = armar_mensajes(bloque_sp, {2: "x"}, [], "completa"); assert "=== PÁGINA 2 ===" in m[1]["content"] and bloque_sp.nombre in m[2]["content"]
```

- [ ] **Step 2:** `uv run pytest tests/test_extractor.py -v`. Esperado: FAIL.
- [ ] **Step 3:** Implementar `extractor.py` con las firmas de arriba.
- [ ] **Step 4:** `uv run pytest tests/test_extractor.py -v` y luego `uv run pytest -m "not datos" -q`. Esperado: PASS.
- [ ] **Step 5: Commit** `feat(motor): extractor de bloques con verificación y semáforo`

### Task 6: Comando `extraer` (corrida por documento, costo y CSV)

**Files:**
- Create: `motor/src/motor/corrida.py`
- Modify: `motor/src/motor/cli.py`
- Test: `motor/tests/test_corrida.py`

**Interfaces:**
- Consumes: Tasks 1 a 5, más `corpus.paginas_con_texto` y `corpus.csv`.
- Produces:
  - `COLUMNAS_EXTRACCION`: las columnas de §6.6 del spec más `rol`, en este orden: `sha256, archivo, grupo, hoja, bloque_key, campo_key, rol, estado, articulo, pagina, cita, valor, unidad, check_cita, detalle_cita, pagina_encontrada, check_valor, semaforo, estrategia, intentos, paginas_contexto, tokens_entrada, tokens_cache, tokens_salida`. `paginas_contexto` va como `"3;4;5"`. Los tokens se escriben en la fila de presencia, o en la primera fila del bloque, para no contarlos dos veces.
  - `documentos_objetivo(grupo: str, part: dict[str, str]) -> list[str]`:
    - `ajuste` o `prueba`: los sha256 de ese grupo;
    - `todos`: además, todos los sha256 del corpus con al menos una página `digital`.
    - Ordenados.
  - `estimar_costo(shas: list[str], cat, estrategia: str) -> float`. Usa `llm.estimar_tokens` sobre el contexto que se mandaría, con salida de 1.500 tokens por bloque. Con `completa`, cuenta el documento como caché a partir del segundo bloque.
  - `correr(grupo: str, estrategia: str, limite: int | None, cliente: llm.Cliente, destino: Path) -> Path`:
    - Procesa cada documento con `ThreadPoolExecutor(config.CONCURRENCIA)`; cada documento procesa sus bloques en orden.
    - Los ejemplos y citas de referencia se piden con `excluir=sha` cuando el documento es de `ajuste`.
    - Escribe `destino / f"extracciones_{grupo}_{estrategia}.csv"`, ordenado por `(sha256, hoja, bloque_key, campo_key)`.
    - Al final imprime el costo real (suma de `Uso.costo_usd`) y el tiempo por documento.
  - CLI: `motor extraer --grupo {ajuste,prueba,todos} --estrategia {localizada,completa} [--limite N] [--si]`:
    1. Escribe `particion.csv` si no existe.
    2. Muestra la estimación de costo.
    3. Si supera `config.TOPE_USD_CORRIDA`, sale con código 2 y un mensaje en español.
    4. Sin `--si`, pide confirmación con `input()`.

- [ ] **Step 1: Write the failing tests** con el corpus sintético de `test_oro.py`, reutilizando su fixture `entorno`: muévela a `tests/fixtures.py` como `entorno_corpus`. Transporte falso:

```python
def test_corrida_escribe_csv_ordenado_y_reproducible(entorno):
    a = correr("ajuste", "localizada", None, cli, entorno / "a"); b = correr("ajuste", "localizada", None, cli, entorno / "b")
    assert a.read_bytes() == b.read_bytes() and leer(a)[0]["rol"] in ("presencia", "campo")
def test_tope_de_costo_detiene(monkeypatch, entorno, capsys):
    monkeypatch.setattr(config, "TOPE_USD_CORRIDA", 0.0)
    assert main(["extraer", "--grupo", "ajuste", "--estrategia", "completa", "--si"]) == 2
def test_ajuste_no_se_usa_a_si_mismo(entorno):   # el doc de ajuste no aparece en sus propios ejemplos
```

- [ ] **Step 2:** `uv run pytest tests/test_corrida.py -v`. Esperado: FAIL.
- [ ] **Step 3:** Implementar `corrida.py` y el subcomando.
- [ ] **Step 4:** `uv run pytest -m "not datos" -q`. Esperado: PASS.
- [ ] **Step 5: Commit** `feat(motor): comando extraer con estimación y tope de costo`

### Task 7: Evaluación e informe

**Files:**
- Create: `motor/src/motor/evaluacion.py`, `motor/src/motor/informe_extraccion.py`
- Modify: `motor/src/motor/cli.py`
- Test: `motor/tests/test_evaluacion.py`

**Interfaces:**
- Consumes: `muestras.referencias` y `leer_particion` (Task 1), y los CSV de la Task 6.
- Produces:
  - `@dataclass Metricas`, con estos contadores (todos `int`):
    - `bloques_ref, bloques_encontrados`;
    - `citas_verdes, citas_amarillas, citas_rojas` (sobre los `ENCONTRADO`);
    - `pagina_correcta, pagina_comparable`;
    - `valores_ok, valores_comparables`;
    - `texto_libre_ok, texto_libre_comparables`;
    - `hallazgos_sin_referencia, claves_excluidas`.
    - Propiedades: `citas_reales = (verdes + amarillas) / encontrados`, `cobertura = encontrados / bloques_ref` y `acierto = valores_ok / valores_comparables`. Las tres devuelven `float | None`.
  - `evaluar(extracciones_csv: Path, set_csv: Path, solo_grupo: str | None) -> dict[str, Metricas]`. Las claves son `"total"`, `"hoja:<hoja>"`, `"bloque:<bloque_key>"` y `"campo:<campo_key>"`. Reglas de §6.7 y §6.8:
    - **Página correcta:** `|pagina - ref.pagina_encontrada o int(ref.pag)| <= 1`, solo cuando la referencia tiene una página única.
    - **Valores:** se comparan con `valor_canonico`. Los números como `float` (tolerancia 1e-6), con la referencia `"0"` tratada como `no_aplica`. Solo cuentan las referencias `confiable`.
    - **`texto_libre`:** `partial_ratio >= 90`.
    - **Hallazgos sin referencia:** bloques `ENCONTRADO` cuyo bloque no tiene ninguna referencia en ese documento.
  - `comparar_estrategias(a: dict, b: dict) -> str`. Devuelve `"localizada"` o `"completa"` según §5 del spec: gana el mejor `citas_reales` y, a igualdad, el mejor `acierto`; si empatan, `"localizada"`.
  - `informe_extraccion.escribir(resultados: dict[str, dict[str, Metricas]], costo: dict, criterios: list[tuple[str, str]], destino: Path) -> Path`. El informe, en Markdown determinista, trae:
    - la tabla total y la tabla por hoja;
    - los 10 bloques peores y los 10 mejores por acierto;
    - citas reales junto a la cobertura;
    - la comparación de estrategias;
    - el costo y el tiempo por documento;
    - las limitaciones: bloques sin ejemplos y claves excluidas;
    - una sección "Criterios definidos por el equipo de desarrollo" con todos los criterios del catálogo;
    - 5 ejemplos de desacuerdo con su cita.
  - CLI: `motor evaluar`. Lee los `extracciones_*.csv` que existan en `config.EXTRACCION` y escribe `docs/informes/extraccion-piloto.md`.

- [ ] **Step 1: Write the failing tests** con CSV sintéticos de extracción y de oro:

```python
def test_metricas_basicas(tmp_path):
    m = evaluar(ext, oro, None)["total"]
    assert m.citas_reales == pytest.approx(2/3) and m.cobertura == pytest.approx(3/4) and m.acierto == pytest.approx(0.5)
def test_cero_de_matriz_es_no_aplica(tmp_path):   # ref "0", extraído "no_aplica" -> ok
def test_pagina_mas_menos_uno(tmp_path):
def test_hallazgo_sin_referencia_no_es_error(tmp_path):
def test_comparar_estrategias_desempata_localizada():
def test_informe_determinista(tmp_path):          # escribir dos veces -> mismos bytes; contiene "Criterios definidos por el equipo de desarrollo"
```

- [ ] **Step 2:** `uv run pytest tests/test_evaluacion.py -v`. Esperado: FAIL.
- [ ] **Step 3:** Implementar los módulos y el subcomando.
- [ ] **Step 4:** `uv run pytest -m "not datos" -q`. Esperado: PASS.
- [ ] **Step 5: Commit** `feat(motor): evaluación contra el set de oro e informe del piloto`

### Task 8: Corrida real del piloto y documentación

**Files:**
- Modify (generado): `motor/catalogo/variables.yaml`, `docs/informes/extraccion-piloto.md`
- Modify: `docs/arquitectura/motor.md`, `docs/arquitectura/uml.md`, `README.md`, `docs/arquitectura/vision-general.md`

- [ ] **Step 1:** `uv run motor catalogo --enriquecer`. Revisar a mano los criterios en el diff de `variables.yaml`: cada uno en una o dos frases, sin contradicciones con el nombre del campo. Corregir los que fallen a mano y commitear: `chore(motor): criterios y palabras clave del catálogo`.
- [ ] **Step 2:** `uv run motor extraer --grupo ajuste --estrategia localizada --limite 3 --si`. Abrir el CSV y revisar 3 bloques contra el PDF. Ajustar los pedidos si hace falta; para invalidar la caché vieja, borrar solo `datos/extraccion/cache/`.
- [ ] **Step 3:** Correr `extraer --grupo ajuste` con las dos estrategias y luego `uv run motor evaluar`. Anotar la estrategia elegida en `config.ESTRATEGIA_ELEGIDA` (constante nueva). Commitear: `chore(motor): estrategia elegida en ajuste`.
- [ ] **Step 4:** `extraer --grupo prueba --estrategia <elegida>`, luego `extraer --grupo todos --estrategia <elegida>`, luego `evaluar`. Esperado: el informe muestra "citas reales" con cobertura para el grupo de prueba, y el costo total sale por debajo de `TOPE_USD_CORRIDA` en cada corrida.
- [ ] **Step 5:** Documentación:
  - `motor.md`: los pasos 7 `extraer` y 8 `evaluar`, los módulos nuevos y los archivos de `datos/extraccion/`;
  - `uml.md`: agregar al diagrama de módulos los nuevos, y una secuencia de `extraer_bloque`;
  - `README.md` y `vision-general.md`: el estado del hito 1 con sus números principales.
- [ ] **Step 6:** `uv run pytest -q`, incluidas las pruebas `datos`. Esperado: PASS. Commit `docs: resultados del piloto de extracción`.

---

## Estimación

Base: tabla inicial (el historial no tiene hitos cerrados). Modificadores:
- ×0,7 por proyecto con tests y patrón establecido;
- ×1,5 en los nodos con DeepSeek, por ser tecnología nueva en el proyecto.

| Nodo | Depende de | Tipo / riesgo | Horas dev | Verificación |
|---|---|---|---|---|
| T1 Partición y referencias | — | datos / Medio | 2–4 | `test_muestras.py` |
| T2 Cliente DeepSeek | — | integración / Medio, ×1,5 | 3–6 | `test_llm.py`, prueba real `-m datos` |
| T3 Localización | — | api / Medio | 2–4 | `test_localizar.py` |
| T4 Catálogo enriquecido | T1, T2, T3 | datos / Medio | 2–4 | `test_catalogo.py` y diff del YAML |
| T5 Extractor | T2, T3, T4 | api / Alto, ×1,5 | 5–10 | `test_extractor.py` |
| T6 Comando extraer | T1, T5 | api / Medio | 2–4 | `test_corrida.py` |
| T7 Evaluación e informe | T1, T6 | datos / Medio | 3–5 | `test_evaluacion.py` |
| T8 Corrida real y docs | T4–T7 | integración / Alto | 5–10 | informe con métricas, `pytest -q` |

- **Camino crítico:** T2 → T4 → T5 → T6 → T7 → T8.
- **Paralelismo máximo:** 3 nodos (T1, T2 y T3 al inicio, sin contratos entre ellos).
- **Puntos de revisión humana:**
  - T5 es de riesgo alto: es la regla que decide qué llega como dato;
  - T8: revisar los criterios redactados por el modelo y la elección de estrategia.
- **Supuestos:**
  - La clave de DeepSeek tiene saldo.
  - El modelo `deepseek-flash` sigue con id y precios iguales a la documentación consultada (26 nov 2026).
  - La extracción por bloque cabe en 4.000 tokens de salida. Tarifas, con 38 campos, es el caso más grande.

| Hito | Nodos | Horas dev | Días hábiles | Depende del cliente |
|---|---|---|---|---|
| 0. Definición | — | 2–4 | 1 | — (diseño ya aprobado) |
| 1. Motor medido en el grupo de ajuste | T1–T6 | 20–40 (16–32 + 25 %) | 4–8 | saldo en la cuenta de DeepSeek |
| 2. Piloto completo e informe | T7–T8 | 10–19 (8–15 + 25 %) | 2–4 | — |
| **Total** | | **32–63** | **7–13** | |

**Compromiso sugerido:** 13 días hábiles, con la condición de que la cuenta de DeepSeek tenga saldo. Se reestima al cerrar T5, el nodo de mayor riesgo.
