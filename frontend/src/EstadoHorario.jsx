import { textoEstado } from './utils/horario.js';

// "Abierto · cierra a las 20:00" / "Cerrado · abre mañana a las 08:00". El color acompaña al texto,
// nunca lo reemplaza: la palabra Abierto/Cerrado siempre está escrita.
export default function EstadoHorario({ estado }) {
  const t = textoEstado(estado);
  if (!t) return null;
  return (
    <span className={'estado-horario ' + (t.abierto ? 'abierto' : 'cerrado')}>
      <b>{t.etiqueta}</b> · {t.detalle}
    </span>
  );
}
