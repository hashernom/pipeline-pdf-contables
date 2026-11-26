"""Constructores de matrices sintéticas con openpyxl para las pruebas."""

from pathlib import Path

import openpyxl

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
