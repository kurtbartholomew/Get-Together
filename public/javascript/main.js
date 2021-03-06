$(function() {

  var hash = false;
  if (window.location.hash.length > 0) {
    hash = window.location.has.substr(1);
  }

  var gameObject = new gameObj();
  var socket = gameObject.getSocket();

  $(".host-game").on('click', function(e){
    $(".main-menu-buttons").hide();
    $(".menu-host-interface").show();

    var $playerCount = $(".current-player-count");

    socket.on('joined', function(data) {
      data.playersCount = parseInt(data.playersCount);

      if( $playerCount.length > 0) {
        $playerCount.text(data.playersCount);
      }
      if( data.playersCount === 4) {
        $(".menu").hide();
        // moves user's game to the game's sync state
        gameObject.sync({ hosting: true, playersCount: data.playersCount });
      }
    });

    socket.on('playerLeft', function(data) {
      data.playersCount = parseInt(data.playersCount);

      if( $playerCount.length > 0) {
        $playerCount.text(data.playersCount);
      }
      if( data.playersCount === 4) {
        $(".menu").hide();
        // moves user's game to the game's sync state
        gameObject.sync({ hosting: true, playersCount: data.playersCount });
      }
    });

    // provides game id to host screen
    socket.emit('host', '', function(data) {
      $(".game-id").text(data);
    });
  });

  // shows client interface
  $(".join-game").on('click', function(){
    $(".main-menu-buttons").hide();
    $(".menu-client-interface").show();

    if (hash.length > 0) {
      $("#game-entry-id").val(hash);
    }

    // highlight the game id in input
  });

  $(".join-game-session").on('click',function(){
    $(".menu").hide();
    socket.emit('join', $("#game-id-entry").val().trim(), function(data){
      // moves user's game to the game's sync state
      gameObject.sync({ hosting: false, playersCount: parseInt(data.playersCount) });
    });
  });

  $(".game-restart-button").click(function() {
    socket.removeAllListeners('disconnect');
    socket.disconnect();
    location.href = location.href.replace(location.hash,"");
  });
  
  if(hash.length > 0) {
    $(".join-game").trigger('click');
  }
});

