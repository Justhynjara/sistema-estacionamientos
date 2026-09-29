import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
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

// Render sirve la API detrás de un proxy/edge (Cloudflare); sin esto, express-rate-limit
// y cualquier lógica basada en req.ip no vería la IP real del cliente.
app.set('trust proxy', 1);

// Render/Cloudflare ya redirige http->https en el borde, pero si algún día la API se sirve
// directo (otro proxy, otro hosting) esto la protege igual: nunca sirve una petición en claro.
if(env.isProduction){
  app.use((req,res,next)=>{
    if(req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto']!=='https')
      return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    next();
  });
}

app.use(helmet({
  hsts: { maxAge: 15552000, includeSubDomains: true, preload: true }
}));
// Permissions-Policy: apaga cámara/micrófono/geolocalización/pagos para este origen. Helmet 8 ya
// no incluye este header (lo tuvo como "Feature-Policy" en versiones viejas); nada en la propia
// API los necesita — el navegador los usa desde la web, para el escáner QR y el mapa, no desde aquí.
app.use((req,res,next)=>{
  res.setHeader('Permissions-Policy','camera=(),microphone=(),geolocation=(),payment=()');
  next();
});
app.use(pinoHttp({logger, autoLogging:{ignore:req=>req.url==='/health'}}));
// credentials:true (junto con withCredentials en el frontend) permite que el navegador mande y
// reciba la cookie de sesión entre estacionamientos-web.onrender.com y esta API — dominios
// distintos, así que sin esto la cookie nunca llegaría.
app.use(cors({origin:corsOrigin, credentials:true}));
app.use(cookieParser());
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
