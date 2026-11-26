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
