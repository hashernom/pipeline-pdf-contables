# Set de oro: resumen de verificación

Generado por `motor verificar`. Cada campo hereda el resultado de la cita de su bloque, que se verifica una sola vez por documento y bloque.

## Alcance y umbrales

- `UMBRAL_CITA` = 90 (similitud mínima para dar la cita por encontrada).
- `MIN_CHARS_CITA` = 30 (por debajo, la cita es `no_verificable`).
- `MIN_CHARS_CITA_PAR` = 120 (largo mínimo para aceptar una cita repartida entre dos folios consecutivos).
- El OCR queda fuera de alcance: las filas `sin_texto` esperan el piloto de OCR.
- Las citas encontradas repartidas entre dos folios (`entre_paginas`) nunca son `confiable`; van a `revisar`.
- Solo se listan celdas `campo` y `presencia` con dato; las celdas vacías no generan fila.

### Valores de `veredicto`

- `confiable`: la cita pasa en un folio con texto digital, sin ser borrador ni repartida entre folios.
- `revisar`: folio ambiguo o desplazado, texto de capa OCR, posible borrador o cita entre folios.
- `dudosa`: la cita no aparece en el documento, o el folio anotado no existe y no se encontró.
- `sin_texto`: el folio es escaneado y no hay texto que verificar.
- `sin_cita`: la cita está vacía o es demasiado corta para verificarse (valor adicional al plan, para no inflar `dudosa`).
- `sin_documento`: la fila de la matriz no tiene un documento emparejado (`coincide`).

### Valores de `verificacion`

- `verificado`: la cita quedó en `pasa`, `pagina_ambigua` o `pagina_desplazada`.
- `sin_texto`, `no_verificable`: como arriba.
- `no_verificado`: la cita no se encontró (`no_encontrada` o `pagina_invalida`).
- (vacío): fila sin documento.

## Documentos emparejados (`documentos.csv`)

| estado | filas |
|---|---|
| coincide | 386 |
| otro_acuerdo | 62 |
| sin_numero_legible | 5 |
| sin_pdf | 4 |
| varios_acuerdos | 51 |

## Conteos (76646 campos)

### Por veredicto

| valor | campos | % |
|---|---|---|
| confiable | 10305 | 13.4 % |
| dudosa | 8290 | 10.8 % |
| revisar | 8946 | 11.7 % |
| sin_cita | 13168 | 17.2 % |
| sin_documento | 18221 | 23.8 % |
| sin_texto | 17716 | 23.1 % |

### Por verificación

| valor | campos | % |
|---|---|---|
| (vacío) | 18221 | 23.8 % |
| no_verificable | 13168 | 17.2 % |
| no_verificado | 8290 | 10.8 % |
| sin_texto | 17716 | 23.1 % |
| verificado | 19251 | 25.1 % |

## Tasa de `pasa` (citas en el folio anotado)

Campos con documento emparejado; el denominador cuenta campos, no bloques.

### Por hoja

| hoja | campos | pasa | tasa |
|---|---|---|---|
| Actividades No Sujetas | 8099 | 2462 | 30.4 % |
| Elementos del tributo | 32016 | 10511 | 32.8 % |
| Tarifas | 18310 | 3189 | 17.4 % |

### Por hoja, solo citas verificables en folios digitales

Excluye `sin_texto`, `sin_cita` y folios de capa OCR.

| hoja | campos | pasa | tasa |
|---|---|---|---|
| Actividades No Sujetas | 2671 | 1690 | 63.3 % |
| Elementos del tributo | 9094 | 7289 | 80.2 % |
| Tarifas | 4865 | 1995 | 41.0 % |

### Por bloque

| hoja / bloque | campos | pasa | tasa |
|---|---|---|---|
| Actividades No Sujetas / actividades_no_sujetas.actividades_no_sujetas | 7449 | 2352 | 31.6 % |
| Actividades No Sujetas / actividades_no_sujetas.contribuyentes_que_realicen_actividades_no_sujetas_estan_obligados_a | 650 | 110 | 16.9 % |
| Elementos del tributo / elementos_del_tributo.actividades_ocasionales | 383 | 88 | 23.0 % |
| Elementos del tributo / elementos_del_tributo.anticipo | 1128 | 216 | 19.1 % |
| Elementos del tributo / elementos_del_tributo.base_gravable | 1589 | 697 | 43.9 % |
| Elementos del tributo / elementos_del_tributo.base_gravable_especial | 6479 | 1563 | 24.1 % |
| Elementos del tributo / elementos_del_tributo.base_presunta_minima | 2622 | 107 | 4.1 % |
| Elementos del tributo / elementos_del_tributo.causacion_de_los_servicios_publicos_domiciliarios_para_el_ica | 2317 | 680 | 29.3 % |
| Elementos del tributo / elementos_del_tributo.causacion_del_ingreso_para_el_ica | 1928 | 673 | 34.9 % |
| Elementos del tributo / elementos_del_tributo.evidencia_de_la_disminucion_de_la_base_gravable | 384 | 32 | 8.3 % |
| Elementos del tributo / elementos_del_tributo.hecho_generador | 3519 | 1636 | 46.5 % |
| Elementos del tributo / elementos_del_tributo.hecho_imponible | 362 | 61 | 16.9 % |
| Elementos del tributo / elementos_del_tributo.periodo_gravable | 2748 | 1055 | 38.4 % |
| Elementos del tributo / elementos_del_tributo.sujeto_activo | 382 | 143 | 37.4 % |
| Elementos del tributo / elementos_del_tributo.sujeto_pasivos | 8175 | 3560 | 43.5 % |
| Tarifas / tarifas.tarifas_actividades_economicas | 14767 | 3141 | 21.3 % |
| Tarifas / tarifas.tarifas_de_ica_e_commerce | 3543 | 48 | 1.4 % |

## Desfases de folio

### Los 10 más comunes

| desfase | citas |
|---|---|
| 1 | 62 |
| -1 | 35 |
| 35 | 8 |
| 9 | 6 |
| 2 | 5 |
| -9 | 4 |
| 3 | 4 |
| 15 | 4 |
| -2 | 3 |
| 4 | 2 |

### Documentos con desfase constante (3 o más citas con el mismo desfase)

| documento | desfase | citas |
|---|---|---|
| CALDAS (15131_Acuerdo_021_2020_Caldas.pdf) | 35 | 8 |
| Pasca (25535_Acuerdo_011_2020_Pasca.pdf) | 1 | 5 |
| AQUITANIA (15047_Acuerdo_032_2017_Aquitania.pdf) | -1 | 4 |
| Flandes (73275_Acuerdo_041_2007_Flandes.pdf) | 9 | 3 |
| Coello (73200_Acuerdo_019_2016_Coello.pdf) | -9 | 3 |
| Sopetran (05761_Acuerdo_011_2020_Sopetrán.pdf) | 15 | 3 |

## Ejemplos de `dudosa`

- Fila 15, Actividades No Sujetas / actividades_no_sujetas.contribuyentes_que_realicen_actividades_no_sujetas_estan_obligados_a, folio «»: El folio anotado («») no existe en el documento. Cita: «Quienes realicen exclusivamente las actividades no sujetas de que trata el presente articulo, no estarán obligados a presentar declaración privadadelImpuesto deIndustria y Comercio»
- Fila 155, Elementos del tributo / elementos_del_tributo.sujeto_pasivos, folio «14»: La cita no aparece en el documento. Cita: «Son sujetos pasivos del impuesto de industria y comercio las personas naturales o jurídicas, sociedades de hecho, freelance y aquellas en quienes realice el hecho gravado, a través de consorcios, unio»
- Fila 323, Elementos del tributo / elementos_del_tributo.periodo_gravable, folio «24»: La cita no aparece en el documento. Cita: «El período gravable por el cual se causa la obligación tributaria del Impuesto de Industria y Comercio es igual al año calendario inmediatamente anterior a aquel al que se debe presentar la declaració»
- Fila 427, Actividades No Sujetas / actividades_no_sujetas.actividades_no_sujetas, folio «54»: La cita no aparece en el documento. Cita: «ACTIVIDADES QUE NO CAUSAN EL IMPUESTO. No se gravan las siguientes actividades con el impuesto de industria y comercio: 1. Las obligaciones contraídas por el Gobierno en virtud de tratados o convenios»
- Fila 467, Elementos del tributo / elementos_del_tributo.base_gravable_especial, folio «»: El folio anotado («») no existe en el documento. Cita: «NO ESTA EN EL ACUERDO LA DEFINCION»
