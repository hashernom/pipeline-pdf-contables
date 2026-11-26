import openpyxl
import pytest

from motor import config as cfg


def pytest_collection_modifyitems(items):
    """Salta las pruebas `datos` cuando no existe datos/fuente."""
    if cfg.FUENTE.exists():
        return
    skip = pytest.mark.skip(reason=f"no existe {cfg.FUENTE}")
    for item in items:
        if item.get_closest_marker("datos"):
            item.add_marker(skip)


@pytest.fixture(scope="session")
def wb():
    if not cfg.MATRIZ.exists():
        pytest.skip(f"no existe {cfg.MATRIZ}")
    return openpyxl.load_workbook(cfg.MATRIZ, data_only=True)
