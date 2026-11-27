"""Localización de las páginas de un documento relevantes para un bloque."""

import re
from collections import Counter
from collections.abc import Callable

from rapidfuzz import fuzz, process

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


def _puntajes(con_texto: dict[int, str], refs: list[str], claves: list[str]) -> dict[int, float]:
    """Mismo puntaje que `puntaje_pagina`, calculado en bloque y en paralelo (en C++, sin GIL)."""
    if not refs:
        return {p: puntaje_pagina(t, refs, claves) for p, t in con_texto.items()}
    nums = list(con_texto)
    m = process.cdist([r[:_MAX_CITA] for r in refs], [con_texto[p] for p in nums],
                      scorer=fuzz.partial_ratio, dtype="float64", workers=-1)
    return {p: float(m[:, i].max()) + _PESO_CLAVE * sum(1 for c in claves if c in con_texto[p])
            for i, p in enumerate(nums)}


_DECIMALES = re.compile(r"\d+[.,]\d+")
_MARCAS_TARIFA = re.compile(r"(?i)por\s*mil|\bx\s*mil|\d\s*x\s*1\.?000|%|‰")
_LINEA_CODIGO = re.compile(r"(?m)^\s*\d{3,4}\s+\S")
MIN_DECIMALES_TARIFA = 3
MIN_MARCAS_TARIFA = 3
MIN_LINEAS_CODIGO = 4


def parece_tabla_tarifas(texto: str | None) -> bool:
    """Página con cifras de tarifa: decimales, marcas "x mil"/"%" o filas "código descripción"."""
    if not texto or not texto.strip():
        return False
    return (len(_DECIMALES.findall(texto)) >= MIN_DECIMALES_TARIFA
            or len(_MARCAS_TARIFA.findall(texto)) >= MIN_MARCAS_TARIFA
            or len(_LINEA_CODIGO.findall(texto)) >= MIN_LINEAS_CODIGO)


def paginas_localizadas(
    paginas: dict[int, str | None],
    citas_ref: list[str],
    claves: list[str],
    k: int = 3,
    tope: int = config.MAX_PAGINAS_CONTEXTO,
    bloque_key: str | None = None,
) -> list[int]:
    """Las k páginas de mayor puntaje más sus vecinas con texto, ordenadas y recortadas a tope.

    En los bloques de tabla larga (`config.BLOQUES_TABLA`) sigue además hacia adelante las
    páginas contiguas que parecen tabla de tarifas, hasta `MAX_PAGINAS_CONTEXTO_TABLA`.
    """
    con_texto = {p: texto_busqueda(t) for p, t in paginas.items() if t and t.strip()}
    if not con_texto:
        return []
    refs = [r for r in (texto_busqueda(c) for c in citas_ref) if r]
    puntajes = _puntajes(con_texto, refs, claves)
    top = sorted(con_texto, key=lambda p: (-puntajes[p], p))[:k]
    elegidas = list(top)
    for p in top:
        for v in (p - 1, p + 1):
            if v in con_texto and v not in elegidas:
                elegidas.append(v)
    elegidas = elegidas[:tope]
    if bloque_key in config.BLOQUES_TABLA:
        for p in top:
            q = p
            while (len(elegidas) < config.MAX_PAGINAS_CONTEXTO_TABLA
                   and parece_tabla_tarifas(paginas.get(q + 1))):
                q += 1
                if q not in elegidas:
                    elegidas.append(q)
    return sorted(elegidas)


def paginas_completas(paginas: dict[int, str | None]) -> list[int]:
    """Todas las páginas con texto, ordenadas."""
    return sorted(p for p, t in paginas.items() if t and t.strip())


ESTRATEGIAS: dict[str, Callable[..., list[int]]] = {
    "localizada": lambda paginas, citas_ref, claves, bloque_key=None: paginas_localizadas(
        paginas, citas_ref, claves, bloque_key=bloque_key),
    "completa": lambda paginas, citas_ref, claves, bloque_key=None: paginas_completas(paginas),
}
