from motor import localizar
from motor.localizar import (
    ESTRATEGIAS,
    palabras_clave,
    paginas_completas,
    paginas_localizadas,
    puntaje_pagina,
)


def test_encuentra_la_pagina_con_el_articulo():
    paginas = {
        1: "portada del acuerdo",
        2: "indice",
        3: "ARTICULO 12 SUJETO PASIVO son sujetos pasivos del impuesto las personas naturales",
        4: "tarifas",
        5: None,
    }
    refs = ["son sujetos pasivos del impuesto de industria y comercio las personas naturales"]
    assert 3 in paginas_localizadas(paginas, refs, ["sujeto", "pasivo"], k=1)


def test_agrega_vecinas_y_respeta_tope():
    p10 = {i: f"pagina {i} relleno" for i in range(1, 11)}
    p10[3] = "tarifa especial del impuesto de avisos y tableros"
    p10[8] = "base gravable de la sobretasa bomberil"
    refs = ["tarifa especial del impuesto de avisos y tableros", "base gravable de la sobretasa bomberil"]
    res = paginas_localizadas(p10, refs, [], k=2, tope=6)
    assert res == sorted(res)
    assert len(res) <= 6
    assert {2, 3, 4, 7, 8, 9} == set(res)


def test_tope_prioriza_las_originales():
    p10 = {i: f"pagina {i} relleno" for i in range(1, 11)}
    p10[3] = "tarifa especial del impuesto de avisos y tableros"
    p10[8] = "base gravable de la sobretasa bomberil"
    refs = ["tarifa especial del impuesto de avisos y tableros", "base gravable de la sobretasa bomberil"]
    res = paginas_localizadas(p10, refs, [], k=2, tope=3)
    assert len(res) == 3
    assert 3 in res and 8 in res


def test_sin_texto_devuelve_vacio():
    assert paginas_localizadas({1: None, 2: None}, ["x"], ["y"]) == []


def test_palabras_clave_distintivas():
    bloque = [
        "son sujetos pasivos del impuesto de industria",
        "sujetos pasivos del impuesto de avisos",
        "los sujetos pasivos responden por el impuesto",
    ]
    otros = [
        "la tarifa del impuesto es del uno por ciento",
        "el impuesto se causa en enero",
        "la base del impuesto es el ingreso",
        "el impuesto predial unificado",
    ]
    pc = palabras_clave("Sujeto pasivo", bloque, otros)
    assert "pasivos" in pc and "sujeto" in pc and "pasivo" in pc
    assert "impuesto" not in pc


def test_palabras_clave_descarta_tokens_raros_y_es_determinista():
    pc1 = palabras_clave("Tarifa", ["alfa beta gamma", "unica zeta"], [])
    pc2 = palabras_clave("Tarifa", ["alfa beta gamma", "unica zeta"], [])
    assert pc1 == pc2 == ["tarifa"]


def test_puntaje_sin_citas_solo_claves():
    assert puntaje_pagina("sujeto pasivo aqui", [], ["sujeto", "pasivo", "otro"]) == 10.0


def test_puntaje_con_citas_suma_claves():
    base = puntaje_pagina("texto con sujeto", ["texto con sujeto"], [])
    assert base == 100.0
    assert puntaje_pagina("texto con sujeto", ["texto con sujeto"], ["sujeto"]) == 105.0


def test_completas_y_estrategias():
    paginas = {3: "a", 1: "b", 2: None}
    assert paginas_completas(paginas) == [1, 3]
    assert set(ESTRATEGIAS) == {"localizada", "completa"}
    assert ESTRATEGIAS["completa"](paginas, [], []) == [1, 3]
    assert ESTRATEGIAS["localizada"](paginas, [], []) == [1, 3]
    assert localizar.config.MAX_PAGINAS_CONTEXTO == 6
