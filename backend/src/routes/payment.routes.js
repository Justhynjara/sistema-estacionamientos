import {Router} from 'express';
import {startReservationPayment,confirmPayment} from '../services/payment.service.js';
import {startReservationPaymentSchema} from '../validation/payment.schema.js';
import {validateBody} from '../middleware/validate.middleware.js';
import {reservaLimiter} from '../middleware/rateLimit.middleware.js';
import {env} from '../config/env.js';
import {logger} from '../config/logger.js';

const r=Router();

// Micropago público (sin autenticación) para confirmar una reserva y evitar reservas falsas.
// Es el único cobro real por Webpay del sistema: el cobro al cerrar un ticket lo hace el
// cajero con su propio POS físico (ver POST /tickets/close, campo metodo_pago).
r.post('/webpay/reserve-start',reservaLimiter,validateBody(startReservationPaymentSchema),async(req,res)=>{
  try{res.json(await startReservationPayment(req.body.estacionamiento_id,req.body.patente));}
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
    const {aprobado,reembolsado,monto,buyOrder,codigoQr,error}=await confirmPayment(token);
    if(aprobado) return res.redirect(`${env.frontendUrl}/?pago=aprobado&reserva=${codigoQr}`);
    // Pago aprobado pero sin cupo: "reembolsado" si Webpay ya anuló el cargo; "sin_cupo" si la
    // anulación quedó pendiente (se reintenta sola), con la orden de compra para que el conductor
    // pueda reclamar con el mismo número que aparece en su comprobante de Webpay.
    if(error && reembolsado) return res.redirect(`${env.frontendUrl}/?pago=reembolsado&monto=${Math.round(monto)}`);
    if(error) return res.redirect(`${env.frontendUrl}/?pago=sin_cupo&monto=${Math.round(monto)}&orden=${encodeURIComponent(buyOrder)}`);
    res.redirect(`${env.frontendUrl}/?pago=rechazado&monto=${Math.round(monto)}`);
  }catch(e){
    logger.error({err:e},'Error confirmando pago Webpay');
    res.redirect(`${env.frontendUrl}/?pago=error`);
  }
}
r.post('/webpay/return',handleWebpayReturn);
r.get('/webpay/return',handleWebpayReturn);

export default r;
