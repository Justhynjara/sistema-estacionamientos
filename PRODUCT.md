# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Dos lados de un marketplace de estacionamientos en Chile:

- **Dueños de estacionamiento** (rol `CLIENTE` en el sistema): principalmente independientes o informales, no cadenas corporativas — alguien que administra uno o pocos estacionamientos, necesita ver ocupación, emitir/cobrar tickets y revisar sus ventas del día, probablemente no muy experto en tecnología.
- **Conductores** (rol `USUARIO`, público general): buscan estacionamiento disponible cerca de su ubicación y pagan por su uso.
- **Administradores** (rol `ADMIN`): supervisan la plataforma completa — usuarios, estacionamientos, auditoría.

## Product Purpose

Conectar a dueños independientes de estacionamientos con conductores que buscan dónde estacionar, digitalizando algo que hoy en Chile suele ser informal (cobro en efectivo, sin visibilidad de ocupación real). El dueño gana control y trazabilidad de sus ventas; el conductor gana certeza de que hay un cupo disponible antes de llegar.

## Positioning

Mecanismo diferenciador declarado por el dueño del producto: disponibilidad en tiempo real de cupos, combinada a futuro con reserva con micropago anti-no-show (el conductor reserva pagando un monto pequeño no reembolsable si no llega, lo que compromete al conductor y da certeza real al dueño del estacionamiento — no solo un listado estático de direcciones). La reserva con micropago es la dirección declarada del producto; a la fecha de este documento aún no está implementada (hoy el flujo es buscar → llegar → emitir ticket → cobrar).

## Operating Context

Proyecto de tesis universitaria, en producción real (no solo maqueta): frontend en Render, backend en Render (plan free) con Postgres en Neon. Flujos reales que corren hoy: búsqueda de estacionamientos cercanos por geolocalización, emisión y cobro de tickets (incluye QR), panel de dueño con dashboard de ventas/ocupación, panel de administración con gestión de usuarios/estacionamientos y auditoría, chatbot de soporte, solicitudes de alta de nuevos dueños/estacionamientos revisadas por soporte.

## Capabilities and Constraints

- Roles: `ADMIN`, `CLIENTE` (dueño de estacionamiento), `USUARIO` (conductor/público).
- Stack existente: frontend React + Vite, backend Node/Express, Postgres (Neon en producción, Docker local). No hay una app nativa en producción — existe `@capacitor/cli` como devDependency para compilar un APK a mano, pero no es parte del producto que se distribuye hoy.
- Hosting free-tier en Render: la API puede "dormir" por inactividad (cold start), es una limitación de infraestructura conocida, no un bug de producto.
- Idioma: español (Chile), moneda CLP.

## Brand Commitments

Sin marca definida todavía. "Sistema de Estacionamientos" es el nombre de trabajo/tesis, no un nombre comercial confirmado. No existe logo ni identidad visual propia: la interfaz actual usa una paleta genérica índigo/violeta tipo "SaaS de plantilla" (ver DESIGN.md) sin ningún elemento que la distinga como marca. No hay restricciones de marca que preservar — el rediseño visual queda abierto.

## Evidence on Hand

No hay testimonios, casos de éxito ni métricas de uso real de terceros — es un proyecto académico sin clientes reales confirmados. Existen cuentas demo (`admin@demo.cl`, `cliente@demo.cl`, `soporte@demo.cl`) usadas solo para pruebas/QA, no como evidencia de producto.

## Product Principles

1. **Confianza mutua entre ambos lados del marketplace**: lo que la interfaz promete (cupo disponible, venta registrada) tiene que ser cierto en tiempo real; la confianza es el producto, no un valor accesorio.
2. **Diseñado para dueños no expertos en tecnología**: prioriza claridad y flujos cortos por sobre potencia o densidad de opciones — el dueño típico administra esto entre otras tareas, no es su trabajo de tiempo completo.
3. **Rigor de ingeniería real, no solo de tesis**: corre en producción real con datos reales; seguridad, accesibilidad (WCAG AA ya es un compromiso activo en el código) y pruebas automatizadas son parte del estándar de calidad, igual que el diseño visual.
4. **Contexto chileno explícito**: español, CLP, direcciones y zona horaria de Chile — no es un producto genérico "internacional" traducido después.

## Accessibility & Inclusion

Compromiso ya activo y verificable en el código (`frontend/src/index.css`): contraste de color ajustado explícitamente para cumplir WCAG AA (4.5:1) en texto y badges de estado, y foco visible por teclado en todos los controles interactivos. Cualquier rediseño visual debe preservar o mejorar estos contrastes, no regresarlos.
