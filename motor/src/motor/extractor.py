"""Extractor de un bloque: pedido al modelo, verificación de la cita y semáforo."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Literal

from pydantic import BaseModel, ConfigDict, ValidationError

from motor import llm
from motor.catalogo import Bloque, Campo
from motor.localizar import ESTRATEGIAS
from motor.muestras import Ejemplo
from motor.normalizar import valor_canonico
from motor.verificacion import verificar_cita, verificar_valor_en_pagina

SIN_RESPUESTA = "El modelo no devolvió una respuesta válida"
SIN_TEXTO = "El documento no tiene páginas con texto"
_SI_NO = ["si", "no", "no_aplica"]
# Estados en que la cita sí se encontró en el documento (con página hallada).
_ENCONTRADA = {"pasa", "pagina_ambigua", "pagina_desplazada"}

SISTEMA = (
    "Eres un analista tributario colombiano que lee acuerdos municipales de impuestos. "
    "Respondes únicamente con lo que dice el texto entregado, sin suponer nada. "
    "La cita debe copiarse LITERAL del texto, sin resumir ni corregir. "
    "Si el bloque no aparece en el texto, responde NO_ENCONTRADO. "
    "Responde solo con un objeto JSON con esta forma exacta: "
    '{"estado": "ENCONTRADO" o "NO_ENCONTRADO", "articulo": "número del artículo", '
    '"pagina": número de la página (el n de === PÁGINA n ===) donde está la cita, '
    '"cita": "texto literal copiado del documento", '
    '"campos": {"clave_del_campo": "valor"}, '
    '"unidades": {"clave_del_campo_numerico": "por_mil" | "porcentaje" | "pesos"}}. '
    "Usa solo las claves de campo que se te listan. Los campos Sí/No valen "
    '"si", "no" o "no_aplica". Cada valor numérico es solo el número, sin el símbolo de unidad, y su unidad va en "unidades". '
    "Si un campo no se puede determinar, déjalo en null."
)


class RespuestaModelo(BaseModel):
    model_config = ConfigDict(coerce_numbers_to_str=True)

    estado: Literal["ENCONTRADO", "NO_ENCONTRADO"]
    articulo: str | None = None
    pagina: int | None = None
    cita: str | None = None
    campos: dict[str, str | None] = {}
    unidades: dict[str, str] = {}


@dataclass
class ResultadoCampo:
    campo_key: str
    rol: str  # "presencia" | "campo"
    valor: str | None
    unidad: str | None
    check_valor: str  # pasa | alerta | falla | no_aplica


@dataclass
class Extraccion:
    sha256: str
    hoja: str
    bloque_key: str
    estado: str
    articulo: str | None
    pagina: int | None
    cita: str | None
    check_cita: str
    detalle_cita: str
    pagina_encontrada: int | None
    semaforo: str
    estrategia: str
    intentos: int
    paginas_contexto: list[int]
    campos: list[ResultadoCampo]
    uso: llm.Uso  # suma de los intentos, tal como se reportó (incluye respuestas de caché)
    uso_real: llm.Uso | None = None  # solo los intentos que fueron a la red (los que cuestan)


def _permitidos(c: Campo) -> list[str] | None:
    if c.valores_permitidos:
        return c.valores_permitidos
    return _SI_NO if c.tipo == "si_no" else None


def _bloque_pregunta(bloque: Bloque, ejemplos: list[Ejemplo]) -> str:
    L = [f"BLOQUE: {bloque.nombre} (hoja {bloque.hoja})"]
    if bloque.presencia_key:
        L.append(f"- {bloque.presencia_key} [si_no, valores: si, no, no_aplica]: "
                 f"presencia del bloque. Criterio: {bloque.criterio_presencia}")
    for c in bloque.campos:
        perm = _permitidos(c)
        t = c.tipo + (f", unidad: {c.unidad}" if c.unidad else "")
        t += f", valores: {', '.join(perm)}" if perm else ""
        L.append(f"- {c.key} [{t}] {c.nombre}. Criterio: {c.criterio}")
    if ejemplos:
        L.append("EJEMPLOS DE OTROS DOCUMENTOS (cita y valores que puso el equipo):")
        for i, e in enumerate(ejemplos, 1):
            L.append(f"Ejemplo {i}: cita: {e.cita!r}; valores: "
                     f"{json.dumps(e.valores, ensure_ascii=False)}")
    L.append("Responde en JSON.")
    return "\n".join(L)


def _paginas_txt(paginas_ctx: dict[int, str]) -> str:
    return "\n\n".join(f"=== PÁGINA {n} ===\n{paginas_ctx[n]}" for n in sorted(paginas_ctx))


def armar_mensajes(bloque: Bloque, paginas_ctx: dict[int, str], ejemplos: list[Ejemplo],
                   estrategia: str) -> list[dict]:
    pregunta = _bloque_pregunta(bloque, ejemplos)
    sistema = {"role": "system", "content": SISTEMA}
    if estrategia == "completa":
        return [sistema,
                {"role": "user", "content": _paginas_txt(paginas_ctx)},
                {"role": "user", "content": pregunta}]
    return [sistema, {"role": "user",
                      "content": f"{pregunta}\n\nTEXTO DEL DOCUMENTO:\n{_paginas_txt(paginas_ctx)}"}]


_SUFIJO_UNIDAD = re.compile(r"\s*(%|‰|por\s+mil|x\s*mil|por\s+ciento)\s*$", re.IGNORECASE)


def a_por_mil(valor: str, unidad: str | None) -> str | None:
    valor = str(valor).strip()
    m = _SUFIJO_UNIDAD.search(valor)
    if m:
        valor = valor[:m.start()].strip()
        if unidad is None or unidad == "":
            unidad = "porcentaje" if m.group(0).strip() == "%" else "por_mil"
    if unidad not in (None, "por_mil", "porcentaje"):
        return None
    v = valor_canonico(valor)
    if v is None:
        return None
    try:
        d = Decimal(v)
    except InvalidOperation:
        return None
    if not d.is_finite():
        return None
    if unidad == "porcentaje":
        d *= 10
    s = format(d, "f")
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return "0" if s in ("", "-0") else s


def _sumar(a: llm.Uso, b: llm.Uso) -> llm.Uso:
    return llm.Uso(a.entrada + b.entrada, a.cache + b.cache, a.salida + b.salida,
                   a.segundos + b.segundos)


def _interpretar(r: llm.Respuesta) -> RespuestaModelo | None:
    if r.finish_reason != "stop" or not r.texto.strip():
        return None
    try:
        return RespuestaModelo.model_validate_json(r.texto)
    except ValidationError:
        return None


def _claves(bloque: Bloque) -> list[tuple[str, str, Campo | None]]:
    cl: list[tuple[str, str, Campo | None]] = []
    if bloque.presencia_key:
        cl.append((bloque.presencia_key, "presencia", None))
    cl += [(c.key, "campo", c) for c in bloque.campos]
    return cl


def _campo(key: str, rol: str, c: Campo | None, resp: RespuestaModelo,
           pag_txt: str | None) -> ResultadoCampo:
    crudo = resp.campos.get(key)
    if crudo is None or not str(crudo).strip():
        return ResultadoCampo(key, rol, None, None, "no_aplica")
    canon = valor_canonico(str(crudo))
    tipo = c.tipo if c else "si_no"
    perm = _permitidos(c) if c else _SI_NO
    unidad_ini = resp.unidades.get(key) or (c.unidad if c else None)
    if perm is not None and canon not in perm:
        return ResultadoCampo(key, rol, None, None, "falla")
    if tipo != "numero":
        return ResultadoCampo(key, rol, canon, None, "pasa" if perm else "no_aplica")
    if canon == "no_aplica":
        return ResultadoCampo(key, rol, canon, None, "no_aplica")
    if a_por_mil(str(crudo), None) is None:  # no es un número
        return ResultadoCampo(key, rol, None, unidad_ini, "falla")
    check = verificar_valor_en_pagina(str(crudo), pag_txt)["resultado"]
    if c is not None and c.unidad == "por_mil":
        pm = a_por_mil(str(crudo), unidad_ini)
        if pm is None:  # pesos u otra unidad no comparable
            return ResultadoCampo(key, rol, None, unidad_ini, "alerta")
        return ResultadoCampo(key, rol, pm, "por_mil", check)
    return ResultadoCampo(key, rol, canon, unidad_ini, check)


def extraer_bloque(bloque: Bloque, paginas: dict[int, str | None], cliente: llm.Cliente,
                   ejemplos: list[Ejemplo], citas_ref: list[str],
                   estrategia: str = "localizada", sha256: str = "") -> Extraccion:
    uso = llm.Uso(0, 0, 0, 0.0)
    uso_real = llm.Uso(0, 0, 0, 0.0)
    claves = _claves(bloque)

    def rojo(detalle: str, check: str, intentos: int, ctx: list[int],
             resp: RespuestaModelo | None = None, enc: int | None = None) -> Extraccion:
        return Extraccion(
            sha256, bloque.hoja, bloque.key, "NO_ENCONTRADO",
            resp.articulo if resp else None, resp.pagina if resp else None,
            resp.cita if resp else None, check, detalle, enc, "rojo", estrategia,
            intentos, ctx,
            [ResultadoCampo(k, rol, None, None, "no_aplica") for k, rol, _ in claves], uso,
            uso_real)

    if not any(t and t.strip() for t in paginas.values()):
        return rojo(SIN_TEXTO, "no_aplica", 0, [])
    nums = ESTRATEGIAS[estrategia](paginas, citas_ref, bloque.palabras_clave, bloque.key)
    ctx = {n: paginas[n] for n in nums if paginas.get(n)}
    mensajes = armar_mensajes(bloque, ctx, ejemplos, estrategia)

    intentos = 0
    resp: RespuestaModelo | None = None
    ver = None
    hallada = False
    while intentos < 2 and not hallada:
        intentos += 1
        r = cliente.completar(mensajes)
        uso = _sumar(uso, r.uso)
        if not r.desde_cache:
            uso_real = _sumar(uso_real, r.uso)
        resp = _interpretar(r)
        if resp is None:
            if intentos == 1:
                mensajes = mensajes + [{"role": "user", "content": (
                    "Tu respuesta no fue un JSON válido o quedó cortada. Responde de nuevo "
                    "con un JSON válido y más corto, solo con la cita necesaria.")}]
                continue
            return rojo(SIN_RESPUESTA, "falla", intentos, nums)
        if resp.estado == "NO_ENCONTRADO":
            return rojo("El modelo no encontró el bloque", "no_aplica", intentos, nums, resp)
        pag = "" if resp.pagina is None else str(resp.pagina)
        ver = verificar_cita(resp.cita, pag, paginas)
        hallada = ver.pagina_encontrada is not None and ver.estado in (
            _ENCONTRADA | {"pagina_invalida"})
        if not hallada and intentos == 1:
            mensajes = mensajes + [
                {"role": "assistant", "content": r.texto},
                {"role": "user", "content": f"La cita no aparece literal en la página {pag or 'indicada'}. "
                                            "Cópiala exactamente del texto o responde NO_ENCONTRADO."}]
    assert resp is not None and ver is not None
    if not hallada:
        return rojo(ver.check["detalle"], ver.check["resultado"], intentos, nums, resp,
                    ver.pagina_encontrada)

    base = ver.pagina_encontrada
    pag_txt = None
    if base is not None and (paginas.get(base) is not None or paginas.get(base + 1) is not None):
        pag_txt = (paginas.get(base) or "") + "\n" + (paginas.get(base + 1) or "")
    campos = [_campo(k, rol, c, resp, pag_txt) for k, rol, c in claves]
    alerta = any(c.check_valor in ("alerta", "falla") for c in campos)
    verde = ver.estado == "pasa" and not ver.entre_paginas and not alerta
    return Extraccion(
        sha256, bloque.hoja, bloque.key, "ENCONTRADO", resp.articulo, resp.pagina, resp.cita,
        ver.check["resultado"], ver.check["detalle"], ver.pagina_encontrada,
        "verde" if verde else "amarillo", estrategia, intentos, nums, campos, uso, uso_real)
