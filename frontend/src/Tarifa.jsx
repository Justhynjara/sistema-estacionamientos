import { formatCLP } from './utils/tarifa.js';

// La tarifa como se lee en el letrero de la entrada: las cifras en la tipografía de datos y las
// palabras en la del texto, para que "$20/min · mínimo $500" no se lea como un bloque de código.
export default function Tarifa({ precio_minuto, tarifa_minima }) {
  return (
    <span className="tarifa">
      <span className="num">{formatCLP(precio_minuto)}</span>/min
      {Number(tarifa_minima) > 0 && <> · mínimo <span className="num">{formatCLP(tarifa_minima)}</span></>}
    </span>
  );
}
