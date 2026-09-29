// Escapa texto antes de interpolarlo en un correo HTML armado a mano (sin motor de plantillas).
// Sin esto, un nombre como `<a href="http://evil">click</a>` quedaría como enlace real en el
// correo que la propia persona recibe: no es una fuga a terceros, pero sí una inyección de HTML
// evitable con algo tan simple como esto.
export function escapeHtml(texto) {
  return String(texto ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
