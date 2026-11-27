from motor import config, localizar
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


def test_puntajes_en_bloque_igual_al_puntaje_por_pagina():
    from motor.localizar import _puntajes, puntaje_pagina

    paginas = {1: "la base gravable se compone de los ingresos ordinarios",
               2: "el periodo gravable es anual y va del primero de enero al treinta y uno de diciembre",
               3: "tarifas por mil para actividades industriales"}
    refs = ["base gravable ingresos ordinarios del periodo", "periodo gravable anual"]
    claves = ["gravable", "tarifas"]
    esperado = {p: puntaje_pagina(t, refs, claves) for p, t in paginas.items()}
    assert _puntajes(paginas, refs, claves) == esperado
    assert _puntajes(paginas, [], claves) == {p: puntaje_pagina(t, [], claves) for p, t in paginas.items()}


def _paginas_tabla():
    p = {i: f"pagina {i} relleno" for i in range(1, 41)}
    p[10] = "ARTICULO 39 tarifas del impuesto de industria y comercio"
    for i in range(11, 40):  # la tabla ocupa de la 11 a la 39
        p[i] = "Codigo 0111 cultivo de cereales 4.5 5.0 6.5 7.0 por mil"
    return p


def test_bloque_de_tabla_extiende_hacia_adelante_hasta_el_tope():
    p = _paginas_tabla()
    refs = ["articulo 39 tarifas del impuesto de industria y comercio"]
    bk = config.BLOQUES_TABLA[0]
    normal = paginas_localizadas(p, refs, [], k=1)
    largo = paginas_localizadas(p, refs, [], k=1, bloque_key=bk)
    assert max(normal) < 15 and set(normal) < set(largo)
    assert len(largo) == config.MAX_PAGINAS_CONTEXTO_TABLA
    assert largo == sorted(largo) and 10 in largo and 39 not in largo


def test_extension_se_detiene_en_pagina_sin_cifras_de_tarifa():
    p = _paginas_tabla()
    p[14] = "texto corrido sin cifras de ningun tipo"
    refs = ["articulo 39 tarifas del impuesto de industria y comercio"]
    res = paginas_localizadas(p, refs, [], k=1, bloque_key=config.BLOQUES_TABLA[0])
    assert 13 in res and 15 not in res


def test_bloque_comun_o_none_no_cambia():
    p = _paginas_tabla()
    refs = ["articulo 39 tarifas del impuesto de industria y comercio"]
    base = paginas_localizadas(p, refs, [], k=1)
    assert paginas_localizadas(p, refs, [], k=1, bloque_key="elementos.otro") == base
    assert paginas_localizadas(p, refs, [], k=1, bloque_key=None) == base
    assert ESTRATEGIAS["localizada"](p, refs, [], config.BLOQUES_TABLA[0]) != ESTRATEGIAS["localizada"](p, refs, [])
    assert ESTRATEGIAS["localizada"](p, refs, []) == ESTRATEGIAS["localizada"](p, refs, [], None)


def test_parece_tabla_tarifas():
    from motor.localizar import parece_tabla_tarifas
    assert parece_tabla_tarifas("a 4.5 b 5.0 c 6.5")
    assert parece_tabla_tarifas("tarifa 7 x mil, 5 por mil y 3 por mil")
    filas = "\n".join(f"{1000 + i} Actividad {i}\n5" for i in range(5))
    assert parece_tabla_tarifas(filas)
    assert not parece_tabla_tarifas("texto corrido del articulo 40 sin cifras")
    assert not parece_tabla_tarifas(None)
