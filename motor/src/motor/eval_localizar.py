"""Medición sin modelo de la localización: ¿la página de oro queda en el contexto?"""
from __future__ import annotations

import csv
from pathlib import Path

from motor import config, corpus, muestras
from motor.corrida import _ejemplos_y_citas, _particion
from motor.catalogo import cargar_yaml
from motor.localizar import ESTRATEGIAS
from motor.muestras import Referencia

COLUMNAS = ["sha256", "hoja", "bloque_key", "pagina_oro", "paginas_contexto", "acierta"]


def pagina_oro(r: Referencia) -> int | None:
    """Página de la referencia si la cita pasó y es una sola; si no, None."""
    if r.check_cita != "pasa":
        return None
    if r.pagina_encontrada is not None:
        return r.pagina_encontrada
    return int(r.pag) if r.pag.strip().isdigit() else None


def evaluar_localizacion(destino: Path, estrategia: str = "localizada") -> list[dict]:
    """Filas por (documento de ajuste, bloque, página de oro); escribe localizacion_ajuste.csv."""
    cat = cargar_yaml(config.CATALOGO)
    part = _particion()
    refs, _ = muestras.referencias(config.ORO / "set_de_oro.csv")
    bloques = {b.key: b for b in cat.bloques}
    oro: dict[tuple[str, str, str], set[int]] = {}
    for r in refs.values():
        p = pagina_oro(r) if r.veredicto == "confiable" else None
        if p is not None and part.get(r.sha256) == "ajuste" and r.bloque_key in bloques:
            oro.setdefault((r.sha256, r.hoja, r.bloque_key), set()).add(p)
    filas, paginas_doc = [], {}
    for (sha, hoja, bk), pags in sorted(oro.items()):
        if len(pags) != 1:  # solo bloques con página única
            continue
        (p,) = pags
        if sha not in paginas_doc:
            paginas_doc[sha] = corpus.paginas_con_texto(sha)
        _, citas = _ejemplos_y_citas(refs, part, bk, sha)
        nums = ESTRATEGIAS[estrategia](paginas_doc[sha], citas, bloques[bk].palabras_clave)
        acierta = "exacto" if p in nums else "cerca" if {p - 1, p + 1} & set(nums) else "no"
        filas.append({"sha256": sha, "hoja": hoja, "bloque_key": bk, "pagina_oro": p,
                      "paginas_contexto": ";".join(map(str, nums)), "acierta": acierta})
    destino = Path(destino)
    destino.mkdir(parents=True, exist_ok=True)
    with open(destino / "localizacion_ajuste.csv", "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNAS)
        w.writeheader()
        w.writerows(filas)
    return filas


def resumen_por_bloque(filas: list[dict]) -> dict[str, tuple[int, int, int]]:
    """bloque_key -> (casos, aciertos exactos, aciertos exactos o a ±1)."""
    tabla: dict[str, list[int]] = {}
    for f in filas:
        t = tabla.setdefault(f["bloque_key"], [0, 0, 0])
        t[0] += 1
        t[1] += f["acierta"] == "exacto"
        t[2] += f["acierta"] in ("exacto", "cerca")
    return {k: (a, b, c) for k, (a, b, c) in sorted(tabla.items())}


def imprimir(filas: list[dict]) -> None:
    print(f"{'bloque':<70}{'casos':>6}{'exacto':>8}{"+-1":>8}")
    tot = [0, 0, 0]
    for k, (n, e, c) in resumen_por_bloque(filas).items():
        print(f"{k:<70}{n:>6}{e / n:>8.0%}{c / n:>8.0%}")
        tot = [tot[0] + n, tot[1] + e, tot[2] + c]
    if tot[0]:
        print(f"{'TOTAL':<70}{tot[0]:>6}{tot[1] / tot[0]:>8.0%}{tot[2] / tot[0]:>8.0%}")
