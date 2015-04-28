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
  var gameWidth = parseInt(document.getElementById(gameDiv).offsetWidth);
  var gameHeight = parseInt(document.getElementById(gameDiv).offsetHeight);

  var game = new Phaser.Game(gameWidth, gameHeight, Phaser.AUTO, gameDiv, null, false, false);

  var host = false;
  var paddles = [];
  var sprites;
  var ball;

  var currentPlayer = -1;
  var master = false;
  var cursors;

  var colors = ["ff0000", "00ff00", "0000ff", "ffff00"];

  var ballSize = 10;
  var halfBallSize = ballSize / 2;
  var padSize = 8;
  var halfPadSize = padSize / 2;
  var moveFactor = 5;
  var maxScore = 10;

  function robotTakeover(inactivePlayers) {
    if (inactivePlayers == undefined) {
      inactivePlayers = {0:true, 1:true, 2:true, 3:true};
    }

    for (var i in paddles) {
      if (!inactivePlayers[i]) {
        continue;
      }

      var p = paddles[i];
      var pH2 = p.body.height/2;
      var pW2 = p.body.width/2;
      switch (parseInt(i)) {
        case 0:
        case 2:
          if (ball.body.x >= pW2 && ball.body.x <= game.world.width - pW2) {
              p.position.x = ball.position.x;
          }
        break;
        case 1:
        case 3:
          if (ball.body.y >= pH2 && ball.body.y <= game.world.height - pH2) {
              p.position.y = ball.position.y;
          }
        break;
      }
    }
  }

  var BootingState = {
    preload : function() {
      // load a sprite to show to indicate loading
    },
    create : function() {
      game.state.start('preload');
    }
  };

  var LoadingState = {
    preload: function () {
      game.stage.disableVisibilityChange = true;

      // create a sprite for the loading 
      
      game.load.image('ball', 'assets/sprites/pixel.png');
    },
    create: function () {
      // destroy loading sprite
      
      game.physics.startSystem(Phaser.Physics.ARCADE);

      // create a group of sprites so they can be instantiated together
      sprites = game.add.group();

      ball = sprites.create(game.world.centerX - halfBallSize, game.world.centerY - halfBallSize, 'ball');
      ball.name = 'ball';
      // scales ball's X and Y to declared ballScaleSize
      ball.scale.setTo(ballSize, ballSize);
      // sets center of ball to its midpoint
      ball.anchor.setTo(0.5,0.5);

      // use phaser physics on ball
      game.physics.enable([ball], Phaser.Physics.ARCADE);
      
      // help ball start bouncing in a random direction
      var sign = game.rnd.integerInRange(0,1) === 0 ? 1 : -1;
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
      paddles.push(sprites.create(game.world.centerX - halfPadSize, halfPadSize, 'ball'));
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
        if(i % 2 === 0) {
          paddles[i].scale.setTo(padSize* 10, 10);
        } else {
          paddles[i].scale.setTo(10, padSize * 10);
        }
        // place the sprite's anchor point in the center
        paddles[i].anchor.setTo(0.5,0.5);

        //enable physics for each sprite
        game.physics.enable([ paddles[i] ], Phaser.Physics.ARCADE);
        
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

      robotTakeover();
    }
  };

  var SyncState = {
    p: false,
    players: 0,
    countdown: false,
    init: function(data) {
      // prevents game from pausing if you leave focus
      game.state.disableVisibilityChange = true;

      var identity = this;

      identity.players = parseInt(data.playersCount);

      // if player is hosting
      if(data.hosting) {
        // give client host settings and check if others are ready
        identity.p = 0;
        host = true;
        socket.emit('startCounting', socket.id);
      } else {
        // set client's number and update when someone joins or leaves
        identity.p = data.playersCount - 1;
        socket.on('joined', function (data) {
          identity.players = parseInt(data.playersCount);
        });
        socket.on('playerLeft', function (data) {
          identity.players = parseInt(data.playersCount);
        });
      }
      // attempts to respond to positively when server
      // checks for connectivity
      socket.on('timeOut', function(data, ack) {
        identity.countdown = parseInt(data.times);
        ack(socket.id);
      });
    },
    preload: function() {
      // sets the up, down, right,and left arrows as useable
      cursors = game.input.keyboard.createCursorKeys();
    },
    create: function() {
      var textFormat = {font: "20px Comic Sans", fill: "#fff", align: "center"};
      this.text = game.add.text(game.world.centerX, game.world.centerY, "Waiting for more players ("+ this.players + " / 4)", textFormat);
      this.text.anchor.setTo(0.5, 0.5);
    },
    update: function() {
      game.physics.arcade.collide(ball, paddles, function (ball, player){
        ball.tint = player.tint;
      });

      if (this.countdown === false) {
        robotTakeover(); 
      } else {
        // runs a conditional phased game initiation
        this.initGame(this.countdown);
      }

      if (this.countdown !== false) {
        this.text.text = "Ready to start...";
      } else if (host || this.players === 4) {
        this.text.text = "Waiting for sync..";
      } else {
        this.text.text =  "Waiting for more players ("+ this.players + " / 4)";
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
          break;
        case 2:
          // set paddles to positions established in Loading State's create method
          for (var num in paddles) {
            paddles[num].position.setTo(paddles[num].op.x,paddles[num].op.y);
          }
          this.text.text = "GO!";
          break;
        case 3:
          socket.removeAllListeners('joined');
          socket.removeAllListeners('timeOut');
          socket.removeAllListeners('playerLeft');
          this.text.destroy();
          game.state.start("game", false, false, { player: this.p });
        break;
      }
    }
  };

  var GameState = {
    inactivePlayers : { 0: false, 1: false, 2: false, 3: false},
    gameRunning: false,
    init: function (data) {
      game.stage.disableVisibilityChange = true;

      var identity = this;
      currentPlayer = data.player;

      socket.on('playerLeft', function (data) {
        identity.inactivePlayers[parseInt(data.playerLeft)] = true;
      });
      socket.on('clientUpdate', function(data) {
        identity.updateClient(data);
      });
      socket.on('clientUpdateScores', function(data) {
        identity.clientUpdateScores(data);
      });
      socket.on('clientUpdateBall', function(data) {
        identity.clientUpdateBall(data);
      });
      socket.on('makeHost', function (data) {
        master = true;
        ball.body.velocity.x = ball.currentSpeedX;
        ball.body.velocity.y = ball.currentSpeedY;
      });
    },
    create: function () {
      if (!master) {
        ball.body.velocity.x = 0;
        ball.body.velocity.y = 0;
      } else {
        var sign = game.rnd.integerInRange(0,1) == 0 ? 1 : -1;
        ball.body.velocity.x = game.rnd.integerInRange(100, 250) * sign;
        ball.body.velocity.y = game.rnd.integerInRange(100, 250) * sign;
      }

      var scoresPos = [
        {w: game.world.centerX, h: game.world.centerY - 100},
        {w: game.world.centerX - 100, h: game.world.centerY},
        {w: game.world.centerX, h: game.world.centerY + 100},
        {w: game.world.centerX + 100, h: game.world.centerY}
      ];

      for (var i in paddles) {
        paddles[i].position.setTo(paddles[i].op.x,paddles[i].op.y);
        var style = {font: "50px Comic Sans", fill: "#" + colors[i], align: "center"};
        paddles[i].scoreLabel = game.add.text(scoresPos[i].w,scoresPos[i].h, "0", style);
        paddles[i].scoreLabel.anchor.setTo(0.5, 0.5);
      }

      this.gameRunning = true;
    },
    update: function () {
      if (this.gameRunning) {
        for (var i in paddles) {
          if (paddles[i].scoreLabel.text >= maxScore) {
            this.endGame(paddles[i]);
            return;
          }
        }

        if (master) {
          game.physics.arcade.collide(ball, paddles, function(ball,player) {
            ball.tint = player.tint;
            ball.player = player.player;

            var data = {socketId: socket.id};
            data['ballTint'] = ball.tint;
            socket.emit('gameBallUpdate', data);
          });
          this.checkScore();
        }
        this.inputManagment();
        robotTakeover(this.inactivePlayers);
        this.updateServer();
      }
    },
    checkScore: function() {
      if (master) {
        var scored = false;
        if (ball.body.y < -ball.body.height) {
          scored = true;
          if (ball.player === -1 || ball.player === 0) {
            paddles[0].scoreLabel.text--;
            scored = true;
          } else {
            paddles[ball.player].scoreLabel.text++;
          }
        } else if(ball.body.y > game.world.height + ball.body.height) {
          scored = true;
          if(ball.player === -1 || ball.player === 2) {
            paddles[2].scoreLabel.text--;
          } else {
            paddles[ball.player].scoreLabel.text++;
          }
        } else if (ball.body.x < -ball.body.width) {
          scored = true;
          if (ball.player === -1 || ball.player === 1) {
            paddles[1].scoreLabel.text--;
          } else {
            paddles[ball.player].scoreLabel.text++;
          }
        } else if (ball.body.x > game.world.width + ball.body.width) {
          scored = true;
          if (ball.player === -1 || ball.player === 3) {
            paddles[3].scoreLabel.text--;
          } else {
            paddles[ball.player].scoreLabel.text++;
          }
        }

        if(scored) {
          var data = { socketId: socket.id };
          data['scores'] = [];
          for(var i in paddles) {
            data['scores'].push(parseInt(paddles[i].scoreLabel.text));
          }
          socket.emit('gameScoreUpdate', data);

          ball.body.position.setTo(game.world.centerX, game.world.centerY);
          ball.player = -1;
          ball.tint = 0xffffff;

          var sign = game.rnd.integerInRange(0,1) === 0 ? 1 : -1;
          ball.body.velocity.x = game.rnd.integerInRange(100, 250) * sign;
          ball.body.velocity.y = game.rnd.integerInRange(100, 250) * sign;
        }
      }
    },
    inputManagment: function() {
      var p = paddles[currentPlayer];

      if (cursors.left.isDown || cursors.up.isDown) {
        switch(currentPlayer) {
          case 0:
          case 2:
            p.position.x -= moveFactor;
            break;
          case 1:
          case 3:
            p.position.y -= moveFactor;
            break;
        }
      } else if (cursors.right.isDown || cursors.down.isDown) {
        switch(currentPlayer) {
          case 0:
          case 2:
            p.position.x += moveFactor;
            break;
          case 1:
          case 3:
            p.position.y += moveFactor;
            break;
        }
      } else {
        switch(currentPlayer) {
          case 0:
          case 2:
            if (game.input.activePointer.x >= paddles[currentPlayer].position.x + moveFactor) {
              p.position.x += moveFactor;
            } else if (game.input.activePointer.x <= paddles[currentPlayer].position.x - moveFactor) {
              p.position.x -= moveFactor;
            }
            break;
          case 1:
          case 3:
            if (game.input.activePointer.y >= paddles[currentPlayer].position.y + moveFactor) {
              p.position.y += moveFactor;
            } else if (game.input.activePointer.y <= paddles[currentPlayer].position.y - moveFactor) {
              p.position.y -= moveFactor;
            }
            break;
        }
      }

      var pH2 = p.body.height / 2;
      var pW2 = p.body.width / 2;
      switch (currentPlayer) {
        case 0:
        case 2:
          if (p.position.x < pW2) {
            p.position.x = pW2;
          } else if (p.position.x > game.world.width - pW2) {
            p.position.x = game.world.width - pW2;
          }
          break;
        case 1:
        case 3:
          if (p.position.y < pH2) {
            p.position.y = pH2;
          } else if (p.position.y > game.world.width - pH2) {
            p.position.y = game.world.width - pH2;
          }
          break;
      }
    },
    endGame: function (player) {
      this.gameRunning = false;

      for(var i in paddles) {
        paddles[i].scoreLabel.destroy();
        paddles[i].destroy();
      }

      ball.destroy();
      var textFormat = {font: "50px Arial", fill: "#ffffff", align: "center"};
      var won = player.player === currentPlayer ? "You win!" : player.name + " wins!";
      var text = game.add.text(game.world.centerX,game.world.centerY, won, textFormat);
      text.anchor.setTo(0.5,0.5);

      socket.removeAllListeners('playerLeft');
      socket.removeAllListeners('clientUpdate');
      socket.removeAllListeners('clientUpdateScores');
      socket.removeAllListeners('clientUpdateBall');
      socket.removeAllListeners('makeHost');
      socket.removeAllListeners('disconnect');
      socket.removeAllListeners('errorMsg');
      socket.removeAllListeners('error');

      $(".menu").show();
      $(".menu-host-interface").hide();
      $(".menu-client-interface").hide();
      $(".finished-game-interface").show();

      setTimeout(function() {
        socket.disconnect();
      }, 5000);
    },
    socketTiming: 0,
    socketDelay: 16,
    getSocketDelay: function() {
      return latency < this.socketDelay ? latency : this.socketDelay;
    },
    updateServer: function() {
      this.socketTiming += game.time.elapsed;
      if(this.socketTiming < this.getSocketDelay()) {
        return;
      }
      this.socketTiming = 0;
      var data = { socketId: socket.id };

      if(master) {
        data['ball'] = true;
        data['ballX'] = parseFloat(ball.position.x).toFixed(2);
        data['ballY'] = parseFloat(ball.position.y).toFixed(2);
        data['ballSpeedX'] = parseFloat(ball.position.x).toFixed(2);
        data['ballSpeedY'] = parseFloat(ball.position.y).toFixed(2);

      } else {
        data['ball'] = false;
      }

      data['player'] = parseInt(currentPlayer);
      switch(data['player']) {
        case 0:
        case 2:
          data['paddle'] = parseFloat(paddles[currentPlayer].position.x).toFixed(2);
          break;
        case 1:
        case 3:
          data['paddle'] = parseFloat(paddles[currentPlayer].position.y).toFixed(2);
          break;
      }

      socket.emit('gameUpdate', data);
    },
    updateClient: function(data) {
      if(!master && data.ball === true) {
        ball.position.x = parseFloat(data.ballX);
        ball.position.y = parseFloat(data.ballY);
        ball.currentSpeedX = parseFloat(data.ballSpeedX);
        ball.currentSpeedY = parseFloat(data.ballSpeedY);
      }

      if (currentPlayer !== data.player) {
        switch(parseInt(data.player)){
          case 0:
          case 2:
            paddles[data.player].position.x = parseFloat(data.paddle);
            break;
          case 1:
          case 3:
            paddles[data.player].position.x = parseFloat(data.paddle);
            break;
        }
      }
    },
    updateClientScores: function(data) {
      if(!master) {
        ball.tint = 0xffffff;
        for(var i in data.scores) {
          paddles[i].scoreLabel.text = parseInt(data.scores[i]);
        }
      }
    },
    updateClientBall: function(data){
      if(!master) {
        ball.tint = data.ballTint;
      }
    },
  };

  game.state.add("boot", BootingState, true);
  game.state.add("preload", LoadingState);
  game.state.add("sync", SyncState);
  game.state.add("game", GameState, false);

  this.getSocket = function() {
    return socket;
  };

  this.switchToSync = function(data) {
    game.state.start("sync", false, false, data);
  };

  return this;
};

gameObj.prototype.getSocket = function() {
  return this.getSocket();
};

gameObj.prototype.sync = function(data) {
  this.switchToSync(data);
};