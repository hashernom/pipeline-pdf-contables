"""Cliente DeepSeek (API compatible con OpenAI) con caché de respuestas en disco."""
from __future__ import annotations

import hashlib
import json
import math
import os
import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from motor import config

Transporte = Callable[[dict], dict]

_FORMATO = {"type": "json_object"}
_PENSAR = {"thinking": {"type": "disabled"}}


@dataclass
class Uso:
    entrada: int  # solo tokens que fallan la caché
    cache: int
    salida: int
    segundos: float

    def costo_usd(self) -> float:
        p = config.PRECIO_USD_MTOK
        return (self.entrada * p["entrada"] + self.cache * p["cache"]
                + self.salida * p["salida"]) / 1_000_000


@dataclass
class Respuesta:
    texto: str
    finish_reason: str
    uso: Uso
    desde_cache: bool


def estimar_tokens(texto: str) -> int:
    """Estimación conservadora para español."""
    return math.ceil(len(texto) / 3)


def _transporte_real() -> Transporte:
    import openai

    cli = openai.OpenAI(api_key=os.environ["DEEPSEEK_API_KEY"],
                        base_url=config.DEEPSEEK_BASE_URL,
                        timeout=120.0, max_retries=4)

    def enviar(req: dict) -> dict:
        r = cli.chat.completions.create(**req)
        u = r.usage
        extra = getattr(u, "model_extra", None) or {}
        miss = getattr(u, "prompt_cache_miss_tokens", extra.get("prompt_cache_miss_tokens"))
        hit = getattr(u, "prompt_cache_hit_tokens", extra.get("prompt_cache_hit_tokens"))
        if miss is None:
            miss = u.prompt_tokens
        return {"texto": r.choices[0].message.content or "",
                "finish_reason": r.choices[0].finish_reason,
                "uso": {"entrada": miss or 0, "cache": hit or 0,
                        "salida": u.completion_tokens or 0}}

    return enviar


class Cliente:
    def __init__(self, cache_dir: Path, transporte: Transporte | None = None):
        self.cache_dir = Path(cache_dir)
        self._transporte = transporte

    def _enviar(self, req: dict) -> dict:
        if self._transporte is None:
            self._transporte = _transporte_real()
        return self._transporte(req)

    @staticmethod
    def _clave(req: dict) -> str:
        base = {"modelo": req["model"], "mensajes": req["messages"],
                "max_tokens": req["max_tokens"], "temperature": req["temperature"],
                "response_format": req["response_format"],
                "thinking": req["extra_body"]["thinking"]}
        canon = json.dumps(base, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(canon.encode("utf-8")).hexdigest()

    def completar(self, mensajes: list[dict], max_tokens: int = 4000) -> Respuesta:
        req = {"model": config.DEEPSEEK_MODELO, "messages": mensajes,
               "max_tokens": max_tokens, "temperature": 0,
               "response_format": _FORMATO, "extra_body": _PENSAR}
        clave = self._clave(req)
        ruta = self.cache_dir / clave[:2] / f"{clave}.json"
        if ruta.exists():
            d = json.loads(ruta.read_text(encoding="utf-8"))
            return Respuesta(d["texto"], d["finish_reason"],
                             Uso(**d["uso"]), desde_cache=True)
        t0 = time.monotonic()
        d = self._enviar(req)
        u = d["uso"]
        uso = Uso(u["entrada"], u["cache"], u["salida"], time.monotonic() - t0)
        resp = Respuesta(d["texto"], d["finish_reason"], uso, desde_cache=False)
        if resp.finish_reason == "stop":
            ruta.parent.mkdir(parents=True, exist_ok=True)
            tmp = ruta.with_suffix(".tmp")
            tmp.write_text(json.dumps(
                {"texto": resp.texto, "finish_reason": resp.finish_reason,
                 "uso": {"entrada": uso.entrada, "cache": uso.cache,
                         "salida": uso.salida, "segundos": uso.segundos}},
                ensure_ascii=False), encoding="utf-8")
            os.replace(tmp, ruta)
        return resp
