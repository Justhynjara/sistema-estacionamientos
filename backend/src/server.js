import http from 'http';
import {Server} from 'socket.io';
import {app,corsOrigin} from './app.js';
import {env,problemasDeConfiguracion} from './config/env.js';
import {logger} from './config/logger.js';
import {runMigrations} from './db/migrate.js';
import {registerSockets} from './sockets/parking.socket.js';
import {setIO} from './sockets/io.js';
import {startReservationSweeper} from './services/ticket.service.js';
import {startPaymentSweeper} from './services/payment.service.js';
import {auditarSeguridadInicial} from './services/seguridad.service.js';

const server=http.createServer(app);
const io=new Server(server,{cors:{origin:corsOrigin}});
setIO(io);
registerSockets(io);

async function start(){
  // Antes de nada: en producción no se arranca con secretos inseguros (p. ej. JWT_SECRET sin
  // definir, que caería a un valor público con el que cualquiera forjaría un token de ADMIN).
  // En desarrollo se deja pasar para no estorbar.
  if(env.isProduction){
    const problemas=problemasDeConfiguracion();
    if(problemas.length){
      logger.error({problemas},'SEGURIDAD: configuración insegura, no se arranca en producción');
      process.exit(1);
    }
  }
  try{
    await runMigrations();
    logger.info('Migraciones de base de datos aplicadas');
  }catch(err){
    logger.error({err},'Error aplicando migraciones');
    process.exit(1);
  }
  startReservationSweeper(logger);
  startPaymentSweeper(logger);
  auditarSeguridadInicial(logger).catch(err=>logger.error({err},'No se pudo auditar la configuración de seguridad'));
  server.listen(env.port,()=>logger.info(`API en puerto ${env.port}`));
}

start();
