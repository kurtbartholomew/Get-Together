var server = function(ioServer) {
  ioServer.on('connection', function(socket){
    socket.emit('news', {hello: 'world'});

    ioServer.on('my_other_event', function(data){
      console.log(data);
    });
  });
  
};

module.exports = server;