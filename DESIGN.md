---
name: Sistema de Estacionamientos
description: Buscador de estacionamientos y caja para dueños, dibujado como señalética vial y plano de transporte ("línea de ruta").
colors:
  bg-gris-calzada: "#eef1f4"
  panel: "#ffffff"
  panel-alt: "#f6f8fa"
  ink: "#0e1726"
  muted: "#4a5568"
  rule: "#d3d9e1"
  rule-soft: "#e6eaef"
  route: "#0b5cad"
  route-dark: "#08447f"
  route-tint: "#e8f0fa"
  sign: "#0a3f7a"
  sign-text: "#cfdcf0"
  free: "#0a7a3d"
  free-bg: "#e3f3e9"
  full: "#b42318"
  full-bg: "#fdecea"
  focus: "#0b5cad"
typography:
  display:
    fontFamily: "Overpass, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
    fontSize: "2.3rem"
    fontWeight: 900
    lineHeight: 1.04
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Overpass, system-ui, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Overpass, system-ui, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 800
    lineHeight: 1.25
  body:
    fontFamily: "Overpass, system-ui, sans-serif"
    fontSize: "15.5px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Overpass, system-ui, sans-serif"
    fontSize: "0.76rem"
    fontWeight: 800
    letterSpacing: "0.08em"
  numeral-board:
    fontFamily: "Overpass Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "2.6rem"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
  numeral-stop:
    fontFamily: "Overpass Mono, ui-monospace, monospace"
    fontSize: "1.6rem"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
  numeral-inline:
    fontFamily: "Overpass Mono, ui-monospace, monospace"
    fontSize: "1em"
    fontWeight: 500
    fontFeature: "tnum"
rounded:
  chip: "4px"
  sm: "6px"
  md: "8px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  gutter: "28px"
  gutter-mobile: "16px"
components:
  button-primary:
    backgroundColor: "{colors.route}"
    textColor: "{colors.panel}"
    rounded: "{rounded.sm}"
    padding: "11px 18px"
  button-primary-hover:
    backgroundColor: "{colors.route-dark}"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "9.5px 16px"
  button-dark:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.panel}"
    rounded: "{rounded.sm}"
    padding: "7px 12px"
  button-danger:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.full}"
    rounded: "{rounded.sm}"
    padding: "9.5px 14px"
  input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "11px 12px"
  card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "22px"
  sign-band:
    backgroundColor: "{colors.sign}"
    textColor: "{colors.panel}"
    padding: "26px 28px 24px"
  chip-free:
    backgroundColor: "{colors.free-bg}"
    textColor: "{colors.free}"
    rounded: "{rounded.chip}"
    padding: "4px 9px 3px"
  chip-full:
    backgroundColor: "{colors.full-bg}"
    textColor: "{colors.full}"
    rounded: "{rounded.chip}"
    padding: "4px 9px 3px"
  board-cell:
    backgroundColor: "{colors.sign}"
    textColor: "{colors.panel}"
    typography: "{typography.numeral-board}"
    padding: "20px 22px 22px"
  stop-number:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    size: "26px"
---

# Design System: Sistema de Estacionamientos

## Overview

**Creative North Star: "Línea de ruta"**

El sitio habla el idioma de la señalética vial chilena y de los planos de transporte: certeza de un vistazo. La marca es el letrero "E" de estacionamiento (E blanca sobre azul señal, con filete blanco interior). La búsqueda se dibuja como una línea de metro: un riel azul de 6px va de "Desde" a "Hacia" y cada estacionamiento encontrado es una parada numerada; la línea termina en el nodo de la última parada, no se prolonga al vacío. El dueño ve su local como un tablero de terminal: celdas azul letrero con cifras grandes en mono.

Densidad media, superficies planas: paneles blancos sobre un gris frío, tinta azul-negra, el azul de ruta como única voz de acción, y verde/rojo reservados para el estado de los cupos. Lo cancelado o lleno se tacha, no desaparece (herencia de la billetera de pasajes). Las cifras verificables contra la realidad (montos, minutos, patentes, códigos, horas) van en Overpass Mono; todo lo demás, incluidas las palabras que rodean a esas cifras, en Overpass.

Rechazos confirmados: la tarjeta-con-emoji de plantilla y el "dashboard SaaS" genérico. Cero emojis en la interfaz.

**Key Characteristics:**
- Letrero "E" como marca; bandas azul letrero con texto blanco como titular de cada pantalla.
- Riel de 6px con nodos circulares y paradas numeradas, igual en la lista y en el mapa.
- Overpass para texto, Overpass Mono solo para cifras (con `tabular-nums`).
- Minutos a pie como cifra principal de distancia; metros/km como dato secundario.
- Barra de cupos proporcional; lleno = tachado en rojo, en lista y en mapa.
- Horas en formato 24 h; contraste WCAG AA; foco visible; respeto a `prefers-reduced-motion`.

## Colors

Una paleta de señalética: neutros fríos de calzada, un azul de ruta para la acción, un azul más profundo de letrero para la marca y los tableros, y un par semafórico solo para estado.

### Primary
- **Azul Ruta** (route): el trazo de la línea, botones primarios, enlaces, pestaña activa, parada seleccionada, ruta en el mapa (polilínea azul de 6px sobre halo blanco de 11px). 6.4:1 sobre blanco y con texto blanco encima.
- **Azul Ruta Profundo** (route-dark): hover de botones y enlaces, nodo de destino, barra pico del gráfico de flujo.
- **Tinte de Ruta** (route-tint): fondo de la parada seleccionada (degradado hacia la derecha), hover de sugerencias y del botón GPS, fondo de la píldora de rol.

### Secondary
- **Azul Letrero** (sign): el fondo del letrero "E", de las bandas de título, de la cabecera del ticket y del chatbot, y de las celdas del tablero. También es el `theme-color` del documento.
- **Texto de Letrero** (sign-text): texto secundario sobre azul letrero (bajadas, etiquetas de celda, detalles).

### Tertiary (estado de cupos)
- **Verde Libre** (free) sobre **Fondo Libre** (free-bg): cupos disponibles, barra de capacidad, chips y avisos de éxito. 5.4:1 sobre blanco.
- **Rojo Lleno** (full) sobre **Fondo Lleno** (full-bg): lleno, errores, acciones destructivas, tachado de paradas llenas. 6.3:1 sobre blanco.
- Los avisos informativos reutilizan Azul Ruta sobre Tinte de Ruta.

### Neutral
- **Gris Calzada** (bg-gris-calzada): fondo de la página.
- **Panel** (panel): tarjetas, encabezado, inputs, ticket.
- **Panel Alterno** (panel-alt): encabezados de tabla, estados vacíos, fondo de mensajes del chat, hover de navegación.
- **Tinta** (ink): texto principal, borde del botón secundario, contorno de las paradas, fondo del botón oscuro y del pie de página.
- **Gris Texto** (muted): texto secundario y etiquetas. 7.4:1 sobre blanco, 6.6:1 sobre el fondo.
- **Filete** (rule) y **Filete Suave** (rule-soft): bordes de panel e input; divisores internos entre filas y paradas; fondo vacío de la barra de cupos.

### Named Rules
**The Semáforo Rule.** El verde y el rojo significan cupos (o éxito/error). Nunca se usan como decoración ni como color de marca.

**The Dos Azules Rule.** Azul Ruta es lo que se toca y lo que se recorre; Azul Letrero es lo que se lee como letrero (marca, bandas, tableros). No se intercambian.

## Typography

**Display / Body Font:** Overpass (con system-ui, Segoe UI, Roboto, Arial)
**Numeral Font:** Overpass Mono (con ui-monospace, SFMono-Regular, Menlo)

**Character:** Overpass es la tipografía de carretera (derivada de Highway Gothic): legible a distancia, firme en pesos 800–900. Overpass Mono, en sus pesos 500 y 700, da a las cifras columnas alineadas, como un panel de horarios.

Un `@font-face` local ("Punto medio") toma solo el carácter `·` (U+00B7) de la sans del sistema, porque en Overpass queda pegado al texto siguiente.

### Hierarchy
- **Display** (900, 2.3rem, 1.04, -0.02em; 1.7rem en móvil): titular blanco de la banda de letrero, máx. 20ch. La variante delgada usa 1.55rem.
- **Headline** (800, 1.2rem, 1.2): títulos de sección (h2); dentro de tarjeta, 1.15rem.
- **Title** (800, 1.05rem, 1.25): nombre de cada parada, títulos de tarjeta (h3).
- **Body** (400, 15.5px, 1.5): texto corriente; lectura legal a 1.65 y 70ch.
- **Label** (800, 0.76rem, 0.08em, mayúsculas): rótulos de campo ("Desde", "Hacia"), encabezados de tabla (0.74rem), rótulos de métrica del ticket. Solo como etiqueta de un dato o control, nunca como antetítulo de sección.
- **Numeral Board** (Mono 700, 2.6rem, 1; 1.7rem en móvil): cifras del tablero del dueño; variante mediana 1.9rem. Valor del ticket público a 2.5rem.
- **Numeral Stop** (Mono 700, 1.6rem): los minutos a pie de cada parada.
- **Numeral Inline** (Mono, tamaño heredado, `tabular-nums`): montos, patentes, códigos, horas y cantidades dentro de una frase o celda.

### Named Rules
**The Cifra Mono Rule.** Overpass Mono es solo para la cifra; la palabra que la acompaña queda en Overpass. En "$20/min · mínimo $500" solo "$20" y "$500" van en mono; en "3 libres de 24", solo "3" y "24". Nunca la frase entera en mono.

**The Reloj de 24 Horas Rule.** Toda hora se muestra en formato 24 h (`hourCycle: 'h23'`), en mono.

## Layout

- **Contenedor:** 1240px de ancho máximo, centrado, con 24px vertical y 28px de gutter lateral (16px bajo 640px). El encabezado se alinea al mismo contenedor en paneles y legales.
- **Portada (buscador):** a ancho completo. Dos columnas: formulario y paradas a la izquierda (hasta 460px), mapa sticky a la derecha a la altura de la ventana menos el encabezado (58px). Bajo 900px se vuelve una columna y el mapa (300px de alto) se intercala justo después del formulario, antes de la lista.
- **Grillas:** `auto-fit` con mínimo 280px para tarjetas, 210px para celdas del tablero; separación de 16px.
- **Ritmo:** pasos de 4 / 8 / 12 / 16 / 24px, con 22px como padding interno de panel y 28px como gutter.
- **Breakpoints:** 900px (buscador a una columna, franja de dueños apilada) y 640px (gutters de 16px, banda más compacta, pestañas deslizables sin barra de scroll; con solo dos pestañas se reparten el ancho).
- **Capas fijas:** encabezado sticky (z 1000), avisos de cookies (1400), asistente flotante (1500); el pie reserva 72px a la derecha para no quedar tapado por el botón del asistente.

## Elevation & Depth

Sistema plano con sombra ambiental mínima. La profundidad la dan los filetes de 1px y el contraste entre gris calzada y panel blanco; las sombras solo separan lo que flota.

### Shadow Vocabulary
- **Reposo** (`0 1px 2px rgba(14,23,38,.08)`): tarjetas.
- **Media** (`0 6px 18px rgba(14,23,38,.10)`): tablero, ticket, lista de sugerencias.
- **Flotante** (`0 16px 40px rgba(14,23,38,.18)`): asistente, aviso de cookies.
- **Botón primario** (`0 3px 10px rgba(11,92,173,.22)`, hover `0 5px 14px rgba(11,92,173,.28)`): solo el botón azul lleno lleva sombra teñida de azul; los demás botones son planos.

### Named Rules
**The Filete Primero Rule.** Para separar, primero un filete; la sombra es para lo que realmente flota sobre otra superficie.

## Shapes

Esquinas suavemente redondeadas, nunca blandas: 8px en paneles, tablero y ticket; 6px en botones e inputs; 4px en chips y píldora de rol; 999px solo en las sugerencias del asistente. El círculo está reservado al sistema de ruta: nodos del riel, números de parada, marcadores del mapa, punto de "en vivo". Los trazos del riel son barras de 6px con extremos redondeados (3px).

Íconos SVG propios de 24×24, trazo 1.8, extremos y uniones redondeados, en `currentColor` (18px por defecto, 16–17px en contexto compacto). El letrero "E" escala con su tamaño: radio 17%, letra al 60%, filete blanco interior de 2px.

## Components

### Letrero E (marca)
- Cuadrado azul letrero, E blanca en Overpass 900, filete blanco interior y borde exterior azul. 30px en el encabezado. Es la marca, no un ícono decorativo; no se recolorea.

### Banda de letrero
- Franja azul letrero a ancho completo bajo el encabezado, con titular Display blanco y bajada en texto de letrero. Variante delgada para paneles. Dentro de ella el foco pasa a blanco. Puede llevar indicador "en vivo" (punto verde con pulso).

### Riel de búsqueda (Desde → Hacia)
- Columna de 28px con barra azul de 6px; el nodo de partida es un círculo blanco con borde azul de 5px; el de destino, un punto azul profundo con doble anillo (blanco + azul). La barra empieza en el primer nodo y termina en el último.
- Junto a "Desde", un único botón GPS de 48px: contorno gris con ícono azul apagado, relleno azul cuando la partida es el GPS (`aria-pressed`).

### Paradas (resultados)
- Lista ordenada; cada parada dibuja su tramo de riel. La primera empieza en su nodo, la última termina en él; una sola parada no dibuja línea.
- Número en círculo blanco de 26px con borde tinta de 3px y cifra mono. Seleccionada: círculo azul lleno y fondo con tinte de ruta. Llena: borde y número rojos, nombre tachado en rojo (2px).
- A la derecha, minutos a pie en mono 1.6rem (a 80 m/min, redondeado hacia arriba, mínimo 1) y debajo "a pie · 450 m".
- Datos: tarifa e "x min en auto" con íconos de 16px. Acciones: "Reservar · $100" (botón oscuro pequeño), "Ver ruta" (secundario pequeño, `aria-pressed`), "Navegar con Waze" (texto azul).

### Barra de capacidad
- Pista de 8px en filete suave; relleno verde con ancho exacto libres/total. Al lado, "3 libres de 24" en verde; lleno, "Lleno · 24 cupos" en rojo.

### Mapa
- Leaflet con teselas de OpenStreetMap (el proveedor declarado en las páginas legales), desaturadas con CSS (`grayscale(1) contrast(.78) brightness(1.1)`) para que la ruta y las paradas se lean primero.
- Marcadores con el mismo lenguaje que la lista: parada de 34px con número mono; llena en rojo con un trazo diagonal que la tacha; seleccionada en azul lleno con anillo blanco. Tu ubicación = nodo de partida; destino = nodo final. Leyenda fija abajo a la izquierda ("Tu ruta", "Con cupos", "Lleno").

### Buttons
- **Shape:** esquinas de 6px; Overpass 800 a 0.93rem; ícono + texto con 8px de separación.
- **Primary:** azul ruta con texto blanco (11px 18px) y sombra azul; hover azul profundo; al presionar baja 1px.
- **Secondary:** blanco con borde tinta de 1.5px.
- **Dark:** tinta con texto blanco; para la acción por fila en listas (reservar).
- **Danger:** blanco con contorno y texto rojo, nunca relleno; hover con fondo lleno-claro; va separado del resto de las acciones.
- **Link button:** texto azul subrayado, sin fondo.
- **Disabled:** filete suave con texto gris, sin sombra.
- **Small:** 7px 12px a 0.86rem.

### Chips y avisos
- **Chip** (en línea): 4px de radio, punto de 7px en `currentColor`, variantes libre / lleno / info / neutral.
- **Aviso** (bloque, `p.badge`): ocupa la línea, frase normal a 0.92rem/600, borde de 1px del tono, ícono dibujado por máscara (info, alerta, check).
- **Píldora de rol:** mayúsculas 0.74rem sobre tinte de ruta, en el encabezado.

### Cards / Containers
- **Corner Style:** 8px.
- **Background:** panel blanco con filete de 1px y sombra de reposo.
- **Internal Padding:** 22px (16px en móvil).
- **Panel de acción** del buscador: igual pero sin sombra, 18px de padding.
- **Estado vacío:** borde punteado de 1.5px sobre panel alterno, texto gris centrado.

### Inputs / Fields
- **Style:** borde de 1.5px en filete, 6px de radio, 11px 12px de padding, fondo blanco; placeholder gris.
- **Focus:** borde azul ruta + halo `0 0 0 3px rgba(11,92,173,.16)`; además el contorno de foco global.
- **Numéricos y patentes:** en mono con `tabular-nums`; la patente se fuerza a mayúsculas.
- **Pista de campo:** 0.84rem en gris; en error, rojo 700.

### Navigation
- **Encabezado:** blanco sticky de 58px con filete inferior; marca (letrero + nombre en 800) a la izquierda; enlaces de navegación grises 600 que pasan a tinta sobre panel alterno.
- **Pestañas:** texto gris 700 con ícono de 17px; la activa en tinta con barra azul de 4px abajo. Roles ARIA `tablist`/`tab`.
- **Pie:** fondo tinta, texto gris claro, enlaces blancos subrayados, letrero E junto al nombre.

### Tablero del dueño
- Grilla de celdas azul letrero separadas por 1px de blanco translúcido, 8px de radio exterior, sombra media. Rótulo de celda en texto de letrero 0.9rem/700; cifra en mono 700 a 2.6rem blanca; desglose en lista con filetes translúcidos y montos mono blancos. Hora pico como rango 24 h ("14:00–15:00").
- **Gráfico de flujo:** barras azul ruta de 150px de alto máximo, hora pico en azul profundo, horas en cero en filete suave; eje de horas en mono 0.68rem.

### Vidrio en toda la web (`.vidrio`)
Pedido por el dueño del producto (referencias: reels "Glassy Dashboard V2" y un login con mascota): todas las vistas (portada con buscador, ticket público, postulación, legales y los paneles de dueño, administración y soporte) usan vidrio esmerilado sobre el azul de la marca; las de acceso usan la variante oscura (ver "Acceso"). Reemplaza a las superficies planas y a la banda azul sólida descritas arriba, que quedan como base de tokens. Conserva el letrero E, Overpass/Overpass Mono, la regla semáforo y el contraste AA.
- **Titulares:** blanco sobre el fondo (la banda de letrero es transparente); en la portada, hasta 3.3rem. En los paneles, titular + bajada por rol (`vidrio-cabeza`).
- **Portada:** columna del buscador y mapa como dos tarjetas de vidrio separadas por el fondo; bajo 900px cada parte (formulario, mapa, opciones) es su propia tarjeta. Franja de dueños y "Cómo funciona" también en vidrio.
- **Tablas sueltas** (fuera de una tarjeta) llevan el mismo vidrio que una tarjeta; dentro de una tarjeta, una capa más tenue.
- **Fondo:** degradado de los azules de la marca (#08447f → #0b5cad → #3f7fc8) con manchas de luz suaves; sin foto.
- **Vidrio:** blanco al 78% con `backdrop-filter: blur(22px) saturate(150%)`, borde blanco al 80%, radio 22px (18px en móvil), sombra `0 12px 36px rgba(6,32,72,.22)`. Sin desenfoque disponible, pasa a 94% opaco. `--muted` baja a #3c4657 para mantener ≥ 4.5:1 sobre el vidrio.
- **Barra superior:** píldora flotante con el letrero E; con sesión, saludo con avatar de iniciales (oculto bajo 640px), rol y Salir.
- **Cifras:** una tarjeta de vidrio por cifra, con ícono en círculo blanco; la variación es un chip verde o rojo con flecha y signo.
- **Pestañas:** píldora flotante abajo al centro, la activa en blanco; bajo 900px van arriba a todo el ancho (abajo está el botón de escanear).
- **Controles:** botones e interruptores en píldora; "Exportar CSV" como botón oscuro; período como segmentado en píldora con la opción activa en tinta.

### Acceso (`.acceso`, `AccesoAuto.jsx`)
Pantallas de inicio de sesión, recuperación y cambio de contraseña: noche azul (#050f1f → #0a2546 con brillos de la marca) y tarjeta de vidrio oscuro (radio 24px, desenfoque 24px). Texto blanco, secundario #b9c8dc y enlaces #9cc8ff, todos ≥ 9:1.
- **El auto que vigila:** un auto de frente asoma sobre la tarjeta tras una barrera de estacionamiento. Los focos siguen el email mientras se escribe, se apagan con párpados al escribir la contraseña (campos marcados con `data-clave`), se abren a medias si la clave está visible y, con el acceso correcto, la barrera sube y el auto entra (650 ms; sin espera con `prefers-reduced-motion`). Es decorativo (`aria-hidden`).
- **Botón de entrar:** degradado azul (#2f86e6 → #0b5cad), radio 14px, flecha que avanza al pasar el mouse.
- **Mostrar contraseña:** botón con ojo dentro del campo, `aria-pressed`.

### Ticket público
- Pase de 540px: cabecera azul letrero con el letrero E, cuerpo blanco; código en mono pequeño; métricas con rótulo en mayúsculas y valor mono a 2.5rem; acciones separadas por filete.

### Tablas
- Contenedor con borde y radio de 8px y scroll horizontal; encabezados en mayúsculas 0.74rem sobre panel alterno; filas con filete suave; columnas numéricas en mono; acciones alineadas a la derecha.

### Asistente
- Botón circular azul de 56px fijo abajo a la derecha; panel de 360px con cabecera azul letrero; mensajes del bot en blanco con filete, del usuario en azul ruta; sugerencias como píldoras con borde. Entrada con animación de 0.22s.

### Movimiento y accesibilidad
- Transiciones de 0.12–0.15s en color, sombra y transform; pulso de 2.4s en el punto "en vivo"; giro del spinner de 0.7s. Con `prefers-reduced-motion: reduce` se anulan todas las animaciones y transiciones.
- Foco: contorno de 3px en `--focus` con 2px de separación en todo elemento interactivo; sobre superficies azules o tinta, `--focus` pasa a blanco.

## Do's and Don'ts

### Do:
- **Do** usar Overpass Mono solo para la cifra y dejar en Overpass la palabra que la acompaña ("$20/min", "3 libres de 24", "12 min").
- **Do** mostrar la distancia como minutos a pie en grande, con metros o km como dato secundario.
- **Do** tachar en rojo lo lleno, en la lista y en el mapa, y mantenerlo visible en su lugar.
- **Do** hacer que la barra de cupos mida exactamente libres/total.
- **Do** dibujar la línea de ruta de nodo a nodo: empieza en la primera parada y termina en la última.
- **Do** mostrar toda hora en 24 h.
- **Do** usar íconos SVG de trazo 1.8 en `currentColor` y el letrero E como única marca.
- **Do** verificar contraste WCAG AA de cualquier color nuevo y anotarlo junto al token en `index.css`.
- **Do** mantener el foco visible (contorno de 3px) y pasar `--focus` a blanco dentro de superficies azules u oscuras.
- **Do** usar teselas de OpenStreetMap desaturadas; si cambia el proveedor del mapa, cambiar primero las páginas legales.

### Don't:
- **Don't** usar emojis en ninguna parte de la interfaz, ni como ícono ni en textos.
- **Don't** escribir frases completas en mono ni usar mono para etiquetas o títulos.
- **Don't** usar verde o rojo como decoración o acento de marca.
- **Don't** rellenar de rojo un botón destructivo ni ponerlo junto a la acción principal.
- **Don't** ocultar los estacionamientos llenos de la lista o del mapa.
- **Don't** usar formato de 12 h (a. m. / p. m.).
- **Don't** prolongar el riel más allá del último nodo.
- **Don't** sumar sombras a superficies que no flotan; separar con filetes.
- **Don't** convertir los rótulos en mayúsculas en antetítulos sobre los titulares; son etiquetas de un dato o campo.
