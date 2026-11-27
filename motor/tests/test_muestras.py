import csv

import pytest

from motor import oro
from motor.muestras import (
    Referencia, citas_referencia, ejemplos, escribir_particion, leer_particion,
    particion, referencias,
)


def _fila(sha, hoja="Tarifas", bloque="b1", campo="X", valor="si", veredicto="confiable",
          cita="cita " + "x" * 40, pag="3", pagina_encontrada="3"):
    f = dict.fromkeys(oro.COLUMNAS, "")
    f.update(sha256=sha, hoja=hoja, bloque_key=bloque, campo_key=campo, valor=valor,
             veredicto=veredicto, cita=cita, pag=pag, pagina_encontrada=pagina_encontrada,
             check_cita="pasa")
    return f


def _escribir(path, filas):
    with open(path, "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=oro.COLUMNAS)
        w.writeheader()
        w.writerows(filas)
    return path


@pytest.fixture
def set_csv(tmp_path):
    filas = [_fila(f"sha{i:02d}") for i in range(40)]
    filas.append(_fila("sha_solo_dudosa", veredicto="dudosa"))
    return _escribir(tmp_path / "set_de_oro.csv", filas)


def test_particion_determinista_y_fija(set_csv):
    a = particion(set_csv, n_ajuste=10, semilla=1)
    b = particion(set_csv, n_ajuste=10, semilla=1)
    assert a == b and sum(g == "ajuste" for g in a.values()) == 10 and len(a) == 40


def test_particion_ignora_docs_sin_confiable(set_csv):
    assert "sha_solo_dudosa" not in particion(set_csv, n_ajuste=1)


def test_particion_ida_y_vuelta(set_csv, tmp_path):
    part = particion(set_csv, n_ajuste=5, semilla=2)
    p = escribir_particion(part, tmp_path / "particion.csv")
    assert p.name == "particion.csv" and leer_particion(p) == part


@pytest.fixture
def set_refs(tmp_path):
    filas = [
        _fila("shaA", campo="X", valor="si"), _fila("shaA", campo="X", valor="si"),
        _fila("shaA", campo="Y", valor="si"), _fila("shaA", campo="Y", valor="no"),
        _fila("shaA", campo="Z", valor="a", veredicto="revisar"),
        _fila("shaA", campo="W", valor="a", veredicto="dudosa"),
        _fila("shaB", campo="X", valor="no", pagina_encontrada=""),
    ]
    return _escribir(tmp_path / "s.csv", filas)


def test_referencias_fusiona_iguales_y_excluye_conflictos(set_refs):
    refs, excl = referencias(set_refs)
    assert ("shaA", "Tarifas", "X") in refs and ("shaA", "Tarifas", "Y") not in refs
    assert excl == 1
    assert ("shaA", "Tarifas", "W") not in refs
    assert ("shaA", "Tarifas", "Z") in refs
    r = refs[("shaB", "Tarifas", "X")]
    assert isinstance(r, Referencia) and r.pagina_encontrada is None
    assert refs[("shaA", "Tarifas", "X")].pagina_encontrada == 3


def test_ejemplos_solo_de_ajuste_y_excluye_doc(set_refs):
    refs, _ = referencias(set_refs)
    ej = ejemplos(refs, {"shaA": "ajuste", "shaB": "prueba"}, "b1", excluir=None)
    assert {e.sha256 for e in ej} == {"shaA"}
    assert ej[0].valores == {"X": "si"}
    assert ejemplos(refs, {"shaA": "ajuste"}, "b1", excluir="shaA") == []


def test_ejemplos_n_primeros_por_sha(tmp_path):
    p = _escribir(tmp_path / "s.csv", [_fila(f"sha{i}") for i in (3, 1, 2, 0)])
    refs, _ = referencias(p)
    part = {f"sha{i}": "ajuste" for i in range(4)}
    assert [e.sha256 for e in ejemplos(refs, part, "b1", n=2)] == ["sha0", "sha1"]


def test_citas_referencia_unicas_de_ajuste(tmp_path):
    p = _escribir(tmp_path / "s.csv", [
        _fila("shaA", cita="uno"), _fila("shaA", campo="Q", cita="uno"),
        _fila("shaB", cita="dos"), _fila("shaC", cita="tres"),
    ])
    refs, _ = referencias(p)
    part = {"shaA": "ajuste", "shaB": "ajuste", "shaC": "prueba"}
    assert sorted(citas_referencia(refs, part, "b1")) == ["dos", "uno"]
    assert citas_referencia(refs, part, "b1", excluir="shaA") == ["dos"]
