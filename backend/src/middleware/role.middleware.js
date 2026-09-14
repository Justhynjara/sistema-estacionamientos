export const roles = (...allowed) => (req,res,next) => {
  if(!allowed.includes(req.user.rol)) return res.status(403).json({error:'Sin permisos'});
  next();
};
