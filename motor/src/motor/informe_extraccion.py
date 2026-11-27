"""Informe en Markdown del piloto de extracción (determinista)."""

from collections.abc import Sequence
from pathlib import Path

from motor.catalogo import Catalogo
from motor.evaluacion import Metricas, comparar_estrategias

N_EXTREMOS = 10
N_EJEMPLOS = 5
SIN_COSTO = "sin datos de costo"


def criterios_catalogo(cat: Catalogo) -> list[tuple[str, str]]:
    """(clave, criterio) de cada bloque (presencia) y cada campo del catálogo."""
    salida = []
    for b in cat.bloques:
        salida.append((f"{b.key} (presencia)", b.criterio_presencia))
        salida += [(c.key, c.criterio) for c in b.campos]
    return salida


def _pct(v: float | None) -> str:
    return "n/d" if v is None else f"{v * 100:.1f} %"


def _frac(a: int, b: int) -> str:
    return f"{a}/{b}"


def _fila(nombre: str, m: Metricas) -> str:
    pag = m.pagina_correcta / m.pagina_comparable if m.pagina_comparable else None
    return (f"| {nombre} | {_pct(m.citas_reales)} | {_pct(m.citas_verdes_tasa)} "
            f"| {_pct(m.cobertura)} ({_frac(m.bloques_ref_encontrados, m.bloques_ref)}) "
            f"| {_pct(pag)} | {_pct(m.acierto)} ({_frac(m.valores_ok, m.valores_comparables)}) "
            f"| {m.hallazgos_sin_referencia} |")


_ENCABEZADO = ("| {} | Citas reales | Citas en verde | Cobertura | Página correcta "
               "| Acierto en valores | Hallazgos sin referencia |\n|---|---|---|---|---|---|---|")


def _tabla(primera: str, filas: Sequence[tuple[str, Metricas]]) -> list[str]:
    return [_ENCABEZADO.format(primera)] + [_fila(n, m) for n, m in filas]


def _por_prefijo(res: dict[str, Metricas], prefijo: str) -> list[tuple[str, Metricas]]:
    return [(k[len(prefijo):], res[k]) for k in sorted(res) if k.startswith(prefijo)]


def _extremos(res: dict[str, Metricas]) -> tuple[list, list]:
    con_valores = [(n, m) for n, m in _por_prefijo(res, "bloque:") if m.valores_comparables]
    orden = sorted(con_valores, key=lambda x: (x[1].acierto, x[0]))
    return orden[:N_EXTREMOS], sorted(con_valores, key=lambda x: (-x[1].acierto, x[0]))[:N_EXTREMOS]


def _costo(costo: dict, nombre: str) -> str:
    c = costo.get(nombre)
    if not c or not c.get("documentos"):
        return SIN_COSTO
    n = c["documentos"]
    return (f"{c['costo_usd_real'] / n:.2f} USD por documento "
            f"({c['costo_usd_real']:.2f} USD en {n} documentos), "
            f"{c['segundos_total'] / n:.1f} s por documento")


def _comparaciones(resultados: dict[str, dict[str, Metricas]]) -> list[str]:
    lineas = []
    for grupo in sorted({n.rsplit("_", 1)[0] for n in resultados}):
        a, b = resultados.get(f"{grupo}_localizada"), resultados.get(f"{grupo}_completa")
        if a and b:
            lineas += [f"### Grupo {grupo}", "", *_tabla("Estrategia", [
                ("localizada", a["total"]), ("completa", b["total"])]), "",
                f"Estrategia elegida: **{comparar_estrategias(a, b)}** (gana la de mejores "
                "citas reales y, a igualdad, la de mejor acierto; si empatan, `localizada` "
                "por costo y velocidad).", ""]
    return lineas or ["Solo hay corridas de una estrategia por grupo; no hay nada que comparar.", ""]


def escribir(resultados: dict[str, dict[str, Metricas]], costo: dict,
             criterios: list[tuple[str, str]], destino: Path,
             sin_ejemplos: Sequence[str] = ()) -> Path:
    """Escribe el informe. `resultados` va por corrida (`<grupo>_<estrategia>`)."""
    L: list[str] = [
        "# Informe del piloto de extracción", "",
        "Citas reales mide alucinación: de los bloques `ENCONTRADO`, cuántos tienen una cita "
        "que aparece en el documento (verde o amarillo). La cobertura se lee siempre junto a "
        "las citas reales: de los bloques confiables del set de oro, cuántos encontró el "
        "motor. El acierto en valores usa solo referencias `confiable`.", ""]
    for nombre in sorted(resultados):
        res = resultados[nombre]
        L += [f"## Corrida {nombre}", "", "### Total", "",
              *_tabla("Corrida", [("total", res["total"])]), "",
              "### Por hoja", "", *_tabla("Hoja", _por_prefijo(res, "hoja:")), ""]
        peores, mejores = _extremos(res)
        L += ["### Los 10 bloques con peor acierto", "", *_tabla("Bloque", peores), "",
              "### Los 10 bloques con mejor acierto", "", *_tabla("Bloque", mejores), ""]
        t = res["total"]
        L += ["### Señales secundarias", "",
              f"- Campos de texto libre (parecido >= 90): {_frac(t.texto_libre_ok, t.texto_libre_comparables)}.",
              f"- Referencias `revisar` (no entran al acierto): {_frac(t.revisar_ok, t.revisar_comparables)} coinciden.",
              f"- Hallazgos sin referencia (no cuentan como error): {t.hallazgos_sin_referencia}.",
              f"- Costo y tiempo: {_costo(costo, nombre)}.", ""]
        L += ["### Ejemplos de desacuerdo", ""]
        if t.desacuerdos:
            for sha, bloque, campo, esperado, extraido, cita in t.desacuerdos[:N_EJEMPLOS]:
                L += [f"- `{sha[:12]}` {campo}: la matriz dice `{esperado}` y el motor `{extraido}`.",
                      f"  Cita del motor: {cita or '(sin cita)'}"]
        else:
            L.append("Sin desacuerdos en los campos confiables.")
        L.append("")
    L += ["## Comparación de estrategias", "", *_comparaciones(resultados)]
    excluidas = max((r["total"].claves_excluidas for r in resultados.values()), default=0)
    L += ["## Limitaciones", "",
          f"- Claves excluidas por valores en conflicto entre filas de la matriz: {excluidas}.",
          "- Bloques sin ejemplos en el grupo de ajuste (el pedido va sin ejemplos): "
          + (", ".join(f"`{b}`" for b in sorted(sin_ejemplos)) if sin_ejemplos else "ninguno") + ".",
          "", "## Criterios definidos por el equipo de desarrollo", "",
          "Son criterios del equipo de desarrollo, sujetos a revisión. No provienen de la matriz "
          "de los estudiantes.", ""]
    L += [f"- `{clave}`: {criterio}" for clave, criterio in criterios]
    destino = Path(destino)
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(("\n".join(L) + "\n").encode("utf-8"))
    return destino
