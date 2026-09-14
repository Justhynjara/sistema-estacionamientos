import {Router} from 'express';
import {auth} from '../middleware/auth.middleware.js';
import {roles} from '../middleware/role.middleware.js';
import {validateBody} from '../middleware/validate.middleware.js';
import {startPayment,confirmPayment} from '../services/payment.service.js';
import {startPaymentSchema} from '../validation/payment.schema.js';
import {env} from '../config/env.js';
import {logger} from '../config/logger.js';

const r=Router();

r.post('/webpay/start',auth,roles('CLIENTE'),validateBody(startPaymentSchema),async(req,res)=>{
  try{res.json(await startPayment(req.body.codigo_qr,req.user.id));}
  catch(e){res.status(400).json({error:e.message});}
});

// Transbank redirige aquí tras el pago (normalmente POST, a veces GET según el paso del flujo),
// tanto si fue exitoso como si el usuario lo canceló.
async function handleWebpayReturn(req,res){
  const token=req.body?.token_ws || req.query?.token_ws;
  if(!token){
    // TBK_TOKEN presente = el usuario abortó el pago en Webpay.
    return res.redirect(`${env.frontendUrl}/?pago=cancelado`);
  }
  try{
    const {aprobado,monto}=await confirmPayment(token);
    res.redirect(`${env.frontendUrl}/?pago=${aprobado?'aprobado':'rechazado'}&monto=${Math.round(monto)}`);
  }catch(e){
    logger.error({err:e},'Error confirmando pago Webpay');
    res.redirect(`${env.frontendUrl}/?pago=error`);
  }
}
r.post('/webpay/return',handleWebpayReturn);
r.get('/webpay/return',handleWebpayReturn);

export default r;
