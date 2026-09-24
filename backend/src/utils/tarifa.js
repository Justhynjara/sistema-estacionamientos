// Tarifa por minuto con valor base mínimo: se cobra el mayor entre el mínimo y (minutos × precio por minuto).
// Los minutos se redondean hacia arriba (cualquier fracción cuenta como minuto completo, mínimo 1)
// y el total en pesos también, para no cobrar de menos ni trabajar con centavos.
export function calcularTarifa(fechaEntrada, precioMinuto, tarifaMinima, ahora = Date.now()) {
  const minutos = Math.max(1, Math.ceil((ahora - new Date(fechaEntrada).getTime()) / 60000));
  // Se redondea a centavos antes del ceil para que un precio como 0.1 × 3 no dé 0.30000000000000004 → 1.
  const porTiempo = Math.ceil(Math.round(minutos * Number(precioMinuto) * 100) / 100);
  return { minutos, bruto: Math.max(Number(tarifaMinima), porTiempo) };
}
