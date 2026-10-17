// Horario de atención de un estacionamiento.
//
// Formato guardado (columna estacionamientos.horario, JSONB):
//   null                      -> abierto las 24 horas, todos los días (valor por defecto).
//   [d0, d1, ..., d6]         -> un elemento por día, índice como Date.getDay(): 0 = domingo.
//       null                  -> ese día está cerrado.
//       { abre: 'HH:MM', cierra: 'HH:MM' }
//           '00:00' a '24:00' es el día completo.
//           Si cierra <= abre, el turno cruza la medianoche (ej. 20:00 a 02:00 del día siguiente).
//
// Todas las horas se interpretan en la hora de Chile continental, sin importar dónde corra el
// servidor (Render usa UTC).
export const ZONA_HORARIA = 'America/Santiago';
const MIN_DIA = 24 * 60;

function aMinutos(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function aHHMM(minutos) {
  const m = ((minutos % MIN_DIA) + MIN_DIA) % MIN_DIA;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// Día de la semana (0 = domingo) y minuto del día en la hora de Chile para un instante dado.
export function relojLocal(ahora = new Date()) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_HORARIA, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(ahora).map(p => [p.type, p.value]));
  const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(partes.weekday);
  return { dia, minuto: Number(partes.hour) * 60 + Number(partes.minute) };
}

// Turnos de la semana como intervalos [inicio, fin) en minutos relativos al inicio de "hoy",
// desde ayer (por si un turno de anoche sigue abierto) hasta dentro de 8 días, ya fusionados
// cuando se tocan (así "24 horas" varios días seguidos es un solo intervalo continuo).
function intervalos(horario, diaHoy) {
  const lista = [];
  for (let k = -1; k <= 8; k++) {
    const turno = horario[(((diaHoy + k) % 7) + 7) % 7];
    if (!turno) continue;
    const abre = aMinutos(turno.abre);
    let cierra = aMinutos(turno.cierra);
    if (cierra <= abre) cierra += MIN_DIA;
    lista.push([k * MIN_DIA + abre, k * MIN_DIA + cierra]);
  }
  lista.sort((a, b) => a[0] - b[0]);
  const fusion = [];
  for (const iv of lista) {
    const ultimo = fusion[fusion.length - 1];
    if (ultimo && iv[0] <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], iv[1]);
    else fusion.push([...iv]);
  }
  return fusion;
}

// Estado en este momento:
//   { abierto: true,  siempre: true }                                   abierto 24/7
//   { abierto: true,  cambio: { tipo: 'cierra', hora, en_dias, dia_semana }, minutos_para_cambio }
//   { abierto: false, cambio: { tipo: 'abre',   hora, en_dias, dia_semana }, minutos_para_cambio }
//   { abierto: false, cambio: null }                                     cerrado todos los días
// en_dias: 0 = hoy, 1 = mañana, etc. (en hora de Chile), para que la interfaz arme el texto.
export function estadoHorario(horario, ahora = new Date()) {
  if (!horario) return { abierto: true, siempre: true, cambio: null, minutos_para_cambio: null };
  const { dia, minuto } = relojLocal(ahora);
  const ivs = intervalos(horario, dia);
  const actual = ivs.find(([a, b]) => a <= minuto && minuto < b);
  const describir = (tipo, enMinuto) => {
    const enDias = Math.floor(enMinuto / MIN_DIA);
    return { tipo, hora: aHHMM(enMinuto), en_dias: enDias, dia_semana: (((dia + enDias) % 7) + 7) % 7 };
  };
  if (actual) {
    // Un intervalo que llega al borde de la ventana calculada (más de una semana seguida abierto)
    // equivale a estar siempre abierto.
    if (actual[1] >= 8 * MIN_DIA) return { abierto: true, siempre: true, cambio: null, minutos_para_cambio: null };
    return { abierto: true, siempre: false, cambio: describir('cierra', actual[1]), minutos_para_cambio: actual[1] - minuto };
  }
  const siguiente = ivs.find(([a]) => a > minuto);
  if (!siguiente) return { abierto: false, siempre: false, cambio: null, minutos_para_cambio: null };
  return { abierto: false, siempre: false, cambio: describir('abre', siguiente[0]), minutos_para_cambio: siguiente[0] - minuto };
}

// Para reservar hay que poder llegar mientras está abierto: si cierra antes de que venza la
// reserva, el cupo quedaría apartado en un lugar cerrado.
export function motivoNoReservable(horario, minutosReserva, ahora = new Date()) {
  const e = estadoHorario(horario, ahora);
  if (!e.abierto) return 'El estacionamiento está cerrado en este momento.';
  if (!e.siempre && e.minutos_para_cambio < minutosReserva) {
    return `El estacionamiento cierra a las ${e.cambio.hora}, antes de que venza la reserva.`;
  }
  return null;
}
