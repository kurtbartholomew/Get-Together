var server = function(ioServer) {

  var timeOutDelay = 2500;
  var maxPlayers = 4;
  var runningGameIds = []; // id's of currently running games
  var clientPlayers = {}; // keeps track of which number out of four a player is
  var clients = {}; // stores a socket id with a value of the room they are in
  var hosts = {}; // stores a socket id with a value of true to represent their host status


  var contains = function(element, array) {
    return array.indexOf(element) > -1;
  };

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
  };

  /**
   * Checks if a room exists in the root namespace
   * @return {[Boolean]} [True/false test of room existence]
   */
  var roomExists = function(room) {
    return ioServer.nsps["/"].adapter.rooms[room] !== undefined;
  };

  /**
   * Retrieves the information of a socket connected
   * to main instance
   * @param  {[String]} socketId [id of a socket]
   * @return {[Object]}          [a socket object]
   */
  var getSocket = function(socketId) {
    return ioServer.sockets.connected[socketId];
  };

  /**
   * Retrieves an object containing socket id's as keys
   * @param  {[String]} room [A room id]
   * @return {[String]}      [An object with socket id's]
   */
  var getRoom = function(room) {
    return ioServer.nsps["/"].adapter.rooms[room];
  };

  /**
   * Given a room id, retrieves a hash of socket id's in
   * currently in that room (or an empty array if undefined).
   * If defined, takes the values of the hash and returns them.
   * @param  {[String]} room [ A room's id]
   * @return {[String]}      [An array of socket id's]
   */
  var socketsInRoom = function(room) {
    if (ioServer === undefined) {
        console.log("ioServer is undefined");
    }

    if (ioServer.nsps["/"] === undefined) {
        console.log("Root namespace is undefined");
    }

    if (ioServer.nsps["/"].adapter === undefined) {
        console.log("adapter is undefined");
    }

    if (ioServer.nsps["/"].adapter.rooms === undefined) {
        console.log("rooms is undefined ");
    }

    var r = getRoom(room);
    if (typeof r === 'object') {
        return Object.keys(r);
    }
    else {
        return [];
    }
  };

  var sendError = function(message, socket, room) {
    if (room !== undefined) {
      socket = socket.to(room);
    }
    socket.emit('errorMsg', { msg: message });
    console.log("Error: ", message);
  };

  var startTimeOut = function(room, playerCounter, times) {
    playerCounter = playerCounter || 0;
    times = times || 0;

    var players = socketsInRoom(room);

    if (times > 3) {
      return;
    } else if (playerCounter >= maxPlayers) {
      startTimeOut(room, 0, ++times);
    } else {
      var socketId = players[playerCounter];
      var socketObj = ioServer.sockets.connected[players[playerCounter]];
      if (socketObj !== undefined) {
        console.log('ticking... '+times+' '+ socketId);
        socketObj.emit('timeOut', {times: times}, function(socketId){
          console.log('ticking back... '+times+' '+ socketId);
          startTimeOut(room, ++playerCounter, times);
        });
      } else {
        console.log("Error finding socket during timeout check: ",socketId);
      }
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
          ack(room); 
          console.log('Host '+ socket.id + ' has connected');
          console.log("Hosting in room ",room);
        } else {
          console.log("An error has occurred: ",err);
          sendError("Host: can't join room", socket);
        }
      });
    });

    socket.on('join', function(data,ack){
      var room = data;
      if(roomExists(room)) {
        var numOfPlayers = socketsInRoom(room).length;
        //if( numOfPlayers < 1) { sendError("That room doesn't exist", socket); }
        if ( numOfPlayers > 0 && numOfPlayers <= maxPlayers){
          socket.join(room, function (err) {
            if (!err) {
              clients[socket.id] = room;
              var players = socketsInRoom(room);
              clientPlayers[socket.id] = players.length -1;
              ack({ playersCount: players.length});
              console.log('client ' + socket.id + ' connected to room ' + room + ' (' + players.length + '/'+maxPlayers+')');
              ioServer.to(room).emit('joined', { playersCount: players.length });
            } else {
              console.log("Error occurred: ",err);
              sendError("Client: Error joining room", socket);
            }
          });
        } else {
          console.log(room, " is inaccessible");
          sendError("That room is inaccessible", socket);
        }
      } else {
        console.log(room, " does not exist");
        sendError("That room does not exist", socket);
      } 
    });



    socket.on('startCounting', function(socketId) {
      var room = clients[socketId];
      var players = socketsInRoom(room);

      if (players.length === maxPlayers) {
        setTimeout(function() {
          startTimeOut(room);
        }, timeOutDelay);
      } else {
        sendError("Other players have timed out: ", socket, room); 
      }
    });

    socket.on('disconnect', function() {
      var p = clientPlayers[socket.id];
      clientPlayers[socket.id] = null;
      delete clientPlayers[socket.id];

      var room = clients[socket.id];
      clients[socket.id] = null;
      delete clients[socket.id];

      var currentPlayers = socketsInRoom(room);

      if (room !== null && currentPlayers.length > 0) {
        ioServer.to(room).emit('playerLeft', { playerLeft: p, playersCount: currentPlayers.length});
        
        // if disconnecting player is host and there are players left...
        if(hosts[socket.id] && currentPlayers.length > 1) {
          hosts[socket.id] = false; 
          delete hosts[socket.id];

          var newSocketId = currentPlayers[Math.floor(Math.random() * currentPlayers.length)];
          hosts[newSocketId] = true;

          getSocket(newSocketId).emit('makeHost');
        } else if ( currentPlayers.length === 1 ) {
          sendError("Sorry, you can't play with yourself", socket, room);
        }
      } else {
        if( runningGameIds[room] !== undefined) {
          delete runningGameIds[room];
        }
        //console.log("Room "+room+" has been removed");
      }
    });

    socket.on('ping', function(data){
      socket.emit('pong');
    });

    socket.on('gameUpdate', function(data) {
      var room = clients[data.socketId];
      delete data.socketId;
      ioServer.to(room).emit('clientUpdate', data);
    });

    socket.on('gameScoreUpdate', function(data) {
      var room = clients[data.socketId];
      delete data.socketId;
      ioServer.to(room).emit('clientUpdateScores', data);
    });

    socket.on('gameBallUpdate', function(data) {
      var room = clients[data.socketId];
      delete data.socketId;
      ioServer.to(room).emit('clientUpdateBall', data);
    });
  });
};

module.exports = server;