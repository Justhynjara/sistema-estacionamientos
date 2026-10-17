// Textos del horario de atención. El estado (abierto/cerrado y cuándo cambia) lo calcula la API en
// hora de Chile (backend/src/utils/horario.js); aquí solo se convierte en frases.
export const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
// La semana se muestra de lunes a domingo; el índice sigue siendo el de Date.getDay() (0 = domingo).
export const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];

export function textoEstado(estado) {
  if (!estado) return null;
  if (estado.siempre) return { abierto: true, etiqueta: 'Abierto', detalle: 'las 24 horas' };
  const c = estado.cambio;
  if (!c) return { abierto: false, etiqueta: 'Cerrado', detalle: 'sin horario de atención' };
  const etiqueta = estado.abierto ? 'Abierto' : 'Cerrado';
  // Cerrar a las 00:00 del día siguiente es cerrar "a medianoche" de hoy.
  if (c.tipo === 'cierra' && c.hora === '00:00' && c.en_dias === 1) return { abierto: estado.abierto, etiqueta, detalle: 'cierra a medianoche' };
  const cuando = c.en_dias === 0 ? '' : c.en_dias === 1 ? 'mañana ' : `el ${DIAS[c.dia_semana].toLowerCase()} `;
  return { abierto: estado.abierto, etiqueta, detalle: `${c.tipo} ${cuando}a las ${c.hora}` };
}

function textoTurno(t) {
  if (!t) return 'cerrado';
  if (t.abre === '00:00' && t.cierra === '24:00') return '24 horas';
  return `${t.abre}–${t.cierra === '24:00' ? '24:00' : t.cierra}`;
}

// "Lun–Vie 08:00–20:00 · Sáb 09:00–14:00 · Dom cerrado": agrupa días seguidos con el mismo turno.
export function resumenHorario(horario) {
  if (!horario) return 'Abierto las 24 horas, todos los días';
  const grupos = [];
  for (const d of ORDEN_SEMANA) {
    const texto = textoTurno(horario[d]);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.texto === texto) ultimo.hasta = d;
    else grupos.push({ desde: d, hasta: d, texto });
  }
  if (grupos.length === 1) return grupos[0].texto === 'cerrado' ? 'Cerrado todos los días' : `Todos los días ${grupos[0].texto}`;
  return grupos.map(g => `${CORTO[g.desde]}${g.hasta !== g.desde ? `–${CORTO[g.hasta]}` : ''} ${g.texto}`).join(' · ');
}
