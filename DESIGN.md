---
name: Sistema de Estacionamientos
description: Marketplace chileno de estacionamientos con la identidad visual de la boleta térmica que el sistema realmente imprime.
colors:
  paper: "#f4efe1"
  paper-alt: "#ece4cf"
  surface: "#faf7ec"
  ink: "#241d15"
  ink-muted: "#6a5e4c"
  primary-yellow: "#f2c40f"
  primary-yellow-light: "#f6d647"
  stamp-blue: "#2563eb"
  stamp-green: "#0f6b39"
  stamp-green-bg: "#e4ecd7"
  stamp-red: "#b3231f"
  stamp-red-bg: "#f6ddd3"
  border: "#c2b083"
typography:
  display:
    fontFamily: "Syne, Inter, system-ui, sans-serif"
    fontWeight: 700
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
    fontWeight: 400
  data:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontWeight: 700
rounded:
  sm: "4px"
  md: "8px"
  pill: "999px"
spacing:
  sm: "8px"
  md: "14px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary-yellow}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.primary-yellow-light}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  badge-ok:
    backgroundColor: "{colors.stamp-green-bg}"
    textColor: "{colors.stamp-green}"
    rounded: "6px"
  badge-off:
    backgroundColor: "{colors.stamp-red-bg}"
    textColor: "{colors.stamp-red}"
    rounded: "6px"
---

# Design System: Sistema de Estacionamientos

## Overview

**Creative North Star: "La boleta de estacionamiento"**

El objeto real que este producto emite —el ticket térmico que se imprime o se muestra al cobrar— es la fuente de toda la identidad visual, en vez de una plantilla SaaS genérica. Papel hueso, tinta casi negra, un solo acento amarillo vial y dos tintas de timbre (verde y rojo) para los estados. Es cálido y de trazo firme, no frío ni corporativo: el dueño de un estacionamiento informal debe reconocerlo como "su" boleta, no como el dashboard de una startup.

La interfaz es mayoritariamente de tipo Operate (paneles de dueño y administración: tareas, no persuasión), así que la expresión vive en el color, la tipografía y un único motivo recurrente —la perforación/código de barras—, nunca a costa de la legibilidad o la velocidad de escaneo. El único lugar donde el mundo se permite el compromiso total es el propio componente de ticket (`TicketPublico`), que se construye literalmente como una boleta con borde perforado.

Rechazos confirmados: el morado/índigo "SaaS de plantilla" que tenía el proyecto antes de este rediseño; gradientes de texto; sombras planas sin difuminado (look neobrutalista) fuera del propio componente de ticket; monoespaciado usado como decoración en vez de para datos reales.

**Key Characteristics:**
- Papel hueso + tinta casi negra como base, no blanco/gris de plantilla.
- Un solo acento saturado (amarillo vial) que carga la marca: nav, botones primarios, chips de rol.
- Insignias de estado con look de timbre de goma (borde propio, leve rotación), no píldoras planas.
- Números, montos, horas y códigos de ticket en mono; el resto del texto en una sans de trabajo.
- El código de barras como única franja decorativa, usado con moderación.

## Colors

Paleta restringida (Restrained + un acento Committed en la marca): neutros cálidos de papel/tinta que cargan casi toda la superficie, con el amarillo llevando el peso de marca en nav, botones y chips.

### Primary
- **Amarillo boleta** (`#f2c40f`): color de marca. Fondo de botones primarios, borde inferior del nav, chip de rol, acento del hero. Carga del orden de 20-30% de cualquier pantalla — suficiente para ser inconfundible, sin empapar el contenido.
- **Amarillo claro** (`#f6d647`): hover de botones y superficies primarias.

### Secondary
- **Azul de aprobación** (`#2563eb`): tinta de sello "aprobado" tomada del mundo de los timbres oficiales chilenos. Se usa solo como color de foco de teclado y estados de validación — nunca como color decorativo — precisamente para no competir con el amarillo de marca.

### Tertiary
- **Verde timbre** (`#0f6b39` sobre `#e4ecd7`) y **Rojo timbre** (`#b3231f` sobre `#f6ddd3`): estados semánticos (disponible/pagado vs. vencido/no disponible), con el carácter de una tinta de sello, no de un semáforo de UI kit.

### Neutral
- **Papel** (`#f4efe1`): fondo de página.
- **Papel alterno** (`#ece4cf`): encabezados de tabla, fondos de inputs, paneles del chatbot.
- **Superficie** (`#faf7ec`): fondo de tarjetas, ligeramente más clara que el papel de fondo para que las tarjetas se noten sin necesitar una sombra fuerte.
- **Tinta** (`#241d15`): texto principal, fondo de nav/footer. Contraste 14.5:1 sobre papel.
- **Tinta muted** (`#6a5e4c`): texto secundario. 5.5:1 sobre papel — con margen sobre el mínimo AA de 4.5:1.
- **Borde** (`#c2b083`): bordes sutiles de tarjetas, inputs y divisores.

### Named Rules
**La Regla del Acento Único.** El amarillo es el único color saturado que puede cargar una región completa (fondo de botón, franja de nav). Verde y rojo timbre solo aparecen como insignias pequeñas de estado, nunca como fondo de sección.

## Typography

**Display Font:** Syne (con Inter, system-ui como respaldo)
**Body Font:** Inter (con system-ui, Segoe UI, Roboto, Arial como respaldo)
**Label/Mono Font:** JetBrains Mono

**Character:** Syne aporta el carácter geométrico y un poco excéntrico que separa los títulos de cualquier plantilla; Inter se mantiene en el cuerpo de texto porque esta es mayoritariamente una interfaz de tipo Operate, donde la legibilidad de una sans de trabajo importa más que la personalidad. JetBrains Mono aparece únicamente donde hay un dato real que medir: montos, cronómetros, horas, patentes y el número de ticket — nunca como disfraz "técnico".

### Hierarchy
- **Display** (700, 1.7rem en el hero): títulos de sección y encabezados de página.
- **Title** (700, 1.15–1.2rem): encabezados de tarjeta (`h2`, `h3`).
- **Body** (400–600, .88–.98rem): texto de interfaz y contenido.
- **Label** (700, .72–.85rem, mayúsculas con tracking): chips de rol, encabezados de tabla, insignias de estado.
- **Data (mono)** (700, .78rem–2.4rem según el dato): montos en CLP, cronómetro de tiempo estacionado, horas, número de ticket.

### Named Rules
**La Regla del Dato Real.** JetBrains Mono se reserva para números que el usuario podría verificar contra la realidad (un monto, un tiempo, un código). Un rótulo o una etiqueta de estado nunca va en mono solo por parecer "técnico".

## Layout

Contenedor centrado de 1100px máximo con padding de 24px (14px en móvil ≤640px). Grillas de tarjetas con `auto-fit, minmax(260px,1fr)`. El nav es sticky con una franja inferior de 3px en amarillo que funciona como línea de marca en cualquier scroll. Sin cambios de densidad respecto al sistema anterior: la reformulación es de lenguaje visual, no de arquitectura de información.

## Elevation & Depth

Sistema de sombras suaves con difuminado real (nunca sombras duras sin blur, que pertenecen a un mundo neobrutalista que este sistema no adoptó), todas teñidas de tinta cálida en vez de negro puro o del violeta anterior.

### Shadow Vocabulary
- **sm** (`0 1px 2px rgba(36,29,21,.14)`): reposo de tarjetas.
- **md** (`0 6px 16px rgba(36,29,21,.16)`): hover de tarjetas, paneles flotantes.
- **lg** (`0 14px 32px rgba(36,29,21,.22)`): chatbot, modales de cookie, elementos flotantes.
- **botón** (`0 4px 10px rgba(36,29,21,.28)`, sube a `0 6px 14px` en hover): sombra propia de los botones primarios.

### Named Rules
**La Regla del Difuminado.** Toda sombra lleva offset y blur reales. Una sombra plana (`0 3px 0`) solo existiría en un mundo neobrutalista, y este no lo es.

## Shapes

Esquinas notablemente menos redondeadas que el sistema anterior (`--radius: 8px` en tarjetas, `4px` en botones/inputs, frente a los 16px/10px previos): una boleta no tiene esquinas de plantilla SaaS. Las excepciones son deliberadamente circulares porque son objetos redondos en el mundo real: el timbre de goma (insignias `.badge`, con borde propio y leve rotación de -1.5deg), el círculo de paso (`.step`) y el botón flotante del chatbot.

## Components

### Buttons
- **Shape:** 4px de radio, sin bordes de plantilla redondeada.
- **Primary:** fondo amarillo (`#f2c40f`), texto tinta (`#241d15`), peso 700, sombra suave teñida de tinta.
- **Hover/Focus:** el primario aclara a `#f6d647` y sube 1px; el foco de teclado usa el azul de aprobación (`#2563eb`) en outline, nunca el amarillo (se perdería el contraste con el propio botón amarillo).
- **Secondary:** fondo superficie, borde tinta de 1.5px, sin sombra.

### Badges (insignia de timbre)
- **Style:** borde de 2px del propio color semántico, fondo tintado, mayúsculas con tracking, rotación de -1.5deg para el efecto de sello estampado a mano.
- **State:** verde timbre = disponible/pagado/aprobado; rojo timbre = vencido/no disponible/rechazado.

### Cards / Containers
- **Corner Style:** 8px.
- **Background:** superficie (`#faf7ec`), ligeramente más clara que el papel de fondo.
- **Shadow Strategy:** sm en reposo, md en hover (ver Elevation).
- **Border:** 1px sólido en `#c2b083`.

### Inputs / Fields
- **Style:** fondo papel-alterno, borde 1.5px, radio 4px.
- **Focus:** borde y halo en azul de aprobación (`rgba(37,99,235,.18)`), nunca amarillo.

### Navigation
- **Style:** fondo tinta (`#241d15`) de borde a borde, texto papel, franja inferior amarilla de 3px como firma de marca. Chip de rol en amarillo sólido con texto tinta. Botones del nav son ghost (fondo papel translúcido) sobre el fondo oscuro.

### Ticket / Boleta (componente de firma)
El único componente que se permite el motivo de perforación completo: una franja `.ticket-perf` (línea punteada horizontal color tinta-muted) corona la tarjeta, que pierde su borde y radio superior para fundirse con ella. Dentro, el número de ticket y una franja de código de barras decorativa anteceden al contenido; el cronómetro y el monto van en JetBrains Mono a gran tamaño. Es la aplicación más literal del mundo "boleta" porque es, literalmente, la boleta que el conductor escanea.

## Do's and Don'ts

### Do:
- **Do** usar el amarillo (`#f2c40f`) como único color que puede cargar una región completa (fondo de botón, franja de nav, chip de rol).
- **Do** reservar JetBrains Mono para datos verificables: montos, tiempos, horas, códigos.
- **Do** mantener sombras con offset y blur reales, teñidas de tinta cálida (`rgba(36,29,21,…)`), nunca negro puro.
- **Do** preservar los contrastes WCAG AA ya verificados (texto normal ≥4.5:1, bordes/foco ≥3:1) en cualquier color nuevo que se agregue.

### Don't:
- **Don't** reintroducir el índigo/violeta del sistema anterior en ningún componente nuevo.
- **Don't** usar sombras planas sin blur (`0 Npx 0`) fuera del mundo neobrutalista — este sistema no lo es.
- **Don't** usar el amarillo de marca como color de foco de teclado (se pierde contra los propios botones amarillos); el foco es siempre azul de aprobación.
- **Don't** aplicar el motivo de perforación/código de barras fuera del componente de ticket y, como mucho, un divisor puntual del hero — es la firma de un solo componente, no una textura de fondo.
