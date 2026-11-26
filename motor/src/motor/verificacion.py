"""Verificador de citas: ¿la cita textual aparece en el folio anotado?"""

import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Literal

from rapidfuzz import fuzz

from motor.config import MIN_CHARS_CITA, UMBRAL_CITA
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

    if validas:
        scores = {n: (_score(cita_n, _norm(paginas[n])) if paginas[n] is not None else None)
                  for n in validas}
        pasan = [n for n in validas if scores[n] is not None and scores[n] >= UMBRAL_CITA]
        if pasan and len(nums) > 1:
            n = pasan[0]
            return ResultadoCita("pagina_ambigua", anotada, n, scores[n],
                                 _check("alerta", f"La cita aparece en el folio {n}, "
                                                  f"uno de los anotados («{anotada_txt}»)"))
        if pasan:
            return ResultadoCita("pasa", anotada, pasan[0], scores[pasan[0]],
                                 _check("pasa", f"La cita aparece en el folio {pasan[0]}"))

    mejor_n, mejor_s = None, 0.0
    for n, texto in paginas.items():
        if texto is None:
            continue
        s = _score(cita_n, _norm(texto))
        if s > mejor_s:
            mejor_n, mejor_s = n, s
    if mejor_n is not None and mejor_s >= UMBRAL_CITA:
        return ResultadoCita(
            "pagina_desplazada", anotada, mejor_n, mejor_s,
            _check("alerta", f"La cita aparece en el folio {mejor_n}, no en el folio "
                             f"{anotada_txt or 'vacío'} anotado"))

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
    ok = bool(tok) and re.search(rf"(?<![a-z0-9]){re.escape(tok)}(?![a-z0-9])",
                                 _norm(pagina_texto)) is not None
    if ok:
        return {"tipo": "valor_de_cita", "resultado": "pasa",
                "detalle": f"La tarifa {valor} aparece en el folio citado"}
    return {"tipo": "valor_de_cita", "resultado": "alerta",
            "detalle": f"La tarifa {valor} no aparece en el folio citado"}
