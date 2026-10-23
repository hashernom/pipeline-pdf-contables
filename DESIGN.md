---
name: Folio
description: Extracción verificable de estados financieros municipales; cada cifra con su cita y su folio.
colors:
  rail: "#1f3d36"
  rail-activo: "#2a5047"
  rail-tinta: "#e6efeb"
  rail-apagado: "#a9c2b9"
  papel: "#f3f5f2"
  hoja: "#ffffff"
  panel: "#e9ede9"
  linea: "#d6ddd8"
  linea-fuerte: "#a9b5ae"
  tinta: "#18211e"
  tinta-2: "#46524d"
  tinta-3: "#5c6863"
  verde: "#23704a"
  verde-fondo: "#e2f0e7"
  verde-linea: "#9fcbb1"
  ambar: "#865800"
  ambar-fondo: "#fbefd3"
  ambar-linea: "#e6c06a"
  ambar-marca: "#d8981a"
  rojo: "#a8322a"
  rojo-fondo: "#f9e3e0"
  rojo-linea: "#e3a49e"
  sello: "#5a4a9c"
  sello-tinta: "#43367a"
  sello-fondo: "#ebe8f5"
  sello-linea: "#b7aedb"
typography:
  display:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.125rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: 1.45
  body:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "\"lnum\""
  cifra:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "-0.005em"
    fontFeature: "\"tnum\", \"lnum\""
  label:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1rem
rounded:
  cita: "2px"
  sm: "3px"
  md: "5px"
  full: "9999px"
spacing:
  fila: "8px"
  panel: "16px"
  pagina: "24px"
  pagina-amplia: "32px"
components:
  boton-primario:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.rail-tinta}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "34px"
  boton-primario-hover:
    backgroundColor: "{colors.rail-activo}"
  boton-secundario:
    backgroundColor: "{colors.hoja}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "34px"
  boton-secundario-hover:
    backgroundColor: "{colors.papel}"
  boton-fantasma:
    textColor: "{colors.tinta-2}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "34px"
  boton-fantasma-hover:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.tinta}"
  boton-peligro:
    backgroundColor: "{colors.hoja}"
    textColor: "{colors.rojo}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "34px"
  boton-peligro-hover:
    backgroundColor: "{colors.rojo-fondo}"
  boton-sm:
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "28px"
  llamada-folio:
    textColor: "{colors.sello}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 4px"
    width: "44px"
  llamada-folio-activa:
    backgroundColor: "{colors.sello}"
    textColor: "{colors.hoja}"
  cita-literal:
    backgroundColor: "{colors.sello-fondo}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
  marca-semaforo-rojo:
    backgroundColor: "{colors.rojo-fondo}"
    textColor: "{colors.rojo}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  marca-semaforo-amarillo:
    backgroundColor: "{colors.ambar-fondo}"
    textColor: "{colors.ambar}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  marca-semaforo-verde:
    backgroundColor: "{colors.verde-fondo}"
    textColor: "{colors.verde}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  hoja:
    backgroundColor: "{colors.hoja}"
    rounded: "{rounded.md}"
  riel:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.rail-apagado}"
    width: "84px"
  riel-item-activo:
    backgroundColor: "{colors.rail-activo}"
    textColor: "{colors.hoja}"
    rounded: "{rounded.md}"
---

# Design System: Folio

## Overview

**Creative North Star: "El estado financiero publicado"**

Cada cifra se lee como en un estado financiero impreso y auditado: alineada a la derecha en cifras tabulares, con su nota y su folio de origen al lado. La interfaz es una herramienta de trabajo de escritorio para sesiones largas: densa pero no apretada, tipográfica antes que cromática, con un único riel verde botella como cuerpo comprometido de la aplicación y todo lo demás en papel frío y tinta verdosa casi negra.

El color no decora: el verde, el ámbar y el rojo son el semáforo de verificación y siempre viajan con glifo y palabra; el violeta de sello es la tinta de la evidencia y solo aparece donde hay una cita, un folio o el foco. La jerarquía la dan el peso, las reglas contables (regla simple sobre la diferencia, doble regla bajo el total) y el orden de atención rojo > amarillo > verde, no tarjetas, insignias de colores sueltos ni métricas gigantes.

La firma del sistema es la llamada de folio: la marca «f. N» que vive en cada fila de variable, salta al folio del PDF y aparece en el margen de la página mientras un marco violeta entra sobre la cita literal como una pasada de lápiz.

**Key Characteristics:**
- Una sola familia (Libre Franklin) para todo; cifras tabulares y alineadas a la derecha.
- Riel verde botella de 84px como shell; lienzo papel frío; superficies blancas planas con borde fino.
- Semáforo verde / ámbar / rojo siempre con glifo + palabra, ordenado por atención.
- Violeta de sello reservado para cita, folio, foco, selección y estado «corregido».
- Reglas contables (simple y doble) como recurso de jerarquía para totales y diferencias.
- Plano por defecto; la sombra existe solo en la página del PDF y en lo que flota.

## Colors

Papel frío y tinta verdosa con un riel verde botella; tres tonos de semáforo con fondo y línea propios, y un violeta de sello para la evidencia.

### Primary
- **Verde botella del riel** (rail): el shell lateral, el panel de entrada y el fondo del botón primario. Es el único bloque de color sólido grande de la aplicación.
- **Verde botella activo** (rail-activo): ítem activo del riel, hover del botón primario, avatar de usuario.
- **Tinta del riel** (rail-tinta) y **Riel apagado** (rail-apagado): texto del riel activo/hover y de los destinos inactivos.

### Secondary
- **Violeta de sello** (sello): la llamada «f. N», el marco de la cita en el PDF, el folio activo en la tira de localizados, el anillo de foco, el cursor de texto y el valor seleccionado en la prueba contable.
- **Tinta de sello** (sello-tinta): texto sobre fondos de sello (pie de la cita, valor corregido, selección de texto).
- **Fondo de sello** (sello-fondo) y **Línea de sello** (sello-linea): caja de la cita literal, hover de las llamadas, selección de texto, aviso de auditoría.

### Tertiary (semáforo)
- **Verde verificado** (verde) con verde-fondo y verde-linea: pasa todo; «Cuadra» en la prueba contable; confirmado.
- **Ámbar de alerta** (ambar) con ambar-fondo, ambar-linea y ambar-marca: pasa con alertas, revisión obligatoria. El ámbar de texto es oscuro para que el texto pequeño sea legible; ambar-marca es el tono saturado para trazos y barras.
- **Rojo de falla** (rojo) con rojo-fondo y rojo-linea: falla o NO_ENCONTRADO, diferencias que no cuadran, errores del pipeline, acción de peligro.

### Neutral
- **Papel frío** (papel): fondo del lienzo, filas ya decididas, la franja de la prueba contable.
- **Hoja** (hoja): superficies de tablas, listas y formularios; la página del PDF.
- **Panel** (panel): barras del visor, pistas de progreso, hover de botones fantasma.
- **Línea** (linea) y **Línea fuerte** (linea-fuerte): divisores entre filas y bordes de hoja; bordes de controles, barra de scroll, tecla.
- **Tinta** (tinta), **Tinta 2** (tinta-2), **Tinta 3** (tinta-3): texto principal y cifras; texto secundario y descripciones; encabezados de tabla, metadatos, conteos.

### Named Rules
**The Sello Rule.** El violeta solo marca evidencia y foco: cita, folio, marco, selección, foco de teclado y lo que el usuario corrigió. Nunca un botón genérico, un enlace de navegación o un adorno.

**The Glifo y Palabra Rule.** Un color de semáforo nunca aparece solo: lo acompañan su glifo (visto, triángulo, octágono o círculo tachado) y su nombre. Los conteos se ordenan rojo · amarillo · verde y los ceros se atenúan al 35 %, no se ocultan.

## Typography

**Display Font:** Libre Franklin (con ui-sans-serif, system-ui)
**Body Font:** Libre Franklin
**Label/Mono Font:** Libre Franklin con `tnum` y `lnum` para cifras

**Character:** Una grotesca de tradición periodística, firme en negrita y neutra en regular, que sostiene sola tanto el titular como la columna de cifras. La base del documento es 0.875rem con 1.45 de interlineado y cifras de altura de mayúscula en todo el cuerpo.

### Hierarchy
- **Display** (700, 2.125rem, 1.1): solo el titular del panel de entrada, sobre el riel.
- **Headline** (700, 1.375rem, -0.01em): título de cada página de trabajo, sobre una línea inferior.
- **Title** (700, 0.9375rem): títulos de sección encima de cada hoja, con una nota opcional a la derecha en tinta-3.
- **Body** (400, 0.8125rem, 1.45): filas, celdas, descripciones (máx. 60-70ch). Los nombres de variable activos pasan a 600.
- **Cifra** (600, tabular y de altura de mayúscula, -0.005em): todo número que se compara o suma; alineado a la derecha.
- **Label** (600, 0.6875rem, 1rem): encabezados de tabla, encabezados de grupo con su conteo, llamadas «f. N», marcas de semáforo, pies de cita. Siempre en tipo oración.

### Named Rules
**The Columna Rule.** Toda cifra comparable lleva la clase de cifra tabular y se alinea a la derecha, en tablas, filas de variables y pruebas contables por igual.

**The Sin Versalitas Rule.** Encabezados y rótulos van en tipo oración, 0.6875rem semibold; el sistema no usa mayúsculas sostenidas con tracking.

## Layout

Escritorio solamente. Un riel fijo de 84px a la izquierda (destino = icono de 18px + palabra de 0.6875rem debajo) y el área de trabajo a la derecha. Las páginas de coordinación usan un contenedor centrado de 1240px (1560px en la variante amplia) con 24px de margen (32px en pantallas grandes); el encabezado de página cierra con una línea y las secciones se separan con su título encima de la hoja.

La revisión es un espacio de dos paneles a altura completa: barra de documento arriba, visor PDF a la izquierda sobre un escritorio gris verdoso con la página centrada a 24px, panel de variables a la derecha agrupado por semáforo, y la prueba contable anclada abajo en papel. La densidad la marcan filas de 8px de relleno vertical con divisores de línea, paneles con 16px de relleno lateral y una retícula de 4px.

## Elevation & Depth

Plano por defecto. La profundidad se expresa con tono (papel bajo hoja, panel bajo papel) y con bordes finos de línea. Solo dos sombras con nombre: la página del PDF, que debe leerse como papel físico sobre el escritorio, y lo que flota sobre el contenido (diálogos, avisos, el aviso del modo de marcado).

### Shadow Vocabulary
- **Hoja de papel** (`0 1px 2px rgb(24 33 30 / 0.08), 0 4px 16px -8px rgb(24 33 30 / 0.16)`): la página del PDF en el visor.
- **Emergente** (`0 6px 24px -6px rgb(24 33 30 / 0.22), 0 1px 3px rgb(24 33 30 / 0.12)`): diálogos, panel de atajos, aviso flotante del modo de marcado.

### Named Rules
**The Flat Sheet Rule.** Hojas, filas y tablas no proyectan sombra; se separan por borde de línea y por tono. Una hoja nunca se anida dentro de otra.

## Shapes

Esquinas casi rectas, de documento: 5px para botones, hojas, campos e ítems del riel; 3px para marcas, llamadas de folio y la tecla; 2px para el marco de la cita y el anillo de foco. Lo redondo completo se reserva para barras de avance de 4px, avatares, el punto de «pendiente» y el pulgar de la barra de scroll. Los totales se cierran con reglas: una regla simple de 1px en tinta sobre la diferencia y una doble regla de 3px bajo el total.

## Components

### Buttons
Sobrios y tipográficos: texto semibold, icono de 14px a la izquierda y, cuando hay atajo, la tecla al final.
- **Shape:** esquinas suaves (5px); 34px de alto en md, 28px en sm.
- **Primario:** fondo verde botella del riel, texto tinta del riel, borde del mismo verde. Una sola acción primaria por fila o página (Confirmar, Asignar).
- **Hover / Focus:** transición de color de 150ms; hover a verde activo; el foco es un anillo violeta de 2px separado 2px. Deshabilitado al 45 % de opacidad.
- **Secundario:** hoja blanca con borde de línea fuerte; hover a papel con borde tinta-3.
- **Fantasma:** sin fondo, tinta-2; hover a panel.
- **Peligro:** hoja blanca, texto y borde rojos; hover a fondo rojo.

### Tecla (Kbd)
Tecla de 18px, 0.625rem semibold, esquina de 3px, borde de línea fuerte con un canto inferior de 1px como una tecla física. Sobre fondos oscuros pasa a borde y fondo blancos translúcidos.

### Marcas de semáforo
- **Style:** glifo de 12px + palabra en label; versión plena con fondo y texto del tono (rojo-fondo/rojo, etc.) y esquina de 3px; versión compacta solo con color de texto.
- **Conteo:** rojo · amarillo · verde en cifras, glifo delante de cada número, ceros al 35 %.
- **Etiqueta:** marca tipográfica sin fondo (tinta-3, sello o rojo), como una llamada de nota.

### Cards / Containers (Hoja)
- **Corner Style:** 5px.
- **Background:** hoja blanca sobre papel.
- **Shadow Strategy:** ninguna (ver Flat Sheet Rule).
- **Border:** 1px de línea; filas internas separadas por línea.
- **Internal Padding:** 16px lateral, 8px vertical por fila.

### Inputs / Fields
- **Style:** hoja blanca, borde de línea fuerte, 5px, 28px de alto en barras de herramientas; cifra centrada en el campo de folio.
- **Focus:** anillo violeta de 2px; cursor de texto violeta.

### Navigation (Riel)
Riel verde botella de 84px a altura completa: marca «Folio» en 1.0625rem extrabold arriba, destinos apilados (icono de 18px, palabra de 0.6875rem semibold), avatar e intercambio de rol abajo tras una línea blanca al 10 %. Inactivo en riel-apagado; hover a blanco al 6 % con tinta del riel; activo con fondo verde activo, texto blanco e icono con trazo más grueso.

### Fila de variable
Etiqueta · valor tabular · llamada de folio · estado. El glifo de semáforo abre la fila; la fila activa se marca con un filo violeta de 1px a la izquierda y se despliega con la cita literal, las verificaciones (glifo + nombre, detalle solo en alertas y fallas) y las acciones con su tecla. NO_ENCONTRADO se escribe tal cual en rojo semibold: es un resultado, no un vacío.

### Llamada de folio (firma)
«f. N» en label bold violeta, 44px de ancho, alineada a la derecha; hover a fondo de sello, activa en violeta pleno con texto blanco. En el visor, la misma llamada aparece en el margen izquierdo de la cita (violeta pleno, 0.625rem bold) y entra en 180ms; el marco de la cita (borde violeta de 1.5px, relleno violeta al 11 %, esquina de 2px) se dibuja de izquierda a derecha en 480ms con un halo que se apaga, con curva `cubic-bezier(0.16, 1, 0.3, 1)`. Debajo de la fila, la cita literal va entre comillas angulares en una caja de sello con pie «Cita literal · folio N».

### Prueba contable
Franja en papel al pie del panel de variables: cada prueba es una lista término / cifra con signo en columna, regla simple sobre «Diferencia» y doble regla bajo el resultado, que se vuelve verde con visto cuando cuadra y rojo con círculo tachado y paréntesis cuando no. Cada cifra es un botón que lleva a su variable.

## Do's and Don'ts

### Do:
- **Do** acompañar cada color de semáforo con su glifo y su palabra, y ordenar por atención rojo > amarillo > verde.
- **Do** poner cada cifra comparable en cifras tabulares alineadas a la derecha y cerrar totales con regla simple y doble regla.
- **Do** llevar toda cifra extraída junto a su llamada «f. N» en violeta de sello.
- **Do** separar superficies con borde de línea de 1px y con tono papel / hoja / panel.
- **Do** mostrar el atajo de teclado dentro del botón que lo ejecuta.
- **Do** respetar la reducción de movimiento: las animaciones de la cita y del folio colapsan a 0.01ms.

### Don't:
- **Don't** usar el violeta de sello para navegación, botones genéricos o decoración.
- **Don't** usar color de semáforo sin glifo y palabra, ni insignias de colores sueltas.
- **Don't** construir paneles de tarjetas con métricas gigantes; las cifras viven en tablas y estados con su folio.
- **Don't** poner sombra a hojas, filas o tablas; la sombra es solo de la página del PDF y de lo emergente.
- **Don't** usar mayúsculas sostenidas con tracking para rótulos o encabezados.
- **Don't** anidar una hoja dentro de otra.
