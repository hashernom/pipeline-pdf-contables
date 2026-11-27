"""Evaluación de las extracciones contra el set de oro (spec §2, §6.7 y §6.8)."""

import csv
import re
from dataclasses import dataclass, field
from pathlib import Path

from rapidfuzz import fuzz

from motor import config
from motor.catalogo import Catalogo, cargar_yaml
from motor.muestras import Referencia, referencias
from motor.normalizar import texto_busqueda, valor_canonico

TOLERANCIA = 1e-6
UMBRAL_TEXTO_LIBRE = 90.0
MAX_DESACUERDOS = 5
_PAGINA = re.compile(r"\d+(?:\.0+)?")


@dataclass
class Metricas:
    bloques_ref: int = 0
    bloques_encontrados: int = 0
    # de los bloques de referencia confiables, cuántos dejó ENCONTRADO el motor (cobertura)
    bloques_ref_encontrados: int = 0
    citas_verdes: int = 0
    citas_amarillas: int = 0
    citas_rojas: int = 0
    pagina_correcta: int = 0
    pagina_comparable: int = 0
    valores_ok: int = 0
    valores_comparables: int = 0
    texto_libre_ok: int = 0
    texto_libre_comparables: int = 0
    # señal secundaria: referencias `revisar`, que no entran al acierto
    revisar_ok: int = 0
    revisar_comparables: int = 0
    hallazgos_sin_referencia: int = 0
    claves_excluidas: int = 0
    # (sha256, bloque_key, campo_key, esperado, extraído, cita); solo en "total"
    desacuerdos: list[tuple[str, str, str, str, str, str]] = field(default_factory=list)

    @staticmethod
    def _razon(a: int, b: int) -> float | None:
        return a / b if b else None

    @property
    def citas_reales(self) -> float | None:
        return self._razon(self.citas_verdes + self.citas_amarillas, self.bloques_encontrados)

    @property
    def citas_verdes_tasa(self) -> float | None:
        return self._razon(self.citas_verdes, self.bloques_encontrados)

    @property
    def cobertura(self) -> float | None:
        """Bloques de referencia que el motor encontró; los hallazgos sin referencia no suman."""
        return self._razon(self.bloques_ref_encontrados, self.bloques_ref)

    @property
    def acierto(self) -> float | None:
        return self._razon(self.valores_ok, self.valores_comparables)


def _leer(path: Path) -> list[dict]:
    with open(path, newline="", encoding="utf-8-sig") as fh:
        return list(csv.DictReader(fh))


def _entero(texto: str | None) -> int | None:
    t = (texto or "").strip()
    return int(float(t)) if _PAGINA.fullmatch(t) else None


def _pagina_ref(refs: list[Referencia]) -> int | None:
    """Página única de la referencia: la del verificador o, si falta, `pag`."""
    for r in refs:
        if r.pagina_encontrada is not None:
            return r.pagina_encontrada
        p = _entero(r.pag)
        if p is not None:
            return p
    return None


def _a_float(v: str | None) -> float | None:
    try:
        return float(v)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def _cero_es_no_aplica(v: str | None) -> str | None:
    n = _a_float(v)
    return "no_aplica" if n is not None and n == 0 else v


def _igual(tipo: str, esperado: str, extraido: str) -> bool:
    ref = valor_canonico(esperado)
    mot = valor_canonico(extraido)
    if tipo == "texto_libre":
        a, b = texto_busqueda(ref or ""), texto_busqueda(mot or "")
        return bool(a and b) and fuzz.partial_ratio(a, b) >= UMBRAL_TEXTO_LIBRE
    ref, mot = _cero_es_no_aplica(ref), _cero_es_no_aplica(mot)
    if tipo == "numero":
        a, b = _a_float(ref), _a_float(mot)
        if a is not None and b is not None:
            return abs(a - b) <= TOLERANCIA
    return ref == mot


def evaluar(extracciones_csv: Path, set_csv: Path, solo_grupo: str | None,
            cat: Catalogo | None = None) -> dict[str, Metricas]:
    """Métricas "total", "hoja:<h>", "bloque:<b>" y "campo:<c>" de un CSV de extracción."""
    cat = cat or cargar_yaml(config.CATALOGO)
    tipos = {c.key: c.tipo for b in cat.bloques for c in b.campos}
    refs, excluidas = referencias(set_csv)
    refs_bloque: dict[tuple[str, str, str], list[Referencia]] = {}
    for clave in sorted(refs):
        r = refs[clave]
        refs_bloque.setdefault((r.sha256, r.hoja, r.bloque_key), []).append(r)

    bloques: dict[tuple[str, str, str], list[dict]] = {}
    for f in _leer(extracciones_csv):
        if solo_grupo is None or f["grupo"] == solo_grupo:
            bloques.setdefault((f["sha256"], f["hoja"], f["bloque_key"]), []).append(f)

    res: dict[str, Metricas] = {"total": Metricas(claves_excluidas=excluidas)}

    def acum(*claves: str) -> list[Metricas]:
        return [res.setdefault(k, Metricas()) for k in claves]

    for (sha, hoja, bloque) in sorted(bloques):
        filas = sorted(bloques[(sha, hoja, bloque)], key=lambda f: f["campo_key"])
        encontrado = filas[0]["estado"] == "ENCONTRADO"
        brs = refs_bloque.get((sha, hoja, bloque), [])
        conf = [r for r in brs if r.veredicto == "confiable"]
        nivel = acum("total", f"hoja:{hoja}", f"bloque:{bloque}")
        if conf:
            for m in nivel:
                m.bloques_ref += 1
                m.bloques_ref_encontrados += encontrado
        if encontrado:
            semaforo = filas[0]["semaforo"]
            pag_motor = (_entero(filas[0]["pagina_encontrada"])
                         if _entero(filas[0]["pagina_encontrada"]) is not None
                         else _entero(filas[0]["pagina"]))
            pag_ref = _pagina_ref(conf)
            for m in nivel:
                m.bloques_encontrados += 1
                if semaforo == "verde":
                    m.citas_verdes += 1
                elif semaforo == "amarillo":
                    m.citas_amarillas += 1
                else:
                    m.citas_rojas += 1
                if not brs:
                    m.hallazgos_sin_referencia += 1
                if pag_ref is not None and pag_motor is not None:
                    m.pagina_comparable += 1
                    m.pagina_correcta += abs(pag_motor - pag_ref) <= 1
        for f in filas:
            ref = refs.get((sha, hoja, f["campo_key"]))
            if ref is None or ref.veredicto not in ("confiable", "revisar"):
                continue
            tipo = tipos.get(f["campo_key"], "si_no")
            # §6.8.3: un bloque de presencia que el motor no encontró cuenta como "no"
            extraido = "no" if f["rol"] == "presencia" and not encontrado else f["valor"]
            ok = _igual(tipo, ref.valor, extraido)
            for m in nivel + acum(f"campo:{f['campo_key']}"):
                if ref.veredicto == "revisar":
                    m.revisar_comparables += 1
                    m.revisar_ok += ok
                elif tipo == "texto_libre":
                    m.texto_libre_comparables += 1
                    m.texto_libre_ok += ok
                else:
                    m.valores_comparables += 1
                    m.valores_ok += ok
            total = res["total"]
            if (not ok and ref.veredicto == "confiable"
                    and len(total.desacuerdos) < MAX_DESACUERDOS):
                total.desacuerdos.append((sha, f["bloque_key"], f["campo_key"], ref.valor,
                                          extraido, f["cita"]))
    return res


def _clave_orden(m: Metricas) -> tuple[float, float]:
    return (m.citas_reales if m.citas_reales is not None else -1.0,
            m.acierto if m.acierto is not None else -1.0)


def comparar_estrategias(a: dict[str, Metricas], b: dict[str, Metricas]) -> str:
    """`a` es `localizada` y `b` es `completa`. Gana la de mejores citas reales y,
    a igualdad, la de mejor acierto; si empatan, `localizada`."""
    return "completa" if _clave_orden(b["total"]) > _clave_orden(a["total"]) else "localizada"
