"""Verificador de citas: ¿la cita textual aparece en el folio anotado?"""

import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Literal

from rapidfuzz import fuzz

from motor.config import MIN_CHARS_CITA, MIN_CHARS_CITA_PAR, UMBRAL_CITA
from motor.normalizar import texto_busqueda

Estado = Literal[
    "pasa", "pagina_ambigua", "pagina_desplazada", "no_encontrada",
    "sin_texto", "no_verificable", "pagina_invalida",
]
MAX_CHARS_CITA = 400

_norm = lru_cache(maxsize=8192)(texto_busqueda)


@dataclass
class ResultadoCita:
    estado: Estado
    pagina_anotada: int | None
    pagina_encontrada: int | None
    score: float
    check: dict
    entre_paginas: bool = False  # la coincidencia salió del camino de pares de folios


def _check(resultado: str, detalle: str) -> dict:
    return {"tipo": "cita_en_pagina", "resultado": resultado, "detalle": detalle}


def _score(cita_n: str, pagina_n: str) -> float:
    if not pagina_n:
        return 0.0
    if len(pagina_n) < len(cita_n):
        # Página más corta que la cita: partial_ratio alinearía al revés; se exige
        # que la página completa sea casi igual a la cita.
        return float(fuzz.ratio(cita_n, pagina_n))
    return float(fuzz.partial_ratio_alignment(cita_n, pagina_n).score)


def _par(cita_n: str, a_n: str, b_n: str) -> float:
    """Score de la cita repartida entre el final de la página a y el inicio de b.

    Camino 1: unión de ambas páginas. Camino 2 (tolerante a membretes largos entre
    las mitades): la mitad inicial de la cita debe alinear al final de a y la
    final al comienzo de b. Se asume que la cita no cabe entera en una sola página.
    """
    if not a_n or not b_n or len(cita_n) < MIN_CHARS_CITA_PAR:
        return 0.0  # una cita corta repartida entre folios es demasiado fácil de falsear
    mejor = _score(cita_n, a_n + " " + b_n)
    # El salto de página rara vez cae justo en la mitad de la cita: se prueban varios
    # cortes en límite de palabra; cada mitad debe ser >= 40 % de la cita.
    n = len(cita_n)
    cortes = (cita_n.rfind(" ", 0, n // 2 + 1), cita_n.find(" ", int(n * 0.4)),
              cita_n.rfind(" ", 0, int(n * 0.6) + 1))
    for corte in cortes:
        if corte < 0:
            continue
        cabeza, cola = cita_n[:corte].strip(), cita_n[corte:].strip()
        if min(len(cabeza), len(cola)) < max(MIN_CHARS_CITA, 0.4 * n):
            continue
        if len(a_n) < len(cabeza) or len(b_n) < len(cola):
            continue
        ah = fuzz.partial_ratio_alignment(cabeza, a_n)
        if ah.score < UMBRAL_CITA or ah.dest_end < 0.6 * len(a_n):
            continue
        bc = fuzz.partial_ratio_alignment(cola, b_n)
        if bc.score >= UMBRAL_CITA and bc.dest_start <= 0.4 * len(b_n):
            return max(mejor, min(ah.score, bc.score))
    return mejor


def verificar_cita(cita: str | None, pag: str | None,
                   paginas: dict[int, str | None]) -> ResultadoCita:
    cita_n = _norm(cita or "")[:MAX_CHARS_CITA].strip()
    anotada_txt = (pag or "").strip()
    nums = [int(x) for x in re.findall(r"\d+", anotada_txt)]
    if len(cita_n) < MIN_CHARS_CITA:
        return ResultadoCita("no_verificable", nums[0] if nums else None, None, 0.0,
                             _check("no_aplica", "La cita es demasiado corta para verificarse"))

    validas = [n for n in nums if n in paginas]
    anotada = validas[0] if validas else (nums[0] if nums else None)
    invalida = not validas

    def sola(n: int) -> float:
        return _score(cita_n, _norm(paginas[n])) if paginas.get(n) is not None else 0.0

    entre: dict[int, bool] = {}

    def score_anotada(n: int) -> float | None:
        """Mejor score en la página n sola o repartida con la anterior / la siguiente."""
        if paginas[n] is None:
            return None
        mejor = sola(n)
        if mejor >= UMBRAL_CITA:
            return mejor
        for otra in (n - 1, n + 1):
            if paginas.get(otra) is not None and sola(otra) < UMBRAL_CITA:
                a, b = (otra, n) if otra < n else (n, otra)
                sc = _par(cita_n, _norm(paginas[a]), _norm(paginas[b]))
                if sc > mejor:
                    mejor = sc
                    entre[n] = True
        return mejor

    if validas:
        scores = {n: score_anotada(n) for n in validas}
        pasan = [n for n in validas if scores[n] is not None and scores[n] >= UMBRAL_CITA]
        if pasan and len(nums) > 1:
            n = pasan[0]
            return ResultadoCita("pagina_ambigua", anotada, n, scores[n],
                                 _check("alerta", f"La cita aparece en el folio {n}, "
                                                  f"uno de los anotados («{anotada_txt}»)"),
                                 entre.get(n, False))
        if pasan:
            return ResultadoCita("pasa", anotada, pasan[0], scores[pasan[0]],
                                 _check("pasa", f"La cita aparece en el folio {pasan[0]}"),
                                 entre.get(pasan[0], False))

    singles = {n: sola(n) for n, t in paginas.items() if t is not None}
    mejor_n, mejor_s, por_par = None, 0.0, False
    for n, sc in singles.items():
        if sc > mejor_s:
            mejor_n, mejor_s = n, sc
    if mejor_s < UMBRAL_CITA:
        for n in singles:
            if n + 1 in singles:
                sc = _par(cita_n, _norm(paginas[n]), _norm(paginas[n + 1]))
                if sc > mejor_s:
                    mejor_n, mejor_s, por_par = n, sc, True
    if mejor_n is not None and mejor_s >= UMBRAL_CITA:
        return ResultadoCita(
            "pagina_desplazada", anotada, mejor_n, mejor_s,
            _check("alerta", f"La cita aparece en el folio {mejor_n}, no en el folio "
                             f"{anotada_txt or 'vacío'} anotado"),
            por_par)

    if invalida:
        return ResultadoCita("pagina_invalida", anotada, None, mejor_s,
                             _check("falla", f"El folio anotado («{anotada_txt}») "
                                             "no existe en el documento"))
    if any(paginas[n] is None for n in validas):
        n = next(n for n in validas if paginas[n] is None)
        return ResultadoCita("sin_texto", anotada, None, mejor_s,
                             _check("no_aplica", f"El folio {n} es escaneado; "
                                                 "se verifica después del OCR"))
    return ResultadoCita("no_encontrada", anotada, None, mejor_s,
                         _check("falla", "La cita no aparece en el documento"))


def verificar_valor_en_pagina(valor: str, pagina_texto: str | None) -> dict:
    """Check `valor_de_cita`: el número aparece como token en el folio (4.5 = 4,5 = 4 5)."""
    if pagina_texto is None:
        return {"tipo": "valor_de_cita", "resultado": "no_aplica",
                "detalle": "El folio citado no tiene texto"}
    tok = _norm(valor).strip()
    ok = bool(tok) and re.search(rf"(?<![a-z0-9])(?<!\d ){re.escape(tok)}(?![a-z0-9])(?! \d)",
                                 _norm(pagina_texto)) is not None
    if ok:
        return {"tipo": "valor_de_cita", "resultado": "pasa",
                "detalle": f"La tarifa {valor} aparece en el folio citado"}
    return {"tipo": "valor_de_cita", "resultado": "alerta",
            "detalle": f"La tarifa {valor} no aparece en el folio citado"}
