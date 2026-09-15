import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import {env} from './config/env.js';
import {logger} from './config/logger.js';
import authRoutes from './routes/auth.routes.js';
import parkingRoutes from './routes/parking.routes.js';
import ticketRoutes from './routes/ticket.routes.js';
import adminRoutes from './routes/admin.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import solicitudRoutes from './routes/solicitud.routes.js';
import {notFoundHandler,errorHandler} from './middleware/error.middleware.js';

export function corsOrigin(origin,callback){
  if(!origin || env.clientUrls.includes(origin)) return callback(null,true);
  callback(new Error('Origen no permitido'));
}

export const app=express();

app.use(pinoHttp({logger, autoLogging:{ignore:req=>req.url==='/health'}}));
app.use(cors({origin:corsOrigin}));
app.use(express.json({limit:'12mb'})); // las solicitudes de nuevos clientes incluyen fotos en base64
app.use(express.urlencoded({extended:true}));

app.get('/health',(req,res)=>res.json({ok:true,service:'estacionamientos-api'}));
app.use('/api/auth',authRoutes);
app.use('/api/parking',parkingRoutes);
app.use('/api/tickets',ticketRoutes);
app.use('/api/admin',adminRoutes);
app.use('/api/payments',paymentRoutes);
app.use('/api/solicitudes',solicitudRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
