var gameObj = function() {

  var identity = this;
  var socket = io();

  socket.on('disconnect', function(data) {
    window.alert("Connection ended unexpectedly");
    // simulates http redirect to reload page without add to session history
    location.href = location.href.replace(location.hash,"");
  });

  socket.on('error', function(data) {
    window.alert(data);
    location.href = location.href.replace(location.hash,"");
  });

  socket.on('errorMsg', function(data) {
    window.alert("Error: ",data.msg);
    location.href = location.href.replace(location.hash,"");
  });
  
  var timeAtPing;
  var latency;

  socket.on('pong', function() {
    latency = Date.now() - timeAtPing;
  });

  var checkLatency = function() {
    setTimeout(function() {
      timeAtPing = Date.now();
      socket.emit('ping');
      checkLatency();
    }, 2000);
  };

  // latency will be checked every 2 seconds on each client
  checkLatency();

  









  this.getSocket = function() {
    return socket;
  };

  return this;
};

gameObj.prototype.getSocket = function() {
  return this.getSocket();
};