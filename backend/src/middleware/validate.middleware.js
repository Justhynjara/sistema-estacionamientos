export const validateBody = schema => (req, res, next) => {
  const r = schema.safeParse(req.body);
  if (!r.success) return res.status(400).json({ error: 'Datos inválidos', detalles: r.error.issues.map(i => ({ campo: i.path.join('.'), mensaje: i.message })) });
  req.body = r.data;
  next();
};

export const validateQuery = schema => (req, res, next) => {
  const r = schema.safeParse(req.query);
  if (!r.success) return res.status(400).json({ error: 'Parámetros inválidos', detalles: r.error.issues.map(i => ({ campo: i.path.join('.'), mensaje: i.message })) });
  req.query = r.data;
  next();
};

export const validateParams = schema => (req, res, next) => {
  const r = schema.safeParse(req.params);
  if (!r.success) return res.status(400).json({ error: 'Parámetros inválidos', detalles: r.error.issues.map(i => ({ campo: i.path.join('.'), mensaje: i.message })) });
  req.params = r.data;
  next();
};
