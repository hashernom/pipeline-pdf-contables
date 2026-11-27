"""Localización de las páginas de un documento relevantes para un bloque."""

from collections import Counter
from collections.abc import Callable

from rapidfuzz import fuzz

from motor import config
from motor.normalizar import texto_busqueda

_MAX_CITA = 300
_PESO_CLAVE = 5.0


def _frecuencias(citas: list[str]) -> Counter[str]:
    """Número de citas que contienen cada token de 5 letras o más."""
    c: Counter[str] = Counter()
    for cita in citas:
        c.update({t for t in texto_busqueda(cita).split() if len(t) >= 5})
    return c


def palabras_clave(
    nombre_bloque: str, citas_bloque: list[str], citas_otros: list[str], n: int = 12
) -> list[str]:
    """Palabras clave del bloque: su nombre más los tokens más distintivos de sus citas."""
    claves: list[str] = []
    for t in texto_busqueda(nombre_bloque).split():
        if len(t) >= 4 and t not in claves:
            claves.append(t)
    fb = _frecuencias(citas_bloque)
    fo = _frecuencias(citas_otros)
    nb = max(len(citas_bloque), 1)
    no = max(len(citas_otros), 1)
    candidatos = []
    for t, c in fb.items():
        if c < 2:
            continue
        rb = c / nb
        ro = fo.get(t, 0) / no
        if rb <= ro:
            continue
        candidatos.append((-rb / (ro + 1e-3), t))
    for _, t in sorted(candidatos):
        if len(claves) >= n:
            break
        if t not in claves:
            claves.append(t)
    return claves[:n]


def puntaje_pagina(texto_norm: str, citas_ref_norm: list[str], claves: list[str]) -> float:
    """Parecido máximo con las citas de referencia más 5 por cada palabra clave presente."""
    mejor = 0.0
    for cita in citas_ref_norm:
        mejor = max(mejor, fuzz.partial_ratio(cita[:_MAX_CITA], texto_norm))
    presentes = sum(1 for c in claves if c in texto_norm)
    return mejor + _PESO_CLAVE * presentes


def paginas_localizadas(
    paginas: dict[int, str | None],
    citas_ref: list[str],
    claves: list[str],
    k: int = 3,
    tope: int = config.MAX_PAGINAS_CONTEXTO,
) -> list[int]:
    """Las k páginas de mayor puntaje más sus vecinas con texto, ordenadas y recortadas a tope."""
    con_texto = {p: texto_busqueda(t) for p, t in paginas.items() if t and t.strip()}
    if not con_texto:
        return []
    refs = [r for r in (texto_busqueda(c) for c in citas_ref) if r]
    puntajes = {p: puntaje_pagina(t, refs, claves) for p, t in con_texto.items()}
    top = sorted(con_texto, key=lambda p: (-puntajes[p], p))[:k]
    elegidas = list(top)
    for p in top:
        for v in (p - 1, p + 1):
            if v in con_texto and v not in elegidas:
                elegidas.append(v)
    return sorted(elegidas[:tope])


def paginas_completas(paginas: dict[int, str | None]) -> list[int]:
    """Todas las páginas con texto, ordenadas."""
    return sorted(p for p, t in paginas.items() if t and t.strip())


ESTRATEGIAS: dict[str, Callable[[dict[int, str | None], list[str], list[str]], list[int]]] = {
    "localizada": lambda paginas, citas_ref, claves: paginas_localizadas(paginas, citas_ref, claves),
    "completa": lambda paginas, citas_ref, claves: paginas_completas(paginas),
}
