import { pool } from '../config/database.js';

const ZONA = 'America/Santiago';

// Estadísticas de un período (los últimos N días, hoy incluido) para el dueño: lo cobrado y los
// vehículos de cada día, la comparación con los N días anteriores, la ocupación promedio y cuándo
// hay más movimiento. Igual que el dashboard diario, los días se cortan en hora de Chile, lo
// cobrado cuenta por la fecha del cobro y los vehículos por la fecha de entrada; las reservas que
// no llegaron (RESERVADO/CANCELADO) no son vehículos ingresados.
export async function ticketsEstadisticas(clienteId, estacionamientoId, dias) {
  const rango = await pool.query(
    `WITH hoy AS (SELECT (NOW() AT TIME ZONE '${ZONA}')::date AS d)
     SELECT (d - ($1::int - 1))::text AS primer_dia, d::text AS ultimo_dia,
            (d - ($1::int - 1))::timestamp AT TIME ZONE '${ZONA}' AS desde,
            (d + 1)::timestamp AT TIME ZONE '${ZONA}' AS hasta,
            (d - (2 * $1::int - 1))::timestamp AT TIME ZONE '${ZONA}' AS desde_anterior
     FROM hoy`,
    [dias]
  );
  const { primer_dia, ultimo_dia, desde, hasta, desde_anterior } = rango.rows[0];
  const filtro = `e.cliente_id=$1 AND ($2::uuid IS NULL OR t.estacionamiento_id=$2)`;
  const base = [clienteId, estacionamientoId || null];

  const [porDia, anterior, ocupacion, porHora, porDiaSemana, permanencia] = await Promise.all([
    pool.query(
      `WITH serie AS (
         SELECT generate_series($3::date, $4::date, interval '1 day')::date AS fecha
       ), cobros AS (
         SELECT (t.fecha_salida AT TIME ZONE '${ZONA}')::date AS fecha, SUM(t.monto) AS cobrado, COUNT(*)::int AS cobros
         FROM tickets t JOIN estacionamientos e ON e.id=t.estacionamiento_id
         WHERE ${filtro} AND t.estado='CERRADO' AND t.fecha_salida >= $5 AND t.fecha_salida < $6
         GROUP BY 1
       ), entradas AS (
         SELECT (t.fecha_entrada AT TIME ZONE '${ZONA}')::date AS fecha, COUNT(*)::int AS vehiculos
         FROM tickets t JOIN estacionamientos e ON e.id=t.estacionamiento_id
         WHERE ${filtro} AND t.estado IN ('ACTIVO','PAGADO','CERRADO') AND t.fecha_entrada >= $5 AND t.fecha_entrada < $6
         GROUP BY 1
       )
       SELECT s.fecha::text AS fecha, EXTRACT(ISODOW FROM s.fecha)::int AS dia_semana,
              COALESCE(c.cobrado,0) AS cobrado, COALESCE(c.cobros,0) AS cobros, COALESCE(en.vehiculos,0) AS vehiculos
       FROM serie s LEFT JOIN cobros c ON c.fecha=s.fecha LEFT JOIN entradas en ON en.fecha=s.fecha
       ORDER BY s.fecha`,
      [...base, primer_dia, ultimo_dia, desde, hasta]
    ),
    pool.query(
      `SELECT
         COALESCE(SUM(t.monto) FILTER (WHERE t.estado='CERRADO' AND t.fecha_salida >= $3 AND t.fecha_salida < $4),0) AS cobrado,
         COUNT(*) FILTER (WHERE t.estado IN ('ACTIVO','PAGADO','CERRADO') AND t.fecha_entrada >= $3 AND t.fecha_entrada < $4)::int AS vehiculos
       FROM tickets t JOIN estacionamientos e ON e.id=t.estacionamiento_id
       WHERE ${filtro} AND ((t.fecha_entrada >= $3 AND t.fecha_entrada < $4) OR (t.fecha_salida >= $3 AND t.fecha_salida < $4))`,
      [...base, desde_anterior, desde]
    ),
    // Ocupación = minutos-cupo usados / minutos-cupo disponibles en lo que va del período. Cada
    // ticket aporta solo el tramo que cae dentro del período (un auto que sigue dentro, hasta ahora).
    pool.query(
      `WITH ventana AS (SELECT $3::timestamptz AS desde, LEAST($4::timestamptz, NOW()) AS hasta),
       capacidad AS (
         SELECT COALESCE(SUM(e.cupo_maximo),0) AS cupos
         FROM estacionamientos e
         WHERE e.cliente_id=$1 AND ($2::uuid IS NULL OR e.id=$2) AND e.estado=true
       ), usado AS (
         SELECT COALESCE(SUM(EXTRACT(EPOCH FROM
                  GREATEST(interval '0', LEAST(COALESCE(t.fecha_salida, NOW()), v.hasta) - GREATEST(t.fecha_entrada, v.desde))
                )),0) AS segundos
         FROM tickets t JOIN estacionamientos e ON e.id=t.estacionamiento_id, ventana v
         WHERE ${filtro} AND t.estado IN ('ACTIVO','PAGADO','CERRADO')
           AND t.fecha_entrada < v.hasta AND COALESCE(t.fecha_salida, NOW()) > v.desde
       )
       SELECT c.cupos, u.segundos, EXTRACT(EPOCH FROM (v.hasta - v.desde)) AS segundos_periodo
       FROM capacidad c, usado u, ventana v`,
      [...base, desde, hasta]
    ),
    pool.query(
      `SELECT EXTRACT(HOUR FROM t.fecha_entrada AT TIME ZONE '${ZONA}')::int AS hora, COUNT(*)::int AS entradas
       FROM tickets t JOIN estacionamientos e ON e.id=t.estacionamiento_id
       WHERE ${filtro} AND t.estado IN ('ACTIVO','PAGADO','CERRADO') AND t.fecha_entrada >= $3 AND t.fecha_entrada < $4
       GROUP BY 1`,
      [...base, desde, hasta]
    ),
    pool.query(
      `SELECT EXTRACT(ISODOW FROM t.fecha_entrada AT TIME ZONE '${ZONA}')::int AS dia_semana, COUNT(*)::int AS entradas
       FROM tickets t JOIN estacionamientos e ON e.id=t.estacionamiento_id
       WHERE ${filtro} AND t.estado IN ('ACTIVO','PAGADO','CERRADO') AND t.fecha_entrada >= $3 AND t.fecha_entrada < $4
       GROUP BY 1`,
      [...base, desde, hasta]
    ),
    pool.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (t.fecha_salida - t.fecha_entrada))/60) AS minutos
       FROM tickets t JOIN estacionamientos e ON e.id=t.estacionamiento_id
       WHERE ${filtro} AND t.estado='CERRADO' AND t.fecha_salida >= $3 AND t.fecha_salida < $4`,
      [...base, desde, hasta]
    )
  ]);

  const serie = porDia.rows.map(r => ({ fecha: r.fecha, dia_semana: r.dia_semana, cobrado: Number(r.cobrado), cobros: r.cobros, vehiculos: r.vehiculos }));
  const cobrado = serie.reduce((s, d) => s + d.cobrado, 0);
  const cobros = serie.reduce((s, d) => s + d.cobros, 0);
  const vehiculos = serie.reduce((s, d) => s + d.vehiculos, 0);

  const flujoPorHora = Array.from({ length: 24 }, (_, hora) => ({ hora, entradas: 0 }));
  porHora.rows.forEach(r => { flujoPorHora[r.hora].entradas = r.entradas; });
  const horaPico = flujoPorHora.reduce((max, h) => (h.entradas > max.entradas ? h : max), flujoPorHora[0]);
  // ISODOW: 1 = lunes … 7 = domingo.
  const flujoPorDiaSemana = Array.from({ length: 7 }, (_, i) => ({ dia_semana: i + 1, entradas: 0 }));
  porDiaSemana.rows.forEach(r => { flujoPorDiaSemana[r.dia_semana - 1].entradas = r.entradas; });
  const diaPico = flujoPorDiaSemana.reduce((max, d) => (d.entradas > max.entradas ? d : max), flujoPorDiaSemana[0]);

  const oc = ocupacion.rows[0];
  const disponible = Number(oc.cupos) * Number(oc.segundos_periodo);
  const ant = anterior.rows[0];

  return {
    dias,
    desde: primer_dia,
    hasta: ultimo_dia,
    porDia: serie,
    total: {
      cobrado,
      cobros,
      vehiculos,
      ticketPromedio: cobros > 0 ? Math.round(cobrado / cobros) : null,
      permanenciaPromedioMin: permanencia.rows[0].minutos != null ? Math.round(Number(permanencia.rows[0].minutos)) : null
    },
    anterior: { cobrado: Number(ant.cobrado), vehiculos: ant.vehiculos },
    // En porcentaje con un decimal; null si no hay cupos que medir.
    ocupacionPromedio: disponible > 0 ? Math.round((Number(oc.segundos) / disponible) * 1000) / 10 : null,
    flujoPorHora,
    horaPico: horaPico.entradas > 0 ? horaPico : null,
    flujoPorDiaSemana,
    diaPico: diaPico.entradas > 0 ? diaPico : null
  };
}
