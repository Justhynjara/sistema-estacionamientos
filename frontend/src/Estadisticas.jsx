import { useEffect, useState } from 'react';
import { api } from './services/api.js';
import Icon from './Icon.jsx';
import { formatDuracion } from './utils/tarifa.js';
import { DIAS_SEMANA_ISO, variacion, etiquetaDia, formatPorcentaje, rangoFechas, clpCorto } from './utils/estadisticas.js';

const clp = n => `$${Number(n).toLocaleString('es-CL')}`;
const hh = h => String(h).padStart(2, '0');

// La flecha acompaña al texto con el signo; el color no es la única pista.
function Variacion({ actual, anterior }) {
  const v = variacion(actual, anterior);
  const flecha = v.tendencia === 'sube' ? '▲ ' : v.tendencia === 'baja' ? '▼ ' : '';
  return <small className={'variacion ' + v.tendencia}><span aria-hidden="true">{flecha}</span>{v.texto}</small>;
}

// Estadísticas de los últimos 7 o 30 días: lo cobrado por día, la comparación con el período
// anterior, la ocupación promedio y cuándo hay más movimiento.
export default function Estadisticas({ estacionamientoId, dias }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setError('');
    api.get('/tickets/estadisticas', { params: { estacionamiento_id: estacionamientoId || undefined, dias } })
      .then(r => { if (!cancelado) setData({ ...r.data, filtro: estacionamientoId }); })
      .catch(err => { if (!cancelado) setError(err.response?.data?.error || 'No se pudieron cargar las estadísticas.'); });
    return () => { cancelado = true; };
  }, [estacionamientoId, dias, recarga]);

  if (error) {
    return (
      <div className="card" role="alert">
        <p className="badge off" style={{ margin: 0 }}>{error}</p>
        <div className="row-form" style={{ marginTop: 8 }}>
          <button type="button" className="secondary" onClick={() => setRecarga(n => n + 1)}><Icon name="refresh" />Reintentar</button>
        </div>
      </div>
    );
  }
  if (!data || data.dias !== dias || data.filtro !== estacionamientoId) {
    return <p className="loading-line"><span className="spinner" />Cargando estadísticas...</p>;
  }

  const { total, anterior } = data;
  const maxCobrado = Math.max(1, ...data.porDia.map(d => d.cobrado));
  const mejorDia = data.porDia.reduce((m, d) => (d.cobrado > m.cobrado ? d : m), data.porDia[0]);
  const resumenGrafico = total.cobrado > 0
    ? `Cobrado por día en los últimos ${dias} días: ${clp(total.cobrado)} en total. El día con más cobros fue el ${etiquetaDia(mejorDia.fecha, mejorDia.dia_semana)}, con ${clp(mejorDia.cobrado)}.`
    : `Sin cobros en los últimos ${dias} días.`;
  // Con 30 barras no caben todas las fechas: se rotula una de cada cinco, contando desde hoy.
  const cadaCuanto = dias > 7 ? 5 : 1;

  return (
    <>
      <section className="tablero" aria-label={`Resumen de los últimos ${dias} días`}>
        <div className="celda">
          <h3>Cobrado en caja</h3>
          <p className="cifra">{clp(total.cobrado)}</p>
          <Variacion actual={total.cobrado} anterior={anterior.cobrado} />
          {total.ticketPromedio != null && <small>{total.cobros} {total.cobros === 1 ? 'cobro' : 'cobros'} · promedio {clp(total.ticketPromedio)}</small>}
        </div>
        <div className="celda">
          <h3>Vehículos ingresados</h3>
          <p className="cifra">{total.vehiculos}</p>
          <Variacion actual={total.vehiculos} anterior={anterior.vehiculos} />
          {total.permanenciaPromedioMin != null && <small>Permanencia promedio: {formatDuracion(total.permanenciaPromedioMin)}</small>}
        </div>
        <div className="celda">
          <h3>Ocupación promedio</h3>
          {data.ocupacionPromedio != null
            ? <><p className="cifra mediana">{formatPorcentaje(data.ocupacionPromedio)}</p><small>de los cupos, en promedio, durante el período</small></>
            : <p className="detalle">Sin cupos que medir</p>}
        </div>
        <div className="celda">
          <h3>Mayor movimiento</h3>
          {data.horaPico
            ? <>
                <p className="cifra mediana">{hh(data.horaPico.hora)}:00–{hh(data.horaPico.hora + 1)}:00</p>
                <small>
                  {data.horaPico.entradas} {data.horaPico.entradas === 1 ? 'entrada' : 'entradas'} en esa hora
                  {data.diaPico && ` · el día más activo es el ${DIAS_SEMANA_ISO[data.diaPico.dia_semana - 1].toLowerCase()}`}
                </small>
              </>
            : <p className="detalle">Sin movimiento en el período</p>}
        </div>
      </section>

      <div className="card">
        <h3>Cobrado por día</h3>
        <p className="muted small" style={{ margin: 0 }}>
          Del {rangoFechas(data.desde, data.hasta)}. La barra más oscura es el día con más cobros.
        </p>
        {total.cobrado === 0 ? (
          <p className="flujo-vacio">Sin cobros en estos {dias} días. Cuando cobres tickets, verás aquí lo recaudado cada día.</p>
        ) : (<>
          <div className={"flujo" + (dias <= 7 ? " con-valores" : "")} role="img" aria-label={resumenGrafico}>
            {data.porDia.map(d => (
              <div
                key={d.fecha}
                title={`${etiquetaDia(d.fecha, d.dia_semana)}: ${clp(d.cobrado)} · ${d.vehiculos} ${d.vehiculos === 1 ? 'vehículo' : 'vehículos'}`}
                className={'col' + (d.cobrado === 0 ? ' cero' : '') + (d.fecha === mejorDia.fecha ? ' pico' : '')}
              >
                {dias <= 7 && d.cobrado > 0 && (
                  // "mil" va en su propia línea: siete montos lado a lado no caben en un teléfono.
                  <b className="flujo-valor">{clpCorto(d.cobrado).replace(' mil', '')}{d.cobrado >= 1000 && <small>mil</small>}</b>
                )}
                <i style={{ height: `${Math.max(2, (d.cobrado / maxCobrado) * 100)}%` }} />
              </div>
            ))}
          </div>
          <div className="flujo-ejes" aria-hidden="true">
            {data.porDia.map((d, i) => (
              <span key={d.fecha}>
                {(data.porDia.length - 1 - i) % cadaCuanto === 0 ? (dias > 7 ? Number(d.fecha.slice(8)) : etiquetaDia(d.fecha, d.dia_semana)) : ''}
              </span>
            ))}
          </div>
        </>)}
      </div>
    </>
  );
}
