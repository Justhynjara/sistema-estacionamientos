export function registerSockets(io){
  io.on('connection',socket=>{
    socket.on('joinParking',id=>socket.join(`parking:${id}`));
    socket.on('leaveParking',id=>socket.leave(`parking:${id}`));
  });
}
