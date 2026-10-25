import 'dotenv/config';

const defaultClientUrls = [
  'http://localhost:5173',
  'http://localhost',
  'https://localhost',
  'capacitor://localhost'
];

export const env = {
  // Render define RENDER=true en sus servicios; NODE_ENV cubre otros hostings.
  isProduction: process.env.NODE_ENV === 'production' || !!process.env.RENDER,
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || 'dev_secret',
  clientUrls: process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map(s => s.trim())
    : defaultClientUrls,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'Estacionados <no-reply@estacionamientos.local>'
  },
  // Alerta opcional de errores 500: URL de un webhook entrante de Slack, o de Discord
  // agregando "/slack" al final de su URL de webhook (Discord entiende el formato de Slack).
  errorWebhookUrl: process.env.ERROR_WEBHOOK_URL || '',
  webpay: {
    commerceCode: process.env.WEBPAY_COMMERCE_CODE || '',
    apiKey: process.env.WEBPAY_API_KEY || '',
    env: process.env.WEBPAY_ENV || 'integration',
    returnUrl: process.env.WEBPAY_RETURN_URL || 'http://localhost:3000/api/payments/webpay/return'
  }
};

// Varios valores tienen un valor por defecto cómodo para desarrollo (JWT_SECRET cae a 'dev_secret',
// la base no tiene URL, etc.). En producción esos defaults son peligrosos: con 'dev_secret', que
// está en el repositorio, cualquiera podría firmar un token de ADMIN y entrar como quien quiera.
// Antes esto solo se advertía en los logs y el servidor arrancaba igual. Esta función lista los
// problemas para que el arranque (server.js) aborte en vez de quedar corriendo inseguro.
// El secreto del JWT también protege las cotizaciones (cotizacion.js deriva su clave de él).
// Webpay no se valida aquí a propósito: sin credenciales cae a las públicas de integración de
// Transbank (pruebas, sin dinero real), que es un estado válido, no un secreto filtrado.
export function problemasDeConfiguracion(e = env) {
  const problemas = [];
  if (!e.jwtSecret || e.jwtSecret === 'dev_secret')
    problemas.push('JWT_SECRET no está definido (usa el valor de desarrollo "dev_secret", que es público).');
  else if (e.jwtSecret.length < 32)
    problemas.push('JWT_SECRET tiene menos de 32 caracteres: debe ser largo y aleatorio.');
  if (!e.databaseUrl)
    problemas.push('DATABASE_URL no está definido.');
  return problemas;
}
