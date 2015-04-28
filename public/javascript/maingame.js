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

  var gameDiv = "game";  
  var gameWidth = +document.getElementById(gameDiv);
  var gameHeight = +document.getElementById(gameDiv);

  var Game = new Phaser(gameWidth, gameHeight, Phaser.AUTO, gameDiv, null, false, false);

  var host = false;
  var paddles = [];
  var sprites;
  var ball;

  var currentPlayer = -1;
  var master = false;
  var cursorts;

  var colors = []; // TODO: Fill this in with colors for paddles

  var ballSize = 10;
  var halfBallSize = ballSize / 2;
  var padSize = 8;
  var halfPadSize = padSize / 2;
  var moveFactor = 5;
  var maxScore = 10;

  var BootingState = function() {
    var preload = function() {
      // load a sprite to show to indicate loading
    };
    var create = function() {
      game.state.start('preload');
    };
  };

  var LoadingState = function() {
    preload: function() {
      game.stage.disableVisibilityChange = true;

      // create a sprite for the loading 
      
      game.load.image('ball', /* path to ball image */)
    },
    create: function() {
      // destroy loading sprite
      
      game.physics.startSystem(Phaser.Physics.ARCADE);

      // create a group of sprites so they can be instantiated together
      sprites = game.add.group();

      ball = sprites.create(game.world.centerX - halfBallSize, game.world.centerY - halfBallSize, 'ball')
      ball.name = 'ball';
      // scales ball's X and Y to declared ballScaleSize
      ball.scale.setTo(ballSize, ballSize);
      // sets center of ball to its midpoint
      ball.anchor.setTo(0.5,0.5);

      game.physics.enable([ball], Phaser.Physics.ARCADE);
      var sign = game.rnd.integerInRange(0,1) == 0 ? 1 : -1;
      ball.body.velocity.x = game.rnd.integerInRange(100, 250) * sign;
      ball.body.velocity.y = game.rnd.integerInRange(100, 250) * sign;
      ball.body.bounce.x = 1;
      ball.body.bounce.y = 1;
      ball.body.minBounceVelocity = 0;
      ball.player = -1;

      paddles = [];
      paddles.push(sprites.create(game.world.centerX - halfPadSize, halfPadSize, 'ball'))
      paddles.push(sprites.create(halfPadSize, game.world.height / 2 - halfPadSize,'ball'));
      paddles.push(sprites.create(game.world.centerX - halfPadSize,game.world.height - halfPadSize,'ball'));
      paddles.push(sprites.create(game.world.width - halfPadSize,game.world.centerY - halfPadSize,'ball'));

      paddles[0].tint = 0xff0000;
      paddles[1].tint = 0x00ff00;
      paddles[2].tint = 0x0000ff;
      paddles[3].tint = 0xffff00;

      for(var i in paddles) {
        paddles[i].op = paddles[i].position;
        paddles[i].player = i;
        paddles[i].name = "Player "+ (parseInt(i) + 1);
        if(i % 2 == 0) {
          paddles[i].scale.setTo(padSize* 10, 10);
        } else {
          paddles[i].scale.setTo(10, padSize * 10);
        }
        paddles[i].anchor.setTo(0.5,0.5);
        games.physics.enable([ paddles[i] ], Phaser.Physics.ARCADE);
        paddles[i].body.bounce.x = 1;
        paddles[i].body.bounce.y = 1;
        paddles[i].body.minBounceVelocity = 0;
        paddles[i].body.immovable = true;
        paddles[i].body.collideWorldBounds = true;
      }
    },
    update: function() {
      game.physics.arcade.collide(ball, paddles, function(ball, player){
        ball.tint = player.tint;
      });
    }
  };

  var SyncState = function() {

  };

  var GameState = function() {

  };

  game.state.add("bootup", BootingState, true);
  game.state.add("preload", LoadingState);
  game.state.add("sync", SyncState);
  game.state.add("game", GameState, false);

  this.getSocket = function() {
    return socket;
  };

  this.switchToSync = function(data) {
    game.state.start("sync", false, false, data);
  }

  return this;
};

gameObj.prototype.getSocket = function() {
  return this.getSocket();
};

gameObj.prototype.sync = function(data) {
  this.switchToSync(data);
}