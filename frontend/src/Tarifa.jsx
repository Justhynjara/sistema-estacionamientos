import { formatCLP, formatTramo } from './utils/tarifa.js';

// La tarifa como se lee en el letrero de la entrada: las cifras en la tipografía de datos y las
// palabras en la del texto, para que "$20/min · mínimo $500" no se lea como un bloque de código.
// Con tarifa por horario, cada tramo va después del precio base: "$20/min · 20:00–08:00 $10/min".
export default function Tarifa({ precio_minuto, tarifa_minima, tarifas_horario }) {
  return (
    <span className="tarifa">
      <span className="num">{formatCLP(precio_minuto)}</span>/min
      {(tarifas_horario || []).map(t => (
        <span className="tramo" key={t.desde}> · {formatTramo(t)} <span className="num">{formatCLP(t.precio_minuto)}</span>/min</span>
      ))}
      {Number(tarifa_minima) > 0 && <> · mínimo <span className="num">{formatCLP(tarifa_minima)}</span></>}
    </span>
  );
}
