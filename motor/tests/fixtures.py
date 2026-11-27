"""Constructores de matrices sintéticas con openpyxl para las pruebas."""

import csv
import hashlib
from pathlib import Path

import openpyxl
import pymupdf
import pytest

from motor import config, corpus

ID_COLS = ["Código Dane", "Departamento", "Municipio", "Acuerdo", "Año de actualización"]


def hoja_tarifas(wb, nombre="Tarifas", fila_enc=11):
    """Hoja que imita Tarifas: bloque con Mínimo/Máximo por sección CIIU combinada."""
    ws = wb.create_sheet(nombre)
    ws.merge_cells("A1:Z6")
    ws["A1"] = "Banner institucional"
    ws.cell(fila_enc - 2, 2, "Proyecto Código:")
    for i, t in enumerate(ID_COLS):
        ws.cell(fila_enc, 2 + i, t)
    top = fila_enc - 1
    ws.merge_cells(start_row=top, start_column=7, end_row=top, end_column=10)
    ws.cell(top, 7, "Tarifas Actividades Económicas")
    for col, t in zip(range(7, 11), ["Art.", "Pág.", "Definición", "Presencia tarifa"]):
        ws.cell(fila_enc, col, t)
    ws.cell(top, 11, "Mínimo")
    ws.cell(top, 12, "Máximo")
    ws.merge_cells(start_row=fila_enc, start_column=11, end_row=fila_enc, end_column=12)
    ws.cell(fila_enc, 11, "Agricultura")
    # col 13 (M): espaciadora, encabezado vacío
    ws.cell(fila_enc, 14, "Art.")
    ws.cell(top, 14, "Tarifas de ICA e-Commerce")
    ws.merge_cells(start_row=top, start_column=14, end_row=top, end_column=16)
    ws.cell(fila_enc, 15, "¿Cuál?")
    ws.cell(fila_enc, 16, "¿Cuál?")
    return ws


def matriz_sintetica(path: Path, fila_enc: int = 11) -> Path:
    """Matriz con una hoja `Tarifas` (encabezado en `fila_enc`) y una `Territorialidad` (fila 10)."""
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    hoja_tarifas(wb, "Tarifas", fila_enc)
    hoja_tarifas(wb, "Territorialidad", 10)
    wb.save(path)
    return path


def matriz_con_filas(path: Path, limpieza: bool = True) -> Path:
    """Principios + Tarifas (+ copia `Tarifas Limpieza`) con filas reales y ruido."""
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    pr = wb.create_sheet("Principios")
    for i, t in enumerate(ID_COLS):
        pr.cell(11, 2 + i, t)
    filas = [
        (1, 23807, "Córdoba", "Tierralta", "Acuerdo 6", 2023),
        (2, 5001, "Antioquia", "Medellín", "Acuerdo 1", 2022),
        (3, 8001, "Atlántico", "Barranquilla", "Acuerdo 2", 2021),
        (4, 0, "x", "x", "x", None),
        (None, "Total Si", None, None, None, None),
    ]
    for k, f in enumerate(filas):
        for c, v in enumerate(f):
            pr.cell(12 + k, 1 + c, v)
    for nombre in ["Tarifas"] + (["Tarifas Limpieza"] if limpieza else []):
        ws = hoja_tarifas(wb, nombre, 11)
        for k, f in enumerate(filas):
            ws.cell(12 + k, 1, f[0])
            ws.cell(12 + k, 7, "No" if nombre == "Tarifas" else "Si")
            ws.cell(12 + k, 8, "\xa0")
    wb.save(path)
    return path


CITA = "Son sujetos pasivos del impuesto de industria y comercio las personas naturales y juridicas"
INVENTADA = "El municipio exonera de por vida a todas las plataformas digitales del pago anual"


def leer(path):
    with open(path, newline="", encoding="utf-8-sig") as fh:
        return list(csv.DictReader(fh))


@pytest.fixture
def entorno_corpus(tmp_path, monkeypatch):
    pdf = tmp_path / "corpus" / "doc.pdf"
    pdf.parent.mkdir()
    doc = pymupdf.open()
    doc.new_page().insert_text((72, 72), "Portada del acuerdo")
    doc.new_page().insert_text((72, 72), "ARTICULO 39. " + CITA, fontsize=7)
    doc.save(pdf)
    doc.close()
    sha = hashlib.sha256(pdf.read_bytes()).hexdigest()
    with open(tmp_path / "corpus" / "corpus.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["sha256", "archivo_corpus", "archivo_estandar", "digital"])
        w.writerow([sha, "doc.pdf", "05001_Acuerdo_1_2022.pdf", 2])
    (tmp_path / "inv").mkdir()
    with open(tmp_path / "inv" / "paginas.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["sha256", "pagina", "tipo"])
        w.writerows([[sha, 1, "digital"], [sha, 2, "digital"]])
    m = matriz_con_filas(tmp_path / "m.xlsx", limpieza=False)
    wb = openpyxl.load_workbook(m)
    ws = wb["Tarifas"]
    ws["G12"], ws["H12"], ws["I12"], ws["J12"], ws["K12"] = "39", "2", CITA, "Si", "4.5"
    ws["G13"], ws["H13"], ws["I13"], ws["J13"] = "40", "2", INVENTADA, "Si"
    ws["J14"] = "No"
    wb.save(m)
    with open(tmp_path / "documentos.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["fila", "consecutivo", "municipio", "departamento", "dane_original",
                    "dane_final", "acuerdo", "anio", "estado", "sha256", "candidatos",
                    "tipo_doc", "es_modificacion", "posible_borrador"])
        for fila, est in ((12, "coincide"), (13, "coincide"), (14, "sin_documento")):
            w.writerow([fila, fila - 11, "M", "D", "1", "05001", "A", "2022", est,
                        sha if est == "coincide" else "", "", "Acuerdo", "False", "False"])
    monkeypatch.setattr(config, "MATRIZ", m)
    monkeypatch.setattr(config, "CORPUS", tmp_path / "corpus")
    monkeypatch.setattr(config, "INVENTARIO", tmp_path / "inv")
    monkeypatch.setattr(config, "HOJAS_ALCANCE", ("Tarifas",))
    corpus.limpiar_cache()
    yield tmp_path
    corpus.limpiar_cache()
