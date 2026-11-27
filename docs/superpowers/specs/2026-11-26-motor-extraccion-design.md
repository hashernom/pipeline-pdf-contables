# Diseño: motor de extracción (hito 1, piloto medido en PDFs digitales)

Fecha: 26 nov 2026 · Estado: borrador para aprobación

## 1. Intención

El hito 0 dejó un set de oro: 10.305 datos de la matriz ICA cuya cita se comprobó en el PDF (134 documentos, 1.075 bloques). Ver [motor.md](../../arquitectura/motor.md).

Este hito construye el **motor de extracción**. Recibe un acuerdo en PDF con texto y devuelve, para cada bloque del catálogo:
- el artículo, la página y la cita literal;
- el valor de cada campo;
- un estado `ENCONTRADO` / `NO_ENCONTRADO`.

El verificador del hito 0 revisa cada respuesta y le pone un semáforo. Un informe mide al motor contra el set de oro.

**Por qué:** el objetivo del proyecto es que los estudiantes dejen de llenar la matriz a mano y solo revisen. Para eso el motor tiene que extraer bien, y hay que poder demostrarlo con números antes de construir la interfaz (hito 2).

**Contexto que manda:** el equipo de contaduría **no aprueba nada intermedio**. Recibe al final un producto terminado y decide si le sirve (dicho por el usuario el 26 nov 2026). Cualquier criterio que haga falta lo decidimos nosotros: lo dejamos escrito, con su razón, y fácil de cambiar.

## 2. Qué es éxito

Un **piloto medido**:

1. Corre sobre los 134 PDFs con datos `confiable`, partidos de forma fija en un grupo de **ajuste** (30 documentos) y uno de **prueba** (104). En el de ajuste se afinan los pedidos al modelo. El de prueba solo se usa para la medición final.
2. Entrega por documento y bloque: artículo, página, cita, valores, estado y semáforo.
3. Entrega un informe con estas métricas, por hoja, bloque y campo:
   - **Página correcta:** la página que devuelve el motor coincide con la que encontró el verificador en el set de oro. Se cuenta como correcta si coincide exacta o con una diferencia de ±1.
   - **Citas reales:** de los bloques `ENCONTRADO`, qué porcentaje pasa el verificador. **Meta: 95 % o más.** Es la medida de alucinación.
   - **Acierto en valores:** coincidencia con la matriz en los campos `confiable` del grupo de prueba.
   - **Cobertura:** bloques que el set de oro tiene con dato y el motor deja `NO_ENCONTRADO`.
   - **Costo y tiempo por documento.**
4. Al final, el motor corre sobre todos los PDFs digitales del corpus, unos 150, haya o no set de oro. Así queda listo el material para el hito 2.

Salir del hito significa saber, con números, en qué bloques y campos el motor ya sirve y en cuáles no. No se fija de antemano un umbral de acierto en valores. Se informa y se decide con él.

## 3. Metas, no-metas y anti-metas

**Metas**
- Ningún dato sin cita y página. Lo que el modelo no respalde con una cita verificable queda `NO_ENCONTRADO` o en rojo.
- Reproducible: las respuestas del modelo se guardan en disco, así que volver a correr da lo mismo sin pagar otra vez.
- El extractor recibe el texto **página por página** (`dict[int, str | None]`, igual que `corpus.paginas_con_texto`) y no le importa de dónde viene ese texto. Así el hito OCR se conecta después sin tocar el extractor.

**No-metas**
- OCR, páginas escaneadas y capa OCR. Solo se procesan páginas `digital`.
- Interfaz, API, cola, base de datos.
- Las otras 10 hojas temáticas de la matriz. El alcance son las mismas tres hojas del hito 0 (Elementos del tributo, Actividades no sujetas, Tarifas), **Tarifas incluida**.
- Doble pasada en campos críticos (de la ficha técnica). Se deja para cuando el informe muestre qué campos fallan.
- Las filas `varios_acuerdos`, `otro_acuerdo`, etc. no entran a la medición. El extractor trabaja por PDF, no por fila de la matriz.

**Anti-metas** (sería un fracaso aunque funcione)
- Que el motor parezca bueno porque se midió con los mismos documentos con que se afinó. Por eso la separación ajuste/prueba es fija y los ejemplos para el modelo salen solo del grupo de ajuste.
- Aceptar una cita que el verificador no comprobó.
- Inventar un valor para "rellenar": si la cita no lo dice, el campo va vacío con `NO_ENCONTRADO`.

## 4. Restricciones

- **Modelo:** DeepSeek V4.1 Flash, como fija la ficha técnica. Se consultó la documentación oficial en context7 (`/websites/api-docs_deepseek`):
  - id `deepseek-flash`, ventana de **1.048.576 tokens**;
  - API compatible con el SDK de OpenAI (`base_url=https://api.deepseek.com`);
  - `response_format={"type": "json_object"}` garantiza JSON válido, pero el pedido mismo tiene que pedir JSON;
  - `temperature=0` y `extra_body={"thinking": {"type": "disabled"}}`;
  - caché de contexto automática para prefijos idénticos: el acierto cuesta USD 0,014 por millón de tokens, contra 0,15–0,30 sin caché.
- **Clave:** `DEEPSEEK_API_KEY` ya está en el entorno. Nunca va a git ni a los registros.
- **Python 3.12 y uv**, dentro del paquete `motor/`, siguiendo los patrones del hito 0: rutas solo en `config.py`, CSV UTF-8 con BOM, salida ordenada y determinista.
- **Interfaz en español de Colombia.** Los detalles de los checks son frases legibles.

## 5. Enfoques

| Enfoque | Qué es | A favor | En contra |
|---|---|---|---|
| **A. Localizar y luego preguntar por bloque** | Para cada bloque se buscan 2–4 páginas candidatas y solo esas van al modelo | Pedidos cortos; sigue la ficha técnica (localización → extracción) | Si la búsqueda falla, el bloque se pierde |
| **B. Documento completo con caché** | El acuerdo entero va como prefijo fijo; luego una pregunta por bloque, que reutiliza el prefijo de la caché | Sin riesgo de que la búsqueda falle; el modelo ve el contexto completo | Los modelos pierden precisión con textos largos (165 páginas de promedio, unos 100.000 tokens) |
| C. Solo reglas | Parecido de texto y patrones, sin modelo | Gratis, determinista | Las casillas Sí/No exigen interpretar el artículo; solo sirve como punto de comparación |

**Elegido: A**, propuesto en la conversación y aceptado por el usuario ("continúa con tu propuesta").

**Cambio respecto de lo conversado (decisión nuestra):** al proponer A dije que B rozaba el límite del modelo y costaba 20 o 30 veces más. La documentación lo desmiente. La ventana es de 1M tokens y, con la caché, B cuesta del orden de USD 0,04 por documento. Lo que sigue valiendo contra B es la pérdida de precisión con textos largos.

Por eso el extractor recibe "las páginas de contexto" como parámetro, y la estrategia que elige esas páginas es intercambiable:
- `localizada` (A): candidatas por bloque. **Es la estrategia por defecto.**
- `completa` (B): todas las páginas digitales.

En el grupo de ajuste se corren las dos y se comparan. Para el grupo de prueba se queda la que dé mejor "citas reales" y "acierto en valores". Si empatan, gana `localizada` por costo y velocidad. Esto agrega un módulo pequeño y una corrida extra en 30 documentos, y evita comprometernos con una suposición que ya resultó falsa una vez.

## 6. Diseño

### 6.1 Piezas nuevas en `motor/src/motor/`

| Módulo | Qué hace |
|---|---|
| `muestras.py` | Separación fija ajuste/prueba de los 134 documentos. Por ejemplo, ordenar por `sha256` y tomar 30 con una semilla fija. Se guarda en `datos/extraccion/particion.csv` |
| `localizar.py` | Estrategias `localizada` y `completa`: dado un bloque y las páginas del documento, devuelve la lista de páginas de contexto |
| `llm.py` | Cliente DeepSeek y **caché en disco** de cada respuesta, con la clave sha256 de (modelo, mensajes, parámetros). Reintentos ante errores de red. Registra tokens (con y sin caché) y tiempo |
| `extractor.py` | Arma el pedido de un bloque, llama al modelo, interpreta el JSON y lo valida con Pydantic. Verifica la cita, reintenta una vez si falla y produce `Extraccion` |
| `evaluacion.py` | Cruza las extracciones con el set de oro y calcula las métricas |
| `informe_extraccion.py` | Escribe `docs/informes/extraccion-piloto.md` |

Comandos nuevos en `cli.py`:
- `extraer [--grupo ajuste|prueba|todos] [--estrategia localizada|completa] [--limite N]`
- `evaluar`

### 6.2 Localización (estrategia `localizada`)

Para cada bloque, el puntaje de una página combina dos señales:
1. **Parecido con citas de referencia:** las citas `confiable` de ese bloque en documentos del **grupo de ajuste**. Se usa el `partial_ratio` de RapidFuzz sobre el texto normalizado con `texto_busqueda`, como el verificador.
2. **Palabras clave del bloque:** salen del nombre del bloque y de las palabras más distintivas de sus citas de referencia. Se generan una vez y se guardan en `palabras_clave` del catálogo, que hoy está vacío.

Se toman las 3 páginas de mayor puntaje más sus vecinas inmediatas, porque las citas cruzan saltos de página. Tope: 6 páginas.

Al evaluar un documento del grupo de ajuste, sus propias citas se excluyen de las referencias, para que no se encuentre a sí mismo.

### 6.3 El pedido al modelo (un bloque por llamada)

- **Sistema:**
  - el rol;
  - las reglas: solo responder con lo que dice el texto, la cita copiada literal, y `NO_ENCONTRADO` si no está;
  - el formato JSON exacto.
- **Usuario:**
  - el bloque: nombre, hoja y campos con su tipo y valores permitidos;
  - el **criterio** de cada campo (6.5);
  - 2 o 3 **ejemplos** del grupo de ajuste: cita y valores que puso el equipo;
  - las páginas de contexto, cada una marcada `=== PÁGINA n ===`, con `n` igual al índice del PDF.
- Con la estrategia `completa`, el documento va primero y la pregunta del bloque al final, para que el prefijo idéntico aproveche la caché.

Respuesta esperada:

```json
{
  "estado": "ENCONTRADO",
  "articulo": "39",
  "pagina": 12,
  "cita": "texto literal copiado del documento",
  "campos": {"elementos_del_tributo.sujeto_pasivos.persona_natural": "si"}
}
```

### 6.4 Verificación y semáforo

1. `verificar_cita(cita, str(pagina), paginas)`, el verificador del hito 0 sin cambios.
2. Si la cita no pasa (`no_encontrada` o `pagina_invalida` sin hallazgo), se reintenta **una vez**. El reintento le dice al modelo que la cita no se encontró literal en la página indicada. Si vuelve a fallar, el bloque queda `NO_ENCONTRADO` con el detalle del verificador. Nunca se entrega una cita sin comprobar.
3. Para los números de Tarifas, `verificar_valor_en_pagina(valor, cita)`: el valor tiene que salir de la cita.
4. Validación de formato: el valor está en `valores_permitidos`, o es un número válido.

| Semáforo | Condición |
|---|---|
| verde | La cita `pasa` en la página que dio el modelo, el formato es válido y, en Tarifas, el valor aparece en la cita |
| amarillo | La cita aparece en otra página o repartida entre páginas, o el valor no aparece en la cita |
| rojo | `NO_ENCONTRADO`, o la cita no se pudo verificar tras el reintento |

### 6.5 Criterios del catálogo (decisión nuestra)

El catálogo tiene los 152 criterios en `pendiente`, y el equipo no los va a aprobar. Los escribimos nosotros:

- **Casillas Sí/No:** se escribe un criterio de una o dos frases por campo. Sale de leer el nombre de la columna y una muestra de citas con lo que marcó el equipo, en el grupo de ajuste. Ejemplo: `persona_natural` vale "si" si el artículo nombra a las personas naturales como sujetos pasivos. `no_aplica` va cuando el bloque no existe en el acuerdo. Se guardan en `variables.yaml` con `estado: borrador`.
- **P1, tarifas:** el valor se extrae **tal como lo escribe el acuerdo**, con su unidad (`por_mil`, `porcentaje` o `pesos`), y se normaliza a por mil para comparar con la matriz. El `0` de la matriz se interpreta como "no aplica" y no se usa como dato de referencia.
- **P2, filas con varios acuerdos:** quedan fuera de la medición, porque no hay un PDF único contra el cual medir.

Todos quedan anotados en el informe como "criterios definidos por el equipo de desarrollo", para que el equipo de contaduría los vea al recibir el producto.

### 6.6 Salidas

- `datos/extraccion/cache/`: respuestas del modelo, una por clave (fuera de git).
- `datos/extraccion/extracciones.csv`: una fila por documento, bloque y campo. Columnas: `sha256, archivo, hoja, bloque_key, campo_key, estado, articulo, pagina, cita, valor, unidad, check_cita, detalle_cita, pagina_encontrada, check_valor, semaforo, estrategia, intentos, tokens_entrada, tokens_cache, tokens_salida`.
- `datos/extraccion/particion.csv`: grupo de cada documento.
- `docs/informes/extraccion-piloto.md`: métricas, comparación de estrategias, costo, criterios usados y ejemplos de errores (este sí va en git).

### 6.7 Evaluación

- **Unión** con el set de oro por `sha256` + `hoja` + `campo_key`. La fila de la matriz se obtiene a través de `documentos.csv`.
- **Página correcta:** se compara con `pagina_encontrada` del set de oro, o con `pag` si la cita pasó en la página anotada.
- **Valores:** se comparan normalizados. Sí/No/no aplica con `valor_canonico`; los números como `float` en por mil, con tolerancia 1e-6.
- **Qué entra:** solo los campos con veredicto `confiable` cuentan para el acierto en valores. Los `revisar` se informan aparte como señal secundaria.

### 6.8 Decisiones tras la revisión del diseño (nuestras)

Tamaño real del catálogo: 17 bloques y 152 campos. Una corrida es de unas **17 llamadas por documento**: unas 2.300 en el piloto y unas 2.550 sobre los 150 PDFs digitales, más reintentos.

1. **Tarifas tiene una llamada por bloque.** `tarifas_actividades_economicas` tiene 38 campos (mínimo y máximo de 19 secciones CIIU). El JSON lleva una sola cita para el bloque, que es el artículo de la tabla, más los 38 valores, cada uno con su `unidad`.
   - **Cita:** se verifica como en cualquier bloque.
   - **Valores:** cada valor se busca con `verificar_valor_en_pagina` **en las páginas de contexto que contienen la tabla** (la página citada y la siguiente), no solo en el texto de la cita, porque la tabla suele ser larga y cruzar páginas.
   - **Sección que no aparece en la tabla:** su campo va `no_aplica`.
   - **El `0` de la matriz** se trata como `no_aplica` al evaluar.
2. **Claves repetidas en el set de oro.** Varias filas de la matriz apuntan al mismo PDF, y hay 168 claves `sha256 + hoja + campo_key` repetidas.
   - Si todas las filas dan el mismo valor, cuenta una vez.
   - Si no coinciden, la clave se excluye de la medición y se informa cuántas fueron.
3. **`presencia` se evalúa como un campo más** (si/no) en todos los bloques, incluidos los que no tienen campos, como `sujeto_activo`. `extracciones.csv` agrega la columna `rol` (`presencia` o `campo`). Artículo y cita se miden con "página correcta" y "citas reales".
4. **Denominadores:**
   - **Citas reales:** bloques `ENCONTRADO` cuya cita aparece en el documento, en verde o en amarillo. Mide alucinación: que la cita exista. Se informa también la tasa solo en verde.
   - **Cobertura:** de los bloques `confiable` del set de oro, cuántos el motor dejó `ENCONTRADO`. **Se informa siempre junto a "citas reales"**, para que un motor que dice `NO_ENCONTRADO` a todo no se vea bueno. No tiene meta fija.
   - **Bloques que el estudiante dejó vacíos** y el motor encontró: se informan aparte como "hallazgos sin referencia". No cuentan como error.
5. **Bloques sin ejemplos en el grupo de ajuste:** el pedido va sin la sección de ejemplos y el informe lo marca como limitación. **Nunca** se toman ejemplos del grupo de prueba.
6. **Costo:**
   - Antes de llamar al modelo, `extraer` calcula los tokens estimados y el costo, y los muestra.
   - Hay un tope configurable `TOPE_USD_CORRIDA` en `config.py` (por defecto 10 USD): si la estimación lo supera, el comando se detiene.
   - `--limite N` procesa solo N documentos.
   - El costo esperado del piloto, con las dos estrategias en el grupo de ajuste, es de unos pocos dólares.
7. **PDFs mixtos (digitales y escaneados):** se procesan con sus páginas digitales. Los campos cuya página en el set de oro es escaneada ya son `sin_texto` en el oro y no entran a la medición. El extractor no cambia.
8. **Campos `texto_libre`** (10 en total): se comparan por parecido (`partial_ratio` ≥ 90 sobre texto normalizado). Se informan aparte y no entran al acierto en valores principal.
9. **Palabras clave y criterios:**
   - **Palabras clave:** se generan **con reglas**: las palabras más distintivas de las citas de referencia del bloque frente a las de los demás bloques (frecuencia relativa), más las del nombre del bloque.
   - **Criterios:** los redacta **DeepSeek una sola vez**, a partir del nombre del campo y de ejemplos del grupo de ajuste. Luego los revisa el desarrollador.
   - Ambos se guardan en `variables.yaml`, que está en git, con `estado: borrador`. El comando es `motor catalogo --enriquecer`, y no sobrescribe lo que ya se editó a mano.

## 7. Lo que queda a quien construya

- La fórmula exacta del puntaje de localización y el peso de cada señal. Se ajusta en el grupo de ajuste.
- La redacción de los pedidos al modelo.
- Cuántos documentos se procesan en paralelo. La API admite 2.500 solicitudes concurrentes, pero conviene un número moderado (por ejemplo 8) y reintentos con espera.
- El manejo de respuestas vacías o cortadas (`finish_reason="length"`): se reintenta una vez y, si persiste, `NO_ENCONTRADO` con el detalle.

## 8. Riesgos

- **Acierto bajo en las casillas Sí/No** porque nuestros criterios difieren de cómo llenó la matriz cada estudiante. El informe separa "cita correcta" de "valor correcto", así se ve si el motor lee bien aunque la matriz diga otra cosa. Los ejemplos de desacuerdo van en el informe.
- **Localización floja en bloques poco frecuentes** (pocas citas de referencia). Se mitiga con la estrategia `completa`, que se compara en el grupo de ajuste.
- **Cambios en la API o en el modelo de DeepSeek.** La caché en disco congela las respuestas del piloto, y el id del modelo queda en `config.py`.
