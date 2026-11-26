"""Rutas y constantes del motor.

RAIZ es la raíz del repo: motor/src/motor/config.py -> parents[3].
"""

from pathlib import Path

RAIZ: Path = Path(__file__).resolve().parents[3]

FUENTE: Path = RAIZ / "datos/fuente"
INVENTARIO: Path = RAIZ / "datos/inventario"
CORPUS: Path = RAIZ / "datos/corpus"
ORO: Path = RAIZ / "datos/oro"

MATRIZ: Path = RAIZ / "Matriz ICA Distribución Curación_verificacion.xlsx"
DIVIPOLA: Path = RAIZ / "infoEjemplo/DIVIPOLA-_Códigos_municipios_20260726.xlsx"
POSIBLES_BORRADORES: Path = (
    FUENTE / "Acuerdos municipale s/Revisión/Posibles proyectos de acuerdo.xlsx"
)
INFORMES: Path = RAIZ / "docs/informes"
CATALOGO: Path = RAIZ / "motor/catalogo/variables.yaml"

HOJAS_ALCANCE: tuple[str, ...] = (
    "Elementos del tributo",
    "Actividades No Sujetas",
    "Tarifas",
)
HOJA_IDENTIDAD: str = "Principios"

UMBRAL_CITA: float = 90.0
MIN_CHARS_CITA: int = 30
MIN_CHARS_CITA_PAR: int = 120  # largo mínimo de la cita para aceptar coincidencia repartida entre dos folios
