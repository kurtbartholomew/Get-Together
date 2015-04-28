var socket = io();

socket.on('pong', function(data) {
  console.log(data.greeting);
});

socket.emit('ping', { user:'Jimbo' });