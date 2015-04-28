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

      // use phaser physics on ball
      game.physics.enable([ball], Phaser.Physics.ARCADE);
      
      // help ball start bouncing in a random direction
      var sign = game.rnd.integerInRange(0,1) == 0 ? 1 : -1;
      ball.body.velocity.x = game.rnd.integerInRange(100, 250) * sign;
      ball.body.velocity.y = game.rnd.integerInRange(100, 250) * sign;
      
      // set effect of physics interactions on ball
      ball.body.bounce.x = 1;
      ball.body.bounce.y = 1;
      ball.body.minBounceVelocity = 0;


      ball.player = -1;

      // add paddles to sprite group and store their references in paddles
      paddles = [];
      // Set player sprite on bottom
      paddles.push(sprites.create(game.world.centerX - halfPadSize, halfPadSize, 'ball'))
      // Set player sprite on left
      paddles.push(sprites.create(halfPadSize, game.world.height / 2 - halfPadSize,'ball'));
      // Set player sprite on top
      paddles.push(sprites.create(game.world.centerX - halfPadSize,game.world.height - halfPadSize,'ball'));
      // Set player sprite on right
      paddles.push(sprites.create(game.world.width - halfPadSize,game.world.centerY - halfPadSize,'ball'));

      // color the different players
      paddles[0].tint = 0xff0000;
      paddles[1].tint = 0x00ff00;
      paddles[2].tint = 0x0000ff;
      paddles[3].tint = 0xffff00;

      // for each sprite
      for(var i in paddles) {
        // set the original position
        paddles[i].op = paddles[i].position;
        // give the player a number
        paddles[i].player = i;
        // give the player a name
        paddles[i].name = "Player "+ (parseInt(i) + 1);
        // if player number is even, expand the sprite's width
        // otherwise expand it's height
        if(i % 2 == 0) {
          paddles[i].scale.setTo(padSize* 10, 10);
        } else {
          paddles[i].scale.setTo(10, padSize * 10);
        }
        // place the sprite's anchor point in the center
        paddles[i].anchor.setTo(0.5,0.5);

        //enable physics for each sprite
        games.physics.enable([ paddles[i] ], Phaser.Physics.ARCADE);
        
        // set physics interactions on sprite's rigid body
        paddles[i].body.bounce.x = 1;
        paddles[i].body.bounce.y = 1;
        paddles[i].body.minBounceVelocity = 0;
        paddles[i].body.immovable = true;

        // constrain sprite's rigid body inside canvas
        paddles[i].body.collideWorldBounds = true;
      }
    },
    update: function() {
      // when the ball collides, it change's to the color of that player
      game.physics.arcade.collide(ball, paddles, function(ball, player){
        ball.tint = player.tint;
      });
    }
  };

  var SyncState = function() {
    ordinal: false,
    players: 0,
    countdown: false,
    init: function(data) {
      // prevents game from pausing if you leave focus
      game.state.disableVisibilityChange = true;

      var identity = this;

      identity.players = +data.playerCount;

      // if player is hosting
      if(data.hosting) {
        // give client host settings and check if others are ready
        identity.ordinal = 0;
        host = true;
        socket.emit('beginCheckingForTimeout', socket.id);
      } else {
        // set client's number and update when someone joins or leaves
        identity.ordinal = data.playerCount - 1;
        socket.on('joined', function (data) {
          identity.players = +data.playerCount;
        });
        socket.on('playerLeft', function (data) {
          self.players = +data.playerCount;
        });
      }
      // attempts to respond to positively when server
      // checks for connectivity
      socket.on('timeOut', function(data, ack) {
        identity.countdown = +data.times;
        ack(socket.id);
      });
    },
    preload: function() {
      // sets the up, down, right,and left arrows as useable
      cursors = game.input.keyboard.createCursorKeys();
    },
    create: function() {
      var textFormat = {font: "36px Comic Sans", fill: "#fff", align: "center"};
      this.text = game.add.text(game.world.centerX, game.world.centerY, "Waiting for more players ("+ this.players + " / 4)", textFormat);
      this.text.anchor.setTo(0.5, 0.5);
    },
    update: function() {
      game.physics.arcade.collide(ball, paddles, function (ball, player){
        ball.tint = player.tint;
      });

      if (this.countdown === false) {
        // decide what to do 
      } else {
        // runs a conditional phased game iniation
        this.initGame(this.countdown);
      }

      if (this.countdown !== false) {
        this.text.text = "Ready to start...";
      } else if (host || this.players === 4) {
        this.text.text = "Waiting for sync..";
      } else {
        this.text.text =  "Waiting for more players ("+ this.players + " / 4)"
      }
    },
    // Fired when syncing begins, this will fire 3 times before the start of a game
    // In its three phases, it places the ball, places the paddles, and removes messages about leaving
    initGame: function(phase) {
      switch(phase) {
        // check if breaks screw this up again
        case 1:
          ball.position.setTo(game.world.width / 2, game.world.height / 2 );
          ball.tint = 0xffffff;
          ball.player = -1;
          ball.body.velocity.x = 0;
          ball.body.velocity.y = 0;
        case 2:
          // set paddles to positions established in Loading State's create method
          for (var num in paddles) {
            paddles[num].position.setTo(paddles[num].op.x,paddles[num].op.y);
          }
          this.text.text = "GO!";
        case 3:
          socket.removeAllListeners('joined');
          socket.removeAllListeners('timeOut');
          socket.removeAllListeners('playerLeft');
          this.text.destroy();
          game.state.start("game", false, false, { player: this.ordinal });
        break;
      }
    }
  };

  var GameState = function() {
    inactivePlayers = { 0: false, 1: false, 2: false, 3: false},
    gameRunning: false,
    init: function (data) {

    },
    
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