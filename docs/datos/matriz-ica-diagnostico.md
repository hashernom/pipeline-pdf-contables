# Diagnóstico de la matriz ICA (26 nov 2026)

Archivo: `Matriz ICA Distribución Curación_verificacion.xlsx` (`datos/matriz/`, ignorado por git, 7 MB). Revisión de solo lectura; no se modificó.

Origen: macroproyecto de investigación del Programa de Contaduría Pública de las Unidades Tecnológicas de Santander (UTS), *"Alcance del concepto de presencia económica significativa en el impuesto de industria y comercio"*, código DIE-PI-001-126.

## Estructura

- **18 hojas.** Son 12 temas + `Principios`, y 5 copias `_Limpieza`.
- **Una fila por municipio y acuerdo.** La identificación (DANE, departamento, municipio, acuerdo, año) solo se escribe en `Principios`; las demás hojas la traen con fórmulas (`=Principios!B75`) que dependen de la posición de la fila.
- **857 columnas de variables** en las 13 hojas principales:

| Tipo de columna | Cantidad |
|---|---|
| Casillas Sí/No | 487 |
| Texto libre ("¿Cuál?", "Mencione…") | 91 |
| Bloques con cita: `Art.` + `Pág.` + `Definición` (texto literal) + `Presencia / Ausencia` | 54 bloques (≈ 217 columnas) |
| Números (tarifas, UVT, SMMLV, plazos) | 53 |
| Calculadas con fórmula (equivalente en pesos con UVT y SMMLV de 2024 fijos) | 9 |

Temas: Principios, Elementos del tributo, Actividades no sujetas, Deducciones y exclusiones, Exenciones e incentivos, Tarifas (por sección CIIU, mín./máx.), Economía digital, Territorialidad, Sector financiero, RST, Régimen preferencial, Avisos y tableros, Sobretasa bomberil.

## Problemas encontrados

**Formato**
- Las filas 1 a 6 son un encabezado institucional, los títulos ocupan 2 o 3 filas con celdas combinadas, y `Territorialidad` empieza una fila antes que las demás.
- Dentro del área de datos hay **filas de totales y promedios** ("Total Si", "Media") y **bloques de firmas** ("Elaboró", "Fecha y hora").
- **140 filas vacías** que solo tienen el consecutivo: la fórmula de identificación devuelve 0. Las filas reales son **508**.
- **Las copias `_Limpieza` son casi idénticas a las originales.** Solo se limpió una fila (Tierralta): 27 celdas cambiadas en Elementos y 1 en otras dos hojas (las demás diferencias de la copia son filas de totales recalculadas). Esas correcciones muestran el tipo de error: casillas Sí↔No invertidas y citas incompletas.

**Identificación**
- **DANE:** 426 de 508 son válidos. 80 se pueden corregir con nombre y departamento: códigos sin prefijo de departamento (`209` → `68209`) y códigos de otro municipio (Santiago de Tolú con 70823 = Toluviejo; Buenavista con 63130 = Calarcá). Quedan 2 sin resolver (Bogotá D.C., "Guacamayo").
- **Nombres:** con errores de escritura ("Buritaca", "Quinbaya", "CURABA") y el departamento escrito de dos formas ("Departamento de Boyacá" / "Boyaca").
- **Columna "Acuerdo":** texto libre. Aparece como "Acuerdo No 008", "022 de 29 Diciembre de 2018" o "015 DE 2023", y en **51 filas** hay varios acuerdos en la misma celda. El año va aparte en la columna F, y una fila tiene "2020 - 2021".

**Valores**
- Sí/No escrito de 6 formas: `No` 148 k, `Si` 71 k, `no` 20 k, `si` 7 k, `SI` 5 k, `NO` 3 k. "No aplica" aparece de varias maneras: `No aplica`, `NA`, `N/A`, `NG`, `0`.
- **Tarifas:** la unidad no está declarada (se infiere por mil). `0` se usa como "no aplica" (3.139 veces), hay valores fuera de rango (40, 57, 100) y **11 casos con mínimo mayor que máximo**.
- `Art.` y `Pág.`: el 16 % tiene varios valores, separados con `-`, que se usa tanto para listas como para rangos ("2-238", "3-196-284", "1.89").
- Las equivalencias en pesos usan la UVT de 2024 (47.065) y el SMMLV de 2024 para acuerdos de cualquier año.

## Lo bueno: sirve como set de oro

- **El 85 % de las filas (430 de 508) corresponde a un PDF que tenemos.** El cruce se hizo con DANE corregido + número + año del acuerdo. Otras 66 citan un acuerdo distinto al PDF disponible, y 5 municipios no tienen PDF.
- **499 de los 509 municipios con PDF están en la matriz.**
- **Las citas son en su mayoría reales.** En PDFs digitales se buscaron 1.684 citas (`Definición` ≥ 80 caracteres) en el texto del PDF:
  - **77 %** aparece literal en la página anotada.
  - 8 % aparece en otra página, casi siempre ±1, o con un desfase fijo entre la página impresa y la del PDF.
  - 16 % no aparece literal: paráfrasis, errores de digitación, cita recortada o un acuerdo distinto.

## Implicaciones para el pipeline

1. **La unidad natural de extracción es el bloque, no la columna.** Cada uno de los 54 bloques es un artículo con cita y página. Las 487 casillas Sí/No se responden **a partir de esa cita**. Eso encaja con el principio de la ficha: ningún dato sin cita y folio.
2. **857 columnas no son las "30-40 variables" de la ficha.** Hay que definir el alcance de la primera versión.
3. **La matriz se puede verificar con el propio pipeline**: cita en la página, valor que sale de la cita. Con eso se separa la parte confiable del set de oro de la que hay que revisar.
4. **Antes de usarla hay que normalizarla** a formato largo: `municipio, acuerdo, bloque, campo, valor, art, pag, cita`. Eso implica valores Sí/No/No aplica canónicos, DANE corregido y sin filas de totales, firmas ni vacías.
