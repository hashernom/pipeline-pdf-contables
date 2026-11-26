"""Normalización de texto y valores de celdas."""

import re
import unicodedata

_NO_APLICA = {"no aplica", "na", "n a", "ng"}
_NUMERO = re.compile(r"-?\d+(?:[.,]\d+)?")


def es_vacio(v: object) -> bool:
    """True si la celda es None o texto sin contenido visible."""
    if v is None:
        return True
    return isinstance(v, str) and v.strip() == ""


def texto_busqueda(s: str) -> str:
    """Minúsculas sin tildes; guion+salto de línea unidos; resto no alfanumérico a espacio."""
    s = re.sub(r"-\s*\n", "", s)
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^a-z0-9]+", " ", s.lower())
    return s.strip()


def slug(s: str) -> str:
    """Identificador [a-z0-9_] derivado de texto_busqueda."""
    return re.sub(r"\s+", "_", texto_busqueda(s))


def valor_canonico(v: object) -> str | None:
    """Forma canónica de un valor de celda.

    Devuelve "si", "no", "no_aplica", un número con punto decimal, o el texto
    sin espacios en los bordes. None si la celda está vacía.
    """
    if es_vacio(v):
        return None
    if isinstance(v, bool):
        return "si" if v else "no"
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    if isinstance(v, (int, float)):
        return str(v)
    s = str(v).strip()
    clave = texto_busqueda(s)
    if clave == "si":
        return "si"
    if clave == "no":
        return "no"
    if clave in _NO_APLICA:
        return "no_aplica"
    if _NUMERO.fullmatch(s):
        return s.replace(",", ".")
    return s


def nombre_lugar(s: str) -> str:
    """Nombre de departamento o municipio para comparar: sin prefijos ni sufijos de capital."""
    t = texto_busqueda(s)
    for quitar in ("departamento de", "d c", "distrito capital"):
        t = re.sub(rf"\b{quitar}\b", " ", t)
    return re.sub(r"\s+", " ", t).strip()
