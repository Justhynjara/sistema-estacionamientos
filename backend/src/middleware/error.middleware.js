import { ZodError } from 'zod';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Recurso no encontrado' });
}

// Alerta best-effort a Slack/Discord para errores 500 no controlados. No bloquea la respuesta
// al cliente ni falla el request si el webhook no está configurado o no responde.
function notifyErrorWebhook(err, req) {
  if (!env.errorWebhookUrl) return;
  const text = `🚨 Error 500 en estacionamientos-api\n*${req.method} ${req.originalUrl}*\n\`\`\`${String(err?.stack || err?.message || err).slice(0, 1500)}\`\`\``;
  fetch(env.errorWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  }).catch(() => {});
}

export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Datos inválidos',
      detalles: err.issues.map(i => ({ campo: i.path.join('.'), mensaje: i.message }))
    });
  }

  if (err.message === 'Origen no permitido' || String(err.message).startsWith('Origen no permitido')) {
    return res.status(403).json({ error: 'Origen no permitido' });
  }

  if (err.code === '23505') return res.status(409).json({ error: 'El registro ya existe' });
  if (err.code === '23503') return res.status(409).json({ error: 'Referencia inválida: el recurso relacionado no existe' });
  if (err.code === '22P02') return res.status(400).json({ error: 'Formato de dato inválido' });

  req.log?.error({ err }, 'Error no controlado') ?? logger.error({ err }, 'Error no controlado');
  notifyErrorWebhook(err, req);
  res.status(err.status || 500).json({ error: 'Ocurrió un error inesperado en el servidor' });
}
