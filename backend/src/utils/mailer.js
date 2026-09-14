import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const transporter = env.smtp.host
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined
    })
  : null;

export async function sendMail({ to, subject, html }) {
  if (!transporter) {
    logger.info({ to, subject, html }, 'SMTP no configurado: correo simulado (ver detalle en este log)');
    return { simulated: true };
  }
  return transporter.sendMail({ from: env.smtp.from, to, subject, html });
}
