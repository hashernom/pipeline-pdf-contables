# Handoff: motor de extracción (hito 1), en pausa

Fecha: 27 nov 2026. Pausado por falta de saldo en DeepSeek (HTTP 402).

## Dónde está

- **Rama:** `feat/motor-extraccion`, pusheada a GitHub. **No está mergeada en `main`.**
- **Worktree local:** `D:\pipeline-pdf-contables\.claude\worktrees\motor-extraccion`. Dentro, `datos/` es una *junction* a `D:\pipeline-pdf-contables\datos`.
- **Diseño:** [specs/2026-11-26-motor-extraccion-design.md](../specs/2026-11-26-motor-extraccion-design.md). La sección 6.8 recoge las decisiones tomadas tras la revisión.
- **Plan:** [plans/2026-11-26-motor-extraccion.md](../plans/2026-11-26-motor-extraccion.md).
- **Bitácora local** (no está en git, solo en el worktree): `.superpowers/sdd/2026-11-26-motor-extraccion/progress.md`. Trae los *rulings*, los hallazgos menores diferidos y los reportes de cada tarea.

## Estado

| Tarea | Estado |
|---|---|
| 1 a 7: partición, cliente DeepSeek, localización, catálogo, extractor, `extraer`, `evaluar` | ✅ hechas y revisadas |
| 8b: tolerancia a fallos por documento, `localizar-eval`, tablas largas de Tarifas | ✅ hecha y revisada |
| 8c: el `0` de la matriz no cuenta como referencia | ✅ hecha y revisada |
| 8: corrida real del piloto | ⏸ **a medias, falta saldo** |
| Revisión final de la rama | pendiente |

Pruebas: `cd motor && uv run pytest -m "not datos" -q` → 157 passed.

## Resultados preliminares (grupo de ajuste, no es la medición final)

Están en [informes/extraccion-piloto.md](../../informes/extraccion-piloto.md), generado con `motor evaluar`.

| Corrida | Docs | Citas reales | Cobertura | Página correcta | Acierto en valores |
|---|---|---|---|---|---|
| ajuste / completa | 24 de 30 (desde caché) | 100 % | 97,1 % | 93,5 % | 71,6 % |
| ajuste / localizada | 3 | 100 % | 90,5 % | 78,9 % | 59,8 % |

La corrida `localizada` es anterior a la extensión de tablas de Tarifas; hay que repetirla.

Gasto en DeepSeek hasta ahora: unos 2,9 USD (tarifa pico), incluido el enriquecimiento del catálogo.

## Hallazgo importante: Tarifas

El acierto de Tarifas contra la matriz es bajo (27 % en `completa`). Probablemente **no mide bien al motor**:
- El veredicto `confiable` del set de oro solo dice que la cita existe en el PDF, no que los valores estén bien copiados.
- En varios documentos, la matriz trae el mismo valor en todas las secciones de la tabla. Ejemplo: el documento `35a80f80…` tiene 8 en todas, mientras el motor lee entre 5 y 10 según la sección.

**Siguiente paso recomendado:** validar a mano unos 5 documentos de Tarifas contra el PDF antes de sacar conclusiones.

## Cómo retomar (cuando haya saldo)

Desde `motor/`:

1. `uv run motor extraer --grupo ajuste --estrategia completa --si`. Hay 24 documentos en caché, que no se pagan; faltan 6.
2. `uv run motor extraer --grupo ajuste --estrategia localizada --si`. Se estima en unos 1,3 USD; con la extensión de tablas puede costar algo más.
3. `uv run motor evaluar`. Elegir la estrategia (gana la de mejor "citas reales", luego la de mejor acierto; si empatan, `localizada`). Fijar `ESTRATEGIA_ELEGIDA` en `config.py` y commitear.
4. `extraer --grupo prueba --estrategia <elegida> --si` y después `--grupo todos`. Si la estimación supera `TOPE_USD_CORRIDA` (10 USD), partir la corrida con `--limite`.
5. `uv run motor evaluar` otra vez. Actualizar el estado del hito 1 con los números del grupo de prueba en `README.md` y en `docs/arquitectura/vision-general.md`.
6. `uv run pytest -q`, incluidas las pruebas `datos`.
7. Revisión final de toda la rama. Repasar los hallazgos menores diferidos de la bitácora. Preguntar al usuario antes de mergear a `main`.

## Hallazgos menores diferidos (los más relevantes)

- **Caché:** un archivo corrupto lanza una excepción, y el `.tmp` tiene un nombre fijo por clave.
- **`corrida.py`:** atrapa `except Exception` de forma amplia (oculta errores de programación) y no suma el costo de un documento que falla a mitad de camino.
- **Medición de páginas de tabla en Tarifas:** es en parte circular. El efecto real se ve solo en una corrida `localizada` pagada.
- **Catálogo:** los campos `cual`/`cual_2` de `base_gravable_especial` quedaron como `si_no`, aunque por su nombre parecen texto.
- **Limpieza:** hay imports sin uso en `test_oro.py` y funciones privadas de `corrida.py` que se usan desde otros módulos.

## Decisiones vigentes

- Los subagentes usan `model: sonnet`.
- El equipo de contaduría no aprueba nada intermedio. Los criterios los definimos nosotros y quedan escritos en el informe.
- OCR fuera de este hito.
- La medición final se hace solo sobre el grupo `prueba`. Nunca se ajustan pedidos ni criterios mirando ese grupo.
