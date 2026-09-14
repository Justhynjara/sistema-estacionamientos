import {Router} from 'express';
import {auth} from '../middleware/auth.middleware.js';
import {roles} from '../middleware/role.middleware.js';
import {validateBody,validateQuery} from '../middleware/validate.middleware.js';
import {createTicket,closeTicket,reserveTicket,checkinTicket,ticketsDashboard} from '../services/ticket.service.js';
import {createTicketSchema,reserveTicketSchema,closeTicketSchema,checkinSchema,dashboardQuerySchema} from '../validation/ticket.schema.js';

const r=Router();

r.post('/',auth,roles('CLIENTE'),validateBody(createTicketSchema),async(req,res)=>{
  try{res.status(201).json(await createTicket(req.body.estacionamiento_id,req.body.patente,req.user.id));}
  catch(e){res.status(400).json({error:e.message});}
});

r.post('/close',auth,roles('CLIENTE'),validateBody(closeTicketSchema),async(req,res)=>{
  try{res.json(await closeTicket(req.body.codigo_qr,req.user.id));}
  catch(e){res.status(400).json({error:e.message});}
});

// Reserva anticipada de cupo: pública, no requiere que el usuario final tenga cuenta.
r.post('/reserve',validateBody(reserveTicketSchema),async(req,res)=>{
  try{res.status(201).json(await reserveTicket(req.body.estacionamiento_id,req.body.patente));}
  catch(e){res.status(400).json({error:e.message});}
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
