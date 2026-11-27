"""Rutas y constantes del motor.

RAIZ es la raíz del repo: motor/src/motor/config.py -> parents[3].
"""

from pathlib import Path

RAIZ: Path = Path(__file__).resolve().parents[3]

FUENTE: Path = RAIZ / "datos/fuente"
INVENTARIO: Path = RAIZ / "datos/inventario"
CORPUS: Path = RAIZ / "datos/corpus"
ORO: Path = RAIZ / "datos/oro"

MATRIZ: Path = RAIZ / "datos/matriz/Matriz ICA Distribución Curación_verificacion.xlsx"
DIVIPOLA: Path = RAIZ / "referencias/DIVIPOLA-_Códigos_municipios_20260726.xlsx"
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

# Motor de extracción (hito 1)
EXTRACCION: Path = RAIZ / "datos/extraccion"
DEEPSEEK_MODELO: str = "deepseek-flash"
DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"
# USD por millón de tokens; tarifa de hora pico (la más cara) para estimar del lado seguro.
PRECIO_USD_MTOK: dict[str, float] = {"entrada": 0.30, "cache": 0.014, "salida": 1.20}
TOPE_USD_CORRIDA: float = 10.0
N_AJUSTE: int = 30
SEMILLA: int = 20261126
MAX_PAGINAS_CONTEXTO: int = 6
# Bloques cuya tabla ocupa muchas páginas: la estrategia localizada las sigue hacia adelante.
MAX_PAGINAS_CONTEXTO_TABLA: int = 24
BLOQUES_TABLA: tuple[str, ...] = (
    "tarifas.tarifas_actividades_economicas",
    "tarifas.tarifas_de_ica_e_commerce",
)
N_EJEMPLOS: int = 3
CONCURRENCIA: int = 8
