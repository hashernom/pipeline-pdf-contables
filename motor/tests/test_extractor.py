import json

import pytest

from motor.catalogo import Bloque, Campo
from motor.extractor import RespuestaModelo, a_por_mil, armar_mensajes, extraer_bloque
from motor.llm import Cliente

SP = "elementos_del_tributo.sujeto_pasivos.persona_natural"
bloque_sp = Bloque(
    key="sujeto_pasivos", nombre="Sujeto pasivo", hoja="Elementos",
    columnas={"art": "A", "pag": "B", "cita": "C", "presencia": "D"},
    palabras_clave=["sujetos pasivos"], presencia_key="elementos_del_tributo.sujeto_pasivos.presencia",
    criterio_presencia="si el acuerdo define sujetos pasivos",
    campos=[Campo(key=SP, nombre="Persona natural", columna="E", tipo="si_no",
                  valores_permitidos=["si", "no", "no_aplica"], criterio="si nombra personas naturales")])
bloque_tarifa = Bloque(
    key="tarifas", nombre="Tarifas", hoja="Tarifas",
    columnas={"art": "A", "pag": "B", "cita": "C"}, palabras_clave=[], presencia_key=None,
    campos=[Campo(key="t.comercio", nombre="Comercio", columna="E", tipo="numero",
                  unidad="por_mil", criterio="tarifa de comercio")])

P = {1: "portada",
     2: "ARTICULO 5. Son sujetos pasivos del impuesto de industria y comercio las personas naturales y juridicas",
     3: None}
CITA_OK = "Son sujetos pasivos del impuesto de industria y comercio las personas naturales"


def ok_json(pagina=2, cita=CITA_OK, campos=None, estado="ENCONTRADO", **extra):
    d = {"estado": estado, "articulo": "5", "pagina": pagina, "cita": cita,
         "campos": campos if campos is not None else {SP: "si"}}
    d.update(extra)
    return json.dumps(d)


def cli(tmp_path, texto, repetir=False, finish="stop"):
    llamadas = []

    def t(req):
        llamadas.append(req)
        return {"texto": texto, "finish_reason": finish,
                "uso": {"entrada": 10, "cache": 2, "salida": 5}}
    c = Cliente(tmp_path, transporte=t)
    c.llamadas = llamadas
    return c


def test_cita_real_queda_verde(tmp_path):
    e = extraer_bloque(bloque_sp, P, cli(tmp_path, ok_json()), [], [])
    assert e.estado == "ENCONTRADO" and e.semaforo == "verde" and e.intentos == 1
    assert {c.campo_key: c.valor for c in e.campos}[SP] == "si"
    assert e.uso.salida == 5


def test_cita_inventada_reintenta_y_queda_no_encontrado(tmp_path):
    c = cli(tmp_path, ok_json(cita="El municipio exonera a todas las plataformas digitales del pago"))
    e = extraer_bloque(bloque_sp, P, c, [], [])
    assert e.estado == "NO_ENCONTRADO" and e.semaforo == "rojo" and e.intentos == 2
    assert all(c.valor is None for c in e.campos)
    assert e.uso.salida == 10 and len(c.llamadas) == 2
    assert c.llamadas[1]["messages"][-1]["content"].startswith("La cita no aparece literal en la página 2")
    assert c.llamadas[1]["messages"][-2]["role"] == "assistant"


@pytest.mark.parametrize("texto,finish", [("   ", "stop"), ("no es json", "stop"),
                                            ('{"estado": "ENCON', "length")])
def test_json_invalido_o_cortado_no_revienta(tmp_path, texto, finish):
    e = extraer_bloque(bloque_sp, P, cli(tmp_path, texto, finish=finish), [], [])
    assert e.estado == "NO_ENCONTRADO" and e.semaforo == "rojo"
    assert e.detalle_cita == "El modelo no devolvió una respuesta válida"


def test_pagina_fuera_de_rango(tmp_path):
    e = extraer_bloque(bloque_sp, P, cli(tmp_path, ok_json(pagina=99)), [], [])
    assert e.estado == "ENCONTRADO" and e.semaforo == "amarillo"
    assert e.pagina_encontrada == 2 and e.intentos == 1


def test_pagina_fuera_de_rango_sin_hallazgo(tmp_path):
    e = extraer_bloque(bloque_sp, P, cli(tmp_path, ok_json(pagina=99, cita="texto totalmente ajeno al documento entregado aqui")), [], [])
    assert e.estado == "NO_ENCONTRADO" and e.intentos == 2


def test_clave_desconocida_se_descarta(tmp_path):
    e = extraer_bloque(bloque_sp, P, cli(tmp_path, ok_json(campos={SP: "si", "inventada": "si"})), [], [])
    assert "inventada" not in {c.campo_key for c in e.campos}


def test_valor_fuera_de_permitidos(tmp_path):
    e = extraer_bloque(bloque_sp, P, cli(tmp_path, ok_json(campos={SP: "quizas"})), [], [])
    c = next(c for c in e.campos if c.campo_key == SP)
    assert c.valor is None and c.check_valor == "falla" and e.semaforo == "amarillo"


def test_presencia_es_un_campo_mas(tmp_path):
    pk = bloque_sp.presencia_key
    e = extraer_bloque(bloque_sp, P, cli(tmp_path, ok_json(campos={SP: "si", pk: "Sí"})), [], [])
    c = next(c for c in e.campos if c.campo_key == pk)
    assert c.rol == "presencia" and c.valor == "si"


def test_documento_sin_texto_no_llama(tmp_path):
    def t(req):
        raise AssertionError("no debe llamar")
    e = extraer_bloque(bloque_sp, {1: None, 2: "  "}, Cliente(tmp_path, transporte=t), [], [])
    assert e.estado == "NO_ENCONTRADO" and e.intentos == 0 and e.semaforo == "rojo"


def test_tarifa_porcentaje_a_por_mil():
    assert a_por_mil("0.5", "porcentaje") == "5" and a_por_mil("4,5", "por_mil") == "4.5"
    assert a_por_mil("100000", "pesos") is None and a_por_mil("7", None) == "7"


def test_tarifa_se_verifica_en_pagina_y_siguiente(tmp_path):
    pag = {1: "ARTICULO 9. Tarifas del impuesto de industria y comercio segun la actividad economica", 2: "comercio 0,5 por ciento"}
    cita = "Tarifas del impuesto de industria y comercio segun la actividad economica"
    txt = json.dumps({"estado": "ENCONTRADO", "pagina": 1, "cita": cita, "articulo": "9",
                      "campos": {"t.comercio": "0,5", "otra": "1"}, "unidades": {"t.comercio": "porcentaje"}})
    e = extraer_bloque(bloque_tarifa, pag, cli(tmp_path, txt), [], [])
    c = e.campos[0]
    assert c.valor == "5" and c.check_valor == "pasa" and e.semaforo == "verde"


def test_tarifa_ausente_en_pagina_es_amarillo(tmp_path):
    pag = {1: "ARTICULO 9. Tarifas del impuesto de industria y comercio segun la actividad economica"}
    cita = "Tarifas del impuesto de industria y comercio segun la actividad economica"
    txt = json.dumps({"estado": "ENCONTRADO", "pagina": 1, "cita": cita,
                      "campos": {"t.comercio": "8"}, "unidades": {"t.comercio": "por_mil"}})
    e = extraer_bloque(bloque_tarifa, pag, cli(tmp_path, txt), [], [])
    assert e.campos[0].check_valor == "alerta" and e.semaforo == "amarillo"


def test_completa_pone_paginas_primero():
    m = armar_mensajes(bloque_sp, {2: "x"}, [], "completa")
    assert "=== PÁGINA 2 ===" in m[1]["content"] and bloque_sp.nombre in m[2]["content"]
    assert "JSON" in m[0]["content"]


def test_localizada_un_solo_mensaje_usuario():
    m = armar_mensajes(bloque_sp, {2: "x"}, [], "localizada")
    assert len(m) == 2 and "=== PÁGINA 2 ===" in m[1]["content"] and SP in m[1]["content"]
