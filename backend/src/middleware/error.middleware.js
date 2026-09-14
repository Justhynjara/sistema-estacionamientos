import { ZodError } from 'zod';
import { logger } from '../config/logger.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Recurso no encontrado' });
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
  res.status(err.status || 500).json({ error: 'Ocurrió un error inesperado en el servidor' });
}
