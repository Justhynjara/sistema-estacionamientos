// Tarifa por minuto con valor base mínimo: se cobra el mayor entre el mínimo y (minutos × precio por minuto).
// Los minutos se redondean hacia arriba (cualquier fracción cuenta como minuto completo, mínimo 1)
// y el total en pesos también, para no cobrar de menos ni trabajar con centavos.
export function calcularTarifa(fechaEntrada, precioMinuto, tarifaMinima, ahora = Date.now()) {
  const minutos = Math.max(1, Math.ceil((ahora - new Date(fechaEntrada).getTime()) / 60000));
  // Se redondea a décimas de peso antes del ceil: evita que 0.1 × 3 dé 0.30000000000000004 → 1, y que un
  // precio por hora convertido a minuto (1000/60 = 16.6667) cobre $1 de más al completar horas enteras.
  const porTiempo = Math.ceil(Math.round(minutos * Number(precioMinuto) * 10) / 10);
  return { minutos, bruto: Math.max(Number(tarifaMinima), porTiempo) };
}
