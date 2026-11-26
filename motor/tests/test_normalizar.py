from motor.normalizar import (
    es_vacio,
    nombre_lugar,
    slug,
    texto_busqueda,
    valor_canonico,
)


def test_vacios():
    assert es_vacio(None)
    assert es_vacio("")
    assert es_vacio("\xa0")
    assert es_vacio("   ")
    assert not es_vacio("0")


def test_si_no():
    valores = ["Si", "SI", "si", "sí", "No", "NO", "no"]
    assert [valor_canonico(v) for v in valores] == ["si"] * 4 + ["no"] * 3


def test_no_aplica():
    assert {valor_canonico(v) for v in ["No aplica", "NA", "N/A", "NG", "n/a"]} == {
        "no_aplica"
    }


def test_numero():
    assert valor_canonico("4,5") == "4.5"
    assert valor_canonico(10) == "10"
    assert valor_canonico(4.5) == "4.5"


def test_guion_salto():
    assert texto_busqueda("presu-\npuesto Público") == "presupuesto publico"


def test_lugar():
    assert nombre_lugar("Bogotá D.C") == nombre_lugar("BOGOTÁ, D.C.")
    assert nombre_lugar("Departamento de Boyacá") == "boyaca"


def test_slug():
    assert slug("Tarifa ICA - Año 2024") == "tarifa_ica_ano_2024"
