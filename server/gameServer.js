var server = function(ioServer) {

  var timeOutDelay = 2500;
  var maxPlayers = 4;
  var runningGameIds = [];
  var clientPlayers = {};
  var clients = {}; // stores a socket id with a value of the room they are in
  var hosts = {}; // stores a socket id with a value of true to represent their host status


  var contains = function(element, array) {
    return array.indexOf(element) > -1;
  }

  /**
   * Creates a unique 4 character string of a radix 36 representation
   * of a number from 1 to 9 billion. 
   * @return {[String]} [a random string]
   */
  var createGameId = function() {
    var randomNum = (Math.random()*900000000).toString(36).substr(0,4);
    while(contains(randomNum,runningGameIds)) {
      randomNum = (Math.random()*900000000).toString(36).substr(0,4);
    }
    return randomNum;
  }

  /**
   * Checks if a room exists in the root namespace
   * @return {[Boolean]} [True/false test of room existence]
   */
  var roomExists = function() {
    return io.nsps["/"].adapter.rooms[room] != undefined;
  };

  /**
   * Retrieves the information of a socket connected
   * to main instance
   * @param  {[String]} socketId [id of a socket]
   * @return {[Object]}          [a socket object]
   */
  var getSocket = function(socketId) {
    return io.sockets.connected[socketId];
  };

  /**
   * Retrieves an object containing socket id's as keys
   * @param  {[String]} room [A room id]
   * @return {[String]}      [An object with socket id's]
   */
  var getRoom = function(room) {
    return io.nsps["/"].adapter.rooms[room];
  };

  /**
   * Given a room id, retrieves a hash of socket id's in
   * currently in that room (or an empty array if undefined).
   * If defined, takes the values of the hash and returns them.
   * @param  {[String]} room [ A room's id]
   * @return {[String]}      [An array of socket id's]
   */
  var socketsInRoom = function(room) {
    var sockets = getRoom(room);
    if (typeof sockets === 'object') {
      return Object.keys(sockets);
    } else {
      return [];
    }
  };

  ioServer.on('connection', function(socket){
    clients[socket.id] = null;
    
    socket.on('host', function(data,ack) {
      var room = createGameId();
      socket.join(room, function(err) {
        if (!err) {
          clientPlayers[socket.id] = 0;
          clients[socket.id] = room;
          hosts[socket.id] = true;
          ack(room); // TODO: Figure out what the hell this is...
          console.log('Host '+ socket.id + ' has connected');
        } else {
          console.log("An error has occurred: ",err);
          // TODO: Add the ability to send error messages to host/client
        }
      });
    });

    socket.on('join', function(data,ack){
      var room = data;
      if(roomExists(room)) {
        socket.join(room, function (err) {
          if (!err) {
            clients[socket.id] = room;
            var players = socketsInRoom(room);
            clientPlayers[socket.id] = players.length -1;
            ack({ playersCount: players.length});
            io.to(room).emit('joined', { playersCount: players.length });
          } // write an else to log error and explain client can't join room
        });
      } // write an else to explain to client room doesn't exist;
    });

    socket.on('gameUpdate', function(data) {
      var room = clients[data.socketId];
      delete data.socketId;
      io.to(room).emit('clientUpdate', data);
    });


    




    console.log("A player has connected");

    socket.on('ping', function(data){
      console.log("Name: ", data.user);
      socket.emit('pong', { greeting: 'HELLO!' });
    });
    
  });
  
};

module.exports = server;