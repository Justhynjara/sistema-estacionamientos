import {Router} from 'express';
import {auth} from '../middleware/auth.middleware.js';
import {roles} from '../middleware/role.middleware.js';
import {validateBody,validateQuery} from '../middleware/validate.middleware.js';
import {createTicket,closeTicket,reserveTicket,checkinTicket,ticketsDashboard,quoteTicket,activeTickets,getReservaPublica} from '../services/ticket.service.js';
import {createTicketSchema,reserveTicketSchema,closeTicketSchema,checkinSchema,dashboardQuerySchema,activeQuerySchema} from '../validation/ticket.schema.js';

const r=Router();

r.post('/',auth,roles('CLIENTE'),validateBody(createTicketSchema),async(req,res)=>{
  try{res.status(201).json(await createTicket(req.body.estacionamiento_id,req.body.patente,req.user.id));}
  catch(e){res.status(400).json({error:e.message});}
});

r.post('/close',auth,roles('CLIENTE'),validateBody(closeTicketSchema),async(req,res)=>{
  try{res.json(await closeTicket(req.body.codigo_qr,req.user.id));}
  catch(e){res.status(400).json({error:e.message});}
});

r.post('/quote',auth,roles('CLIENTE'),validateBody(closeTicketSchema),async(req,res)=>{
  try{res.json(await quoteTicket(req.body.codigo_qr,req.user.id));}
  catch(e){res.status(400).json({error:e.message});}
});

r.get('/active',auth,roles('CLIENTE'),validateQuery(activeQuerySchema),async(req,res)=>{
  res.json(await activeTickets(req.user.id, req.query.estacionamiento_id || null));
});

// Reserva manual (sin micropago): solo el dueño/personal del estacionamiento, ej. reservas telefónicas.
// El público en general reserva vía POST /payments/webpay/reserve-start (con micropago anti-reservas-falsas).
r.post('/reserve',auth,roles('CLIENTE'),validateBody(reserveTicketSchema),async(req,res)=>{
  try{res.status(201).json(await reserveTicket(req.body.estacionamiento_id,req.body.patente));}
  catch(e){res.status(400).json({error:e.message});}
});

// Consulta pública de una reserva por su código (usado tras volver del pago Webpay).
r.get('/reserva/:codigo_qr',async(req,res)=>{
  try{res.json(await getReservaPublica(req.params.codigo_qr));}
  catch(e){res.status(404).json({error:e.message});}
});

// Check-in de una reserva al llegar al estacionamiento: lo hace el dueño (o su personal).
r.post('/checkin',auth,roles('CLIENTE'),validateBody(checkinSchema),async(req,res)=>{
  try{res.json(await checkinTicket(req.body.codigo_qr,req.user.id));}
  catch(e){res.status(400).json({error:e.message});}
});

r.get('/dashboard',auth,roles('CLIENTE'),validateQuery(dashboardQuerySchema),async(req,res)=>{
  res.json(await ticketsDashboard(req.user.id, req.query.estacionamiento_id || null, req.query.fecha || null));
});

export default r;
