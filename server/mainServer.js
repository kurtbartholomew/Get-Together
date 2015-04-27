var app = require('./app.js');
var http = require('http');
var server = http.createServer(app);
var io = require('socket.io')(server);
var gameServer = require('./gameServer.js')(io);

var port = process.env.PORT || 8000;

server.listen(port, function(){
  console.log("Listening on port %d", port);
});