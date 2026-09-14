import http from 'http';
import {Server} from 'socket.io';
import {app,corsOrigin} from './app.js';
import {env} from './config/env.js';
import {logger} from './config/logger.js';
import {runMigrations} from './db/migrate.js';
import {registerSockets} from './sockets/parking.socket.js';
import {setIO} from './sockets/io.js';
import {startReservationSweeper} from './services/ticket.service.js';

const server=http.createServer(app);
const io=new Server(server,{cors:{origin:corsOrigin}});
setIO(io);
registerSockets(io);

async function start(){
  try{
    await runMigrations();
    logger.info('Migraciones de base de datos aplicadas');
  }catch(err){
    logger.error({err},'Error aplicando migraciones');
    process.exit(1);
  }
  startReservationSweeper(logger);
  server.listen(env.port,()=>logger.info(`API en puerto ${env.port}`));
}

start();
