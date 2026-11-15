import { useEffect, useState } from 'react';
import { api } from '../services/api.js';

// El monto y la duración de la reserva los fija el administrador (parámetros del sistema): se leen
// de la API una vez por visita en vez de tenerlos escritos en la interfaz. Mientras llegan (o si la
// API no responde) se muestran los valores por defecto.
export const RESERVA_POR_DEFECTO = { monto: 100, ttl_min: 10 };
let cache = null;

export function useReservaConfig() {
  const [cfg, setCfg] = useState(cache || RESERVA_POR_DEFECTO);
  useEffect(() => {
    if (cache) return;
    let vivo = true;
    Promise.resolve()
      .then(() => api.get('/payments/reserva-config'))
      .then(r => {
        if (typeof r?.data?.monto !== 'number' || typeof r?.data?.ttl_min !== 'number') return;
        cache = r.data;
        if (vivo) setCfg(r.data);
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);
  return cfg;
}
