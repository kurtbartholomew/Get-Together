var server = function(ioServer) {
  ioServer.on('connection', function(socket){
    console.log("A player has connected");

    socket.on('ping', function(data){
      console.log("Name: ", data.user);
      socket.emit('pong', { greeting: 'HELLO!' });
    });
    
  });
  
};

module.exports = server;