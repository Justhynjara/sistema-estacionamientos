---
version: 1
slug: "frontend-src-app-jsx"
primary_target: "frontend/src/App.jsx"
related_targets: ["frontend/src/index.css"]
---

# Sitio completo (web pública + paneles)

Scope: todo el frontend (landing de búsqueda, reserva, ticket público, login, paneles de dueño/admin/soporte, legales). Mode: Operate (la landing es la herramienta de búsqueda del conductor).
Audience: conductores chilenos buscando dónde estacionar; dueños independientes poco técnicos operando su caja; admins.
Constraints: WCAG AA, React+Vite existente, Leaflet real, tests de Vitest que buscan textos por rol/nombre.
Memorable moment: la búsqueda dibujada como línea de ruta, con cada estacionamiento como parada.

## Direction contract
THESIS: El sitio habla el idioma de la señalética vial y de los planos de transporte: certeza de un vistazo. Rechaza la tarjeta-con-emoji de plantilla y el "dashboard SaaS" genérico.
OWN-WORLD: Fondo gris claro frío, paneles blancos, tinta azul-negra, azul señal (el letrero "E" de estacionamiento) como marca y como línea de ruta; verde libre / rojo lleno como estado. Overpass (tipografía de carretera) para todo, Overpass Mono para minutos, montos, patentes y códigos. Íconos SVG de trazo uniforme; cero emojis. Paradas circulares con número, rieles de 6px, bandas de letrero azul con texto blanco.
STORY: El conductor entiende en un vistazo dónde hay cupo, a cuántos minutos y cuánto cuesta; reserva con $100. El dueño ve su local como un tablero de terminal: cupos, caja, cobros.
FIRST VIEWPORT: Barra blanca con el letrero E + nombre y "Acceso dueños"; banda azul señal con el titular grande; debajo, a la izquierda, el riel Desde→Hacia con el botón azul "Buscar estacionamientos" y las opciones como paradas; a la derecha el mapa. La acción principal es Buscar, en la columna izquierda.
FORM: Plano de transporte + señalética vial ("línea de ruta"), candidato 6 de 7 de la lista ordenada; seed key e0dd46da. Raises: de la billetera de pasajes (lo cancelado se tacha, no desaparece); de la notación de danza (la longitud de la barra es la cantidad exacta de cupos); de la consola oscura (acciones destructivas aisladas); del letrero de terminal (distancias en minutos, en grande).
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
