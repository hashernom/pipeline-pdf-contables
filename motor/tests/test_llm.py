import os

import pytest

from motor.llm import Cliente, Uso, estimar_tokens

MSG = [{"role": "user", "content": "x JSON"}]


def _t(llamadas, finish="stop"):
    def t(req):
        llamadas.append(req)
        return {"texto": '{"a":1}', "finish_reason": finish,
                "uso": {"entrada": 10, "cache": 0, "salida": 5}}
    return t


def test_segunda_llamada_sale_de_cache(tmp_path):
    llamadas = []
    c = Cliente(tmp_path, transporte=_t(llamadas))
    r1 = c.completar(MSG)
    r2 = c.completar(MSG)
    assert len(llamadas) == 1 and not r1.desde_cache and r2.desde_cache
    assert r2.texto == '{"a":1}' and r2.uso.entrada == 10


def test_respuesta_cortada_no_se_guarda(tmp_path):
    llamadas = []
    c = Cliente(tmp_path, transporte=_t(llamadas, "length"))
    c.completar(MSG)
    c.completar(MSG)
    assert len(llamadas) == 2


def test_pedido_lleva_parametros_fijos(tmp_path):
    llamadas = []
    Cliente(tmp_path, transporte=_t(llamadas)).completar(MSG)
    req = llamadas[0]
    assert req["model"] == "deepseek-flash" and req["temperature"] == 0
    assert req["response_format"] == {"type": "json_object"}
    assert req["extra_body"] == {"thinking": {"type": "disabled"}}


def test_costo():
    assert Uso(1_000_000, 0, 0, 0).costo_usd() == pytest.approx(0.30)
    assert Uso(0, 1_000_000, 1_000_000, 0).costo_usd() == pytest.approx(1.214)


def test_estimar_tokens():
    assert estimar_tokens("abcd") == 2 and estimar_tokens("") == 0


@pytest.mark.datos
@pytest.mark.skipif("DEEPSEEK_API_KEY" not in os.environ, reason="falta DEEPSEEK_API_KEY")
def test_deepseek_responde(tmp_path):
    r = Cliente(tmp_path).completar(
        [{"role": "user", "content": 'Responde en JSON: {"ok": true}'}], max_tokens=50)
    assert r.uso.salida > 0 and r.texto.strip().startswith("{")
