import { Router } from 'express';
import { auth } from '../middleware/auth.middleware.js';
import { roles } from '../middleware/role.middleware.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.middleware.js';
import { reservaLimiter } from '../middleware/rateLimit.middleware.js';
import { crearSolicitud, listSolicitudes, getSolicitud, revisarSolicitud, marcarProcesada } from '../services/solicitud.service.js';
import { crearSolicitudSchema, revisarSolicitudSchema, listSolicitudesQuerySchema } from '../validation/solicitud.schema.js';
import { idParamSchema } from '../validation/common.schema.js';

const r = Router();

// Pública: cualquier interesado en ser cliente (dueño de estacionamiento) puede postular.
r.post('/', reservaLimiter, validateBody(crearSolicitudSchema), async (req, res) => {
  try { res.status(201).json(await crearSolicitud(req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

r.get('/', auth, roles('SOPORTE', 'ADMIN'), validateQuery(listSolicitudesQuerySchema), async (req, res) => {
  res.json(await listSolicitudes(req.query.estado));
});

r.get('/:id', auth, roles('SOPORTE', 'ADMIN'), validateParams(idParamSchema), async (req, res) => {
  try { res.json(await getSolicitud(req.params.id)); }
  catch (e) { res.status(404).json({ error: e.message }); }
});

// Soporte valida los requisitos y aprueba o rechaza la postulación.
r.patch('/:id/revision', auth, roles('SOPORTE'), validateParams(idParamSchema), validateBody(revisarSolicitudSchema), async (req, res) => {
  try { res.json(await revisarSolicitud(req.params.id, req.body.estado, req.body.comentario, req.user.id)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// Admin marca la solicitud como procesada una vez creó el usuario/estacionamiento correspondiente.
r.patch('/:id/procesar', auth, roles('ADMIN'), validateParams(idParamSchema), async (req, res) => {
  try { res.json(await marcarProcesada(req.params.id, req.user.id)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

export default r;
