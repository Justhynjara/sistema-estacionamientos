import 'dotenv/config';

const defaultClientUrls = [
  'http://localhost:5173',
  'http://localhost',
  'https://localhost',
  'capacitor://localhost'
];

export const env = {
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
    from: process.env.SMTP_FROM || 'Sistema de Estacionamientos <no-reply@estacionamientos.local>'
  },
  webpay: {
    commerceCode: process.env.WEBPAY_COMMERCE_CODE || '',
    apiKey: process.env.WEBPAY_API_KEY || '',
    env: process.env.WEBPAY_ENV || 'integration',
    returnUrl: process.env.WEBPAY_RETURN_URL || 'http://localhost:3000/api/payments/webpay/return'
  }
};
