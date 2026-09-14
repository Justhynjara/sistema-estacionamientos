import TransbankSDK from 'transbank-sdk';
import { env } from '../config/env.js';

const { WebpayPlus, Options, IntegrationCommerceCodes, IntegrationApiKeys, Environment } = TransbankSDK;

function buildOptions() {
  if (env.webpay.commerceCode && env.webpay.apiKey) {
    const environment = env.webpay.env === 'production' ? Environment.Production : Environment.Integration;
    return new Options(env.webpay.commerceCode, env.webpay.apiKey, environment);
  }
  // Credenciales públicas de integración/pruebas publicadas por Transbank (sin costo, sin cuenta de comercio real).
  return new Options(IntegrationCommerceCodes.WEBPAY_PLUS, IntegrationApiKeys.WEBPAY, Environment.Integration);
}

export function webpayTransaction() {
  return new WebpayPlus.Transaction(buildOptions());
}
