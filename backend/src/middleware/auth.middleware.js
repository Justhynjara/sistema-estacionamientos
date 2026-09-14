import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function auth(req,res,next){
  const header=req.headers.authorization;
  if(!header?.startsWith('Bearer ')) return res.status(401).json({error:'Token requerido'});
  try {
    req.user=jwt.verify(header.slice(7), env.jwtSecret);
    next();
  } catch { res.status(401).json({error:'Token inválido'}); }
}
