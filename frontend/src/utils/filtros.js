import { costoEstimado } from './tarifa.js';

// Filtros de la búsqueda de estacionamientos. Se aplican sobre lo que ya devolvió la API (hasta 8
// resultados), así que cambiarlos no vuelve a consultar al servidor.
export const FILTROS_INICIALES = { soloAbiertos: false, soloConCupos: false, orden: 'distancia', horas: 2 };
export const HORAS_ESTADIA = [1, 2, 3, 4];

const abierto = p => (p.horario_estado ? p.horario_estado.abierto : true);

export function hayFiltrosActivos(f) {
  return f.soloAbiertos || f.soloConCupos;
}

// Filtra, ordena y numera. El número es el que se ve en la lista y en el marcador del mapa, por
// eso se asigna después de ordenar: el 1 siempre es el primero de la lista.
export function aplicarFiltros(parkings, f) {
  const visibles = parkings.filter(p =>
    (!f.soloAbiertos || abierto(p)) && (!f.soloConCupos || p.cupos_disponibles > 0));
  const ordenados = f.orden === 'precio'
    // A igual precio manda la distancia; sort es estable, así que basta comparar el costo.
    ? [...visibles].sort((a, b) => costoEstimado(a, f.horas) - costoEstimado(b, f.horas))
    : visibles;
  return ordenados.map((p, i) => ({ ...p, n: i + 1, costo: costoEstimado(p, f.horas) }));
}
