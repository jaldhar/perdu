(function(){
var CIRCLE = Math.PI * 2;

var MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent)

function Controls() {
    this.codes  = { 37: 'left', 39: 'right', 38: 'forward', 40: 'backward' };
    this.states = { 'left': false, 'right': false, 'forward': false, 'backward': false };
    document.addEventListener('keydown', this.onKey.bind(this, true), false);
    document.addEventListener('keyup', this.onKey.bind(this, false), false);
    document.addEventListener('touchstart', this.onTouch.bind(this), false);
    document.addEventListener('touchmove', this.onTouch.bind(this), false);
    document.addEventListener('touchend', this.onTouchEnd.bind(this), false);
}

Controls.prototype.onTouch = function(e) {
    var t = e.touches[0];
    this.onTouchEnd(e);
    if (t.pageY < window.innerHeight * 0.5)
        this.onKey(true, { keyCode: 38 });
    else if (t.pageX < window.innerWidth * 0.5)
        this.onKey(true, { keyCode: 37 });
    else if (t.pageY > window.innerWidth * 0.5)
        this.onKey(true, { keyCode: 39 });
};

Controls.prototype.onTouchEnd = function(e) {
    this.states = { 'left': false, 'right': false, 'forward': false,
        'backward': false };
    e.preventDefault();
    e.stopPropagation();
};

Controls.prototype.onKey = function(val, e) {
    var state = this.codes[e.keyCode];
    if (typeof state === 'undefined')
        return;
    this.states[state] = val;
    e.preventDefault && e.preventDefault();
    e.stopPropagation && e.stopPropagation();
};

function canvasToImage(drawFunc, width, height) {
    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext("2d");
    drawFunc(ctx);
    this.image = new Image();
    this.image.src = canvas.toDataURL("image/png");
    this.width = width;
    this.height = height;
}

function Player(map, direction) {
    var pos = map.place();
    this.x = pos.x;
    this.y = pos.y;
    this.direction = direction;
    this.paces = 0;
    this.score = 0;
    this.dead = false;
}

Player.prototype.rotate = function(angle) {
    this.direction = (this.direction + angle + CIRCLE) % (CIRCLE);
};

Player.prototype.walk = function(distance, map) {
    var dx = Math.cos(this.direction) * distance;
    var dy = Math.sin(this.direction) * distance;
    if (map.get(this.x + dx, this.y) <= 0)
        this.x += dx;
    if (map.get(this.x, this.y + dy) <= 0)
        this.y += dy;
    this.paces += distance;
};

Player.prototype.update = function(controls, map, seconds) {
    if (controls.left)
        this.rotate(-Math.PI * seconds);
    if (controls.right)
        this.rotate(Math.PI * seconds);
    if (controls.forward)
        this.walk(3 * seconds, map);
    if (controls.backward)
        this.walk(-3 * seconds, map);
};

function Chicken(x,y){
    this.texture = new canvasToImage(drawChicken, 512, 512);
    this.width = 0.5;
    this.height = 0.5;
    this.floorOffset = 0;
    this.distanceFromPlayer = 0;
	this.x = x;
	this.y = y;
}

function Map(size) {
    this.size = size;
    this.wallGrid = new Uint8Array(size * size);
    this.skybox = new canvasToImage(drawBackground, 1200, 750);
    this.wallTexture = new canvasToImage(drawWall, 1024, 1024);
    this.light = 0;
    this.chickens = [];

    for (var i = 0; i < this.size; i++) {
        for (var j = 0; j < this.size; j++) {
            if (i === 0 || i === this.size - 1 || j === 0 ||
            j === this.size - 1) {
                this.wallGrid[i * this.size + j] = 1;
            } else {
                this.wallGrid[i * this.size + j] = 0;
            }
        }
    }

    for (var i = 0; i < 20; i++) {
        var pos = this.place();
        this.wallGrid[pos.x * this.size + pos.y] = 1;
    }

    for (var i = 0; i < 12; i++) {
        var pos = this.place();
        this.chickens.push( new Chicken(pos.x, pos.y) );
        this.wallGrid[pos.x * this.size + pos.y] = 2;
    }
};

Map.prototype.place = function() {
    var X, Y;
    do {
        X = Math.floor(Math.random() * this.size);
        Y = Math.floor(Math.random() * this.size);
    } while (this.wallGrid[X * this.size + Y] !== 0);
    return {x: X, y: Y};
};

Map.prototype.get = function(x, y) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x > this.size - 1 || y < 0 || y > this.size - 1)
        return -1;
    return this.wallGrid[y * this.size + x];
};

Map.prototype.cast = function(point, angle, range) {
    var self = this;
    var sin = Math.sin(angle);
    var cos = Math.cos(angle);
    var noWall = { length2: Infinity };

    return ray({ x: point.x, y: point.y, height: 0, distance: 0 });

    function ray(origin) {
        var stepX = step(sin, cos, origin.x, origin.y);
        var stepY = step(cos, sin, origin.y, origin.x, true);
        var nextStep = stepX.length2 < stepY.length2
            ? inspect(stepX, 1, 0, origin.distance, stepX.y)
            : inspect(stepY, 0, 1, origin.distance, stepY.x);

        if (nextStep.distance > range)
            return [origin];
        return [origin].concat(ray(nextStep));
    }

    function step(rise, run, x, y, inverted) {
        if (run === 0)
            return noWall;
        var dx = run > 0 ? Math.floor(x + 1) - x : Math.ceil(x - 1) - x;
        var dy = dx * (rise / run);
        return {
            x: inverted ? y + dy : x + dx,
            y: inverted ? x + dx : y + dy,
            length2: dx * dx + dy * dy
        };
    }

    function inspect(step, shiftX, shiftY, distance, offset) {
        var dx = cos < 0 ? shiftX : 0;
        var dy = sin < 0 ? shiftY : 0;
        step.height = self.get(step.x - dx, step.y - dy);
        step.distance = distance + Math.sqrt(step.length2);
        step.object = self.chickens[Math.floor(step.y - dy) * self.size +
            Math.floor(step.x - dx)];
        if (shiftX)
            step.shading = cos < 0 ? 2 : 0;
        else
            step.shading = sin < 0 ? 2 : 1;
        step.offset = offset - Math.floor(offset);
        return step;
    }
};

Map.prototype.update = function(seconds) {
    if (this.light > 0)
        this.light = Math.max(this.light - 10 * seconds, 0);
};

function Camera(canvas, resolution, focalLength) {
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width = window.innerWidth * 0.5;
    this.height = canvas.height = window.innerHeight * 0.5;
    this.resolution = resolution;
    this.spacing = this.width / resolution;
    this.focalLength = focalLength || 0.8;
    this.range = MOBILE ? 8 : 14;
    this.lightRange = 5;
    this.scale = (this.width + this.height) / 1200;
}

Camera.prototype.render = function(player, map) {
    this.drawSky(player.direction, map.skybox, map.light);
    this.drawColumns(player, map);
    this.drawHUD(map, player);
};

Camera.prototype.drawSky = function(direction, sky, ambient) {
    var width = sky.width * (this.height / sky.height) * 2;
    var left = (direction / CIRCLE) * -width;

    this.ctx.save();
    this.ctx.drawImage(sky.image, left, 0, width, this.height);
    if (left < width - this.width) {
        this.ctx.drawImage(sky.image, left + width, 0, width, this.height);
    }
    if (ambient > 0) {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.globalAlpha = ambient * 0.1;
        this.ctx.fillRect(0, this.height * 0.5, this.width, this.height * 0.5);
    }
    this.ctx.restore();
};

Camera.prototype.drawSpriteColumn = function(player,map,column,columnProps,sprites) {

	var ctx = this.ctx,
		left = Math.floor(column * this.spacing),
		width = Math.ceil(this.spacing),
		angle = Math.PI * .4 * (column / this.resolution - 0.5),
		columnWidth = this.width / this.resolution,
		sprite,props,obj,textureX,height,projection, mappedColumnObj,spriteIsInColumn,top;

	sprites = sprites.filter(function(sprite){
	 return !columnProps.hit || sprite.distanceFromPlayer < columnProps.hit;
	});


	for(var i = 0; i < sprites.length; i++){
		sprite = sprites[i];

		//determine if sprite should be drawn based on current column position and sprite width
        spriteIsInColumn = left > sprite.render.cameraXOffset -
            ( sprite.render.width / 2 ) &&
            left < sprite.render.cameraXOffset +
            ( sprite.render.width / 2 );

		if(spriteIsInColumn){
			textureX = Math.floor( sprite.texture.width / sprite.render.numColumns * ( column - sprite.render.firstColumn ) );

			this.ctx.fillStyle = 'black';
			this.ctx.globalAlpha = 1;

			var brightness = Math.max(sprite.distanceFromPlayer / this.lightRange - map.light, 0) * 100;

			sprite.texture.image.style.webkitFilter = 'brightness(' + brightness + '%)';
			sprite.texture.image.style.filter = 'brightness(' + brightness  + '%)';

			ctx.drawImage(sprite.texture.image, textureX, 0, 1, sprite.texture.height, left, sprite.render.top, width, sprite.render.height);
		}
	};
};

Camera.prototype.drawSprites = function(player,map,columnProps){

    var screenWidth = this.width,
        screenHeight = this.height,
        screenRatio = screenWidth / Math.PI * .4,
        resolution = this.resolution;

    var sprites = Array.prototype.slice.call(map.chickens).map(function(sprite) {
        var distX = sprite.x - player.x,
            distY = sprite.y - player.y,
            width = sprite.width * screenWidth / sprite.distanceFromPlayer,
            height = sprite.height * screenHeight /  sprite.distanceFromPlayer,
            renderedFloorOffset = sprite.floorOffset / sprite.distanceFromPlayer,
            angleToPlayer = Math.atan2(distY,distX),
            angleRelativeToPlayerView = player.direction - angleToPlayer,
            top = (screenHeight / 2) * (1 + 1 / sprite.distanceFromPlayer) - height;

        if(angleRelativeToPlayerView >= CIRCLE / 2){
            angleRelativeToPlayerView -= CIRCLE;
        }

        var cameraXOffset = ( camera.width / 2 ) - (screenRatio * angleRelativeToPlayerView),
            numColumns = width / screenWidth * resolution,
            firstColumn = Math.floor( (cameraXOffset - width/2 ) / screenWidth * resolution);

        sprite.distanceFromPlayer = Math.sqrt( Math.pow( distX, 2) + Math.pow( distY, 2) );
        sprite.render = {
            width: width,
            height: height,
            angleToPlayer: angleRelativeToPlayerView,
            cameraXOffset: cameraXOffset,
            distanceFromPlayer: sprite.distanceFromPlayer,
            numColumns: numColumns,
            firstColumn: firstColumn,
            top: top
        };

        return sprite;
    })
    // sort sprites in distance order
    .sort(function(a,b) {
        if(a.distanceFromPlayer < b.distanceFromPlayer){
            return 1;
        }
        if(a.distanceFromPlayer > b.distanceFromPlayer){
            return -1;
        }
        return 0;
    });

    this.ctx.save();
    for (var column = 0; column < this.resolution; column++) {
        this.drawSpriteColumn(player,map,column,columnProps[column], sprites);
    }
    this.ctx.restore();
};

Camera.prototype.drawColumns = function(player, map) {
    this.ctx.save();
    var allObjects = [];
    for (var column = 0; column < this.resolution; column++) {
        var x = column / this.resolution - 0.5;
        var angle = Math.atan2(x, this.focalLength);
        var ray = map.cast(player, player.direction + angle, this.range);
        allObjects.push(this.drawColumn(column, ray, angle, map));
    }
    this.ctx.restore();
    this.ctx.save();
    this.drawSprites(player, map, allObjects);
    this.ctx.restore();
};

Camera.prototype.drawColumn = function(column, ray, angle, map) {
    var ctx = this.ctx;
    var wallTexture = map.wallTexture;
    var left = Math.floor(column * this.spacing);
    var width = Math.ceil(this.spacing);
    var hit = -1;
    var objects = [];
    var hitDistance;

    while (++hit < ray.length && ray[hit].height <= 0);

    for (var s = ray.length - 1; s >= 0; s--) {
        var step = ray[s];

        if (s === hit) {
            var textureX = Math.floor(wallTexture.width * step.offset);
            var wall = this.project(step.height, angle, step.distance);

            ctx.globalAlpha = 1;
            ctx.drawImage(wallTexture.image, textureX, 0, 1,
                wallTexture.height, left, wall.top, width, wall.height);
            ctx.fillStyle = '#000000';
            ctx.globalAlpha = Math.max((step.distance + step.shading) /
                this.lightRange - map.light, 0);
            ctx.fillRect(left, wall.top, width, wall.height);
            hitDistance = step.distance;
        } else if(step.object) {
			objects.push({
				object: step.object,
				distance: step.distance,
				offset: step.offset,
				angle: angle
			});
        }
    }
	return {
		objects: objects,
		hit: hitDistance
	}
};

Camera.prototype.drawHUD = function(map, player) {

	var ctx = this.ctx;

    ctx.save();
    ctx.rotate(0);
    ctx.fillStyle = "darkblue";
    if (player.score === 12) {
        ctx.fillText("YOU WIN! REFRESH TO PLAY AGAIN", 10, 10);
    } else if (player.dead === true) {
        ctx.fillText("YOU DIED! REFRESH TO PLAY AGAIN", 10, 10);
    } else {
        ctx.fillText("SCORE: " + player.score, 10, 10);
    }
    ctx.restore();

};

Camera.prototype.project = function(height, angle, distance) {
    var z = distance * Math.cos(angle);
    var wallHeight = this.height * height / z;
    var bottom = this.height / 2 * (1 + 1 / z);
    return {
        top: bottom - wallHeight,
        height: wallHeight
    };
};

function GameLoop() {
    this.frame = this.frame.bind(this);
    this.lastTime = 0;
    this.callback = function() {};
}

GameLoop.prototype.start = function(callback) {
    this.callback = callback;
    requestAnimationFrame(this.frame);
};

GameLoop.prototype.frame = function(time) {
  var seconds = (time - this.lastTime) / 1000;
  this.lastTime = time;
  if (seconds < 0.2) this.callback(seconds);
  requestAnimationFrame(this.frame);
};

var drawChicken = function(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.lineTo(512,0);
    ctx.lineTo(512,512);
    ctx.lineTo(0,512);
    ctx.closePath();
    ctx.clip();
    ctx.translate(0,0);
    ctx.translate(0,0);
    ctx.scale(1,1);
    ctx.translate(0,0);
    ctx.strokeStyle = 'rgba(0,0,0,0)';
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 4;
    ctx.save();
    ctx.fillStyle = "#a4ce74";
    ctx.beginPath();
    ctx.moveTo(88.2,471.8);
    ctx.bezierCurveTo(87.4,471,87,465.6,87,454.1);
    ctx.bezierCurveTo(87,438.20000000000005,86.9,437.5,84.5,434.1);
    ctx.bezierCurveTo(82.8,431.70000000000005,79.9,429.6,75.5,427.5);
    ctx.bezierCurveTo(71.9,425.9,68.7,423.7,68.4,422.8);
    ctx.bezierCurveTo(68.10000000000001,421.90000000000003,68.5,418.7,69.4,415.90000000000003);
    ctx.bezierCurveTo(70.4,412.8,71,406.8,71,401.5);
    ctx.bezierCurveTo(71,393.8,71.3,392.1,72.9,390.6);
    ctx.bezierCurveTo(74.60000000000001,389,75.10000000000001,389,77.7,390.40000000000003);
    ctx.bezierCurveTo(79.3,391.20000000000005,82.60000000000001,393.8,85,396.1);
    ctx.bezierCurveTo(93.5,404,93.2,403.90000000000003,100,399.20000000000005);
    ctx.bezierCurveTo(103.3,396.90000000000003,106.4,395.1,106.8,395.1);
    ctx.bezierCurveTo(107.2,395.1,108.39999999999999,394.20000000000005,109.39999999999999,393.1);
    ctx.bezierCurveTo(110.39999999999999,392,111.8,391.1,112.49999999999999,391.1);
    ctx.bezierCurveTo(115.19999999999999,391.1,132.39999999999998,375.20000000000005,135.39999999999998,370);
    ctx.bezierCurveTo(138.7,364.3,139.09999999999997,363.1,138.49999999999997,360.9);
    ctx.bezierCurveTo(138.19999999999996,359.59999999999997,136.39999999999998,356.4,134.59999999999997,353.79999999999995);
    ctx.bezierCurveTo(125.9,340.9,123.9,338.2,121,335);
    ctx.bezierCurveTo(112.3,325.6,91,297.3,91,295.2);
    ctx.bezierCurveTo(91,294.8,89.3,292,87.2,289);
    ctx.bezierCurveTo(85.10000000000001,286,82.9,282.4,82.2,281);
    ctx.bezierCurveTo(81.5,279.6,79.9,276.7,78.5,274.5);
    ctx.bezierCurveTo(77.2,272.3,75.6,269.4,75,268);
    ctx.bezierCurveTo(74.4,266.6,73.5,264.8,72.9,264);
    ctx.bezierCurveTo(72.30000000000001,263.2,71.4,261.4,70.80000000000001,260);
    ctx.bezierCurveTo(70.20000000000002,258.6,69.10000000000001,256.8,68.4,256);
    ctx.bezierCurveTo(67.7,255.2,66.80000000000001,253.1,66.4,251.3);
    ctx.bezierCurveTo(66,249.60000000000002,65.10000000000001,247.60000000000002,64.30000000000001,246.9);
    ctx.bezierCurveTo(63.6,246.3,63,244.7,63,243.5);
    ctx.bezierCurveTo(63,242.3,62.1,240.1,61,238.7);
    ctx.bezierCurveTo(59.9,237.29999999999998,59,235.29999999999998,59,234.2);
    ctx.bezierCurveTo(59,233.1,58.1,231.1,57,229.7);
    ctx.bezierCurveTo(55.9,228.29999999999998,55,225.89999999999998,55,224.29999999999998);
    ctx.bezierCurveTo(55,222.8,54.1,220.2,53,218.5);
    ctx.bezierCurveTo(51.8,216.7,51,213.8,51,211.4);
    ctx.bezierCurveTo(51,209.1,50.1,204.4,49,201);
    ctx.bezierCurveTo(47.9,197.4,47,192,47,188.3);
    ctx.bezierCurveTo(47,184.8,46.1,178.4,45.1,174.20000000000002);
    ctx.bezierCurveTo(44,169.8,42.9,160.70000000000002,42.5,153.20000000000002);
    ctx.lineTo(41.8,140.00000000000003);
    ctx.lineTo(44.599999999999994,138.90000000000003);
    ctx.bezierCurveTo(49.599999999999994,137.00000000000003,68.39999999999999,136.60000000000002,91.8,137.90000000000003);
    ctx.bezierCurveTo(110.6,139.00000000000003,115,139.50000000000003,117.6,141.10000000000002);
    ctx.bezierCurveTo(119.3,142.10000000000002,122.1,143.00000000000003,123.89999999999999,143.00000000000003);
    ctx.bezierCurveTo(125.6,143.00000000000003,128.7,143.70000000000002,130.79999999999998,144.60000000000002);
    ctx.bezierCurveTo(133.39999999999998,145.70000000000002,139.99999999999997,146.50000000000003,151.99999999999997,147.10000000000002);
    ctx.bezierCurveTo(162.39999999999998,147.60000000000002,171.49999999999997,148.60000000000002,174.39999999999998,149.50000000000003);
    ctx.bezierCurveTo(177.09999999999997,150.30000000000004,181.2,151.00000000000003,183.59999999999997,151.00000000000003);
    ctx.bezierCurveTo(185.99999999999997,151.00000000000003,190.19999999999996,151.90000000000003,192.99999999999997,153.00000000000003);
    ctx.bezierCurveTo(195.79999999999998,154.10000000000002,199.69999999999996,155.00000000000003,201.59999999999997,155.00000000000003);
    ctx.bezierCurveTo(203.49999999999997,155.00000000000003,206.89999999999998,155.90000000000003,208.99999999999997,157.00000000000003);
    ctx.bezierCurveTo(211.19999999999996,158.10000000000002,214.59999999999997,159.00000000000003,216.69999999999996,159.00000000000003);
    ctx.bezierCurveTo(218.79999999999995,159.00000000000003,222.29999999999995,159.90000000000003,224.49999999999997,161.00000000000003);
    ctx.bezierCurveTo(226.69999999999996,162.10000000000002,230.09999999999997,163.00000000000003,231.99999999999997,163.00000000000003);
    ctx.bezierCurveTo(233.89999999999998,163.00000000000003,237.79999999999998,163.60000000000002,240.49999999999997,164.30000000000004);
    ctx.bezierCurveTo(244.89999999999998,165.50000000000003,246.19999999999996,165.40000000000003,251.69999999999996,163.70000000000005);
    ctx.bezierCurveTo(256.9,162.10000000000005,258.69999999999993,161.00000000000006,262.4,156.60000000000005);
    ctx.bezierCurveTo(266.7,151.50000000000006,266.9,151.20000000000005,267.9,141.40000000000006);
    ctx.bezierCurveTo(270.2,120.10000000000007,270.79999999999995,112.00000000000006,270.9,101.70000000000006);
    ctx.lineTo(271,91);
    ctx.lineTo(278.3,91);
    ctx.bezierCurveTo(282.3,91,288.2,91.7,291.5,92.5);
    ctx.bezierCurveTo(303.6,95.7,307,94.4,307,86.8);
    ctx.bezierCurveTo(307,84.8,307.9,80.8,309,78);
    ctx.bezierCurveTo(310.1,75.2,311,71.6,311,70);
    ctx.bezierCurveTo(311,66.3,314.8,60.7,319.7,57);
    ctx.bezierCurveTo(321.8,55.4,324.2,53.5,325.09999999999997,52.8);
    ctx.bezierCurveTo(327.09999999999997,51.099999999999994,331.09999999999997,48.9,337.99999999999994,45.5);
    ctx.bezierCurveTo(340.99999999999994,44,345.19999999999993,42,347.19999999999993,40.9);
    ctx.bezierCurveTo(349.2,39.9,352.4,39,354.3,39);
    ctx.bezierCurveTo(360.3,39,360.8,40.5,361.2,59.3);
    ctx.bezierCurveTo(361.5,74.6,361.7,76.3,363.5,77.5);
    ctx.bezierCurveTo(366.3,79.5,371.4,79.3,374.3,76.9);
    ctx.bezierCurveTo(375.7,75.80000000000001,377.7,74.9,378.7,74.9);
    ctx.bezierCurveTo(379.7,74.9,381.9,74.10000000000001,383.5,73.2);
    ctx.bezierCurveTo(385.7,72,389.8,71.4,398.8,71.10000000000001);
    ctx.bezierCurveTo(411.5,70.8,416,71.3,416,73.1);
    ctx.bezierCurveTo(416,74.89999999999999,409,83.19999999999999,395.3,97.6);
    ctx.bezierCurveTo(388.3,105,382.2,111.6,381.8,112.3);
    ctx.bezierCurveTo(381.40000000000003,113,381,116,381,119.1);
    ctx.bezierCurveTo(381,123.89999999999999,381.3,125,383.7,127.1);
    ctx.bezierCurveTo(387.09999999999997,130.1,396.59999999999997,135,399,135);
    ctx.bezierCurveTo(400,135,401.3,135.7,402,136.5);
    ctx.bezierCurveTo(402.7,137.3,404.9,138.3,406.9,138.6);
    ctx.bezierCurveTo(408.9,139,412,140.1,413.7,141.1);
    ctx.bezierCurveTo(415.4,142.1,417.8,143,419,143);
    ctx.bezierCurveTo(420.2,143,422.4,143.9,423.8,145);
    ctx.bezierCurveTo(425.2,146.1,427.1,147,428.1,147);
    ctx.bezierCurveTo(429.1,147,430.40000000000003,147.7,431.1,148.5);
    ctx.bezierCurveTo(431.8,149.3,433.3,150.3,434.5,150.6);
    ctx.bezierCurveTo(437.5,151.5,445.2,159.1,445.2,161.1);
    ctx.bezierCurveTo(445.2,163.79999999999998,443.09999999999997,164.7,436.3,165.2);
    ctx.bezierCurveTo(430.90000000000003,165.6,429.5,166.1,427.6,168.39999999999998);
    ctx.bezierCurveTo(426,170.29999999999998,425.3,172.39999999999998,425.3,175.09999999999997);
    ctx.bezierCurveTo(425.3,178.69999999999996,426,179.79999999999995,434.3,188.19999999999996);
    ctx.bezierCurveTo(439.5,193.49999999999997,443.2,197.99999999999997,443,198.99999999999997);
    ctx.bezierCurveTo(442.8,200.09999999999997,441.1,200.79999999999998,437.6,201.19999999999996);
    ctx.bezierCurveTo(434.8,201.49999999999997,431.40000000000003,202.39999999999995,430.1,203.19999999999996);
    ctx.bezierCurveTo(428.8,203.89999999999995,424.6,204.79999999999995,420.8,205.19999999999996);
    ctx.bezierCurveTo(415.5,205.69999999999996,413.40000000000003,206.39999999999995,411.6,208.19999999999996);
    ctx.bezierCurveTo(408.8,210.99999999999997,408.3,213.69999999999996,408.20000000000005,229.59999999999997);
    ctx.bezierCurveTo(408.20000000000005,236.19999999999996,407.70000000000005,242.29999999999995,407.20000000000005,243.09999999999997);
    ctx.bezierCurveTo(406.40000000000003,244.29999999999995,405.30000000000007,243.49999999999997,401.1,238.89999999999998);
    ctx.bezierCurveTo(398.1,235.6,395.2,233,394.4,233);
    ctx.bezierCurveTo(393.59999999999997,233,391.7,232.1,390.2,231.1);
    ctx.bezierCurveTo(386.9,228.79999999999998,376.4,227.5,372.59999999999997,229);
    ctx.bezierCurveTo(367.4,231,367.4,238.7,372.59999999999997,246.2);
    ctx.bezierCurveTo(376.79999999999995,252.2,379.4,256.7,382.99999999999994,264);
    ctx.bezierCurveTo(384.69999999999993,267.6,386.79999999999995,271.7,387.59999999999997,273.2);
    ctx.bezierCurveTo(388.4,274.7,388.99999999999994,276.7,388.99999999999994,277.8);
    ctx.bezierCurveTo(388.99999999999994,278.90000000000003,389.8999999999999,280.90000000000003,390.99999999999994,282.3);
    ctx.bezierCurveTo(392.09999999999997,283.7,392.99999999999994,286.1,392.99999999999994,287.7);
    ctx.bezierCurveTo(392.99999999999994,289.3,393.8999999999999,291.9,394.99999999999994,293.5);
    ctx.bezierCurveTo(396.09999999999997,295.2,396.99999999999994,298,396.99999999999994,299.8);
    ctx.bezierCurveTo(396.99999999999994,301.6,397.79999999999995,304.5,398.69999999999993,306.3);
    ctx.bezierCurveTo(401.29999999999995,311.1,401.3999999999999,323,398.8999999999999,329.1);
    ctx.bezierCurveTo(397.7999999999999,331.8,396.99999999999994,335.5,396.99999999999994,337.3);
    ctx.bezierCurveTo(396.99999999999994,339.1,396.09999999999997,342.2,394.99999999999994,344.3);
    ctx.bezierCurveTo(393.8999999999999,346.40000000000003,392.99999999999994,348.90000000000003,392.99999999999994,350);
    ctx.bezierCurveTo(392.99999999999994,352.5,387.79999999999995,362.2,383.49999999999994,367.8);
    ctx.bezierCurveTo(380.49999999999994,371.7,371.29999999999995,378.7,364.99999999999994,381.8);
    ctx.bezierCurveTo(363.59999999999997,382.5,361.79999999999995,383.40000000000003,360.99999999999994,383.90000000000003);
    ctx.bezierCurveTo(360.19999999999993,384.40000000000003,358.3999999999999,385.3,356.99999999999994,385.90000000000003);
    ctx.bezierCurveTo(355.59999999999997,386.50000000000006,352.69999999999993,388.1,350.49999999999994,389.50000000000006);
    ctx.bezierCurveTo(348.29999999999995,390.80000000000007,345.49999999999994,392.40000000000003,344.19999999999993,393.00000000000006);
    ctx.bezierCurveTo(342.8999999999999,393.6000000000001,340.0999999999999,395.50000000000006,337.8999999999999,397.20000000000005);
    ctx.bezierCurveTo(333.2999999999999,400.90000000000003,331.69999999999993,405.50000000000006,332.8999999999999,411.80000000000007);
    ctx.bezierCurveTo(333.7999999999999,416.50000000000006,334.99999999999994,418.1000000000001,344.99999999999994,428.00000000000006);
    ctx.bezierCurveTo(354.3999999999999,437.30000000000007,356.3999999999999,438.70000000000005,360.8999999999999,439.50000000000006);
    ctx.bezierCurveTo(366.2999999999999,440.40000000000003,374.69999999999993,439.20000000000005,376.7999999999999,437.1000000000001);
    ctx.bezierCurveTo(377.6999999999999,436.2000000000001,379.5999999999999,434.9000000000001,380.8999999999999,434.2000000000001);
    ctx.bezierCurveTo(385.19999999999993,432.0000000000001,387.7999999999999,430.4000000000001,389.5999999999999,428.8000000000001);
    ctx.bezierCurveTo(390.5999999999999,428.0000000000001,392.4999999999999,426.8000000000001,393.8999999999999,426.10000000000014);
    ctx.bezierCurveTo(395.2999999999999,425.40000000000015,398.19999999999993,423.8000000000001,400.3999999999999,422.40000000000015);
    ctx.bezierCurveTo(402.5999999999999,421.10000000000014,405.0999999999999,419.70000000000016,405.8999999999999,419.40000000000015);
    ctx.bezierCurveTo(406.69999999999993,419.10000000000014,409.19999999999993,417.90000000000015,411.49999999999994,416.8000000000001);
    ctx.bezierCurveTo(415.69999999999993,414.8000000000001,428.8999999999999,413.60000000000014,430.49999999999994,415.10000000000014);
    ctx.bezierCurveTo(431.59999999999997,416.20000000000016,429.59999999999997,419.90000000000015,425.29999999999995,424.70000000000016);
    ctx.bezierCurveTo(421.09999999999997,429.40000000000015,419.49999999999994,433.3000000000002,420.9,435.70000000000016);
    ctx.bezierCurveTo(421.4,436.60000000000014,424.2,438.90000000000015,427.09999999999997,440.8000000000002);
    ctx.bezierCurveTo(430.09999999999997,442.8000000000002,432.49999999999994,445.20000000000016,432.7,446.3000000000002);
    ctx.bezierCurveTo(433,448.1000000000002,432.09999999999997,448.4000000000002,423.7,449.50000000000017);
    ctx.bezierCurveTo(418.59999999999997,450.20000000000016,412.2,451.1000000000002,409.4,451.70000000000016);
    ctx.bezierCurveTo(406.7,452.20000000000016,401.5,452.70000000000016,397.9,452.70000000000016);
    ctx.bezierCurveTo(393.2,452.70000000000016,390.5,453.3000000000002,388.09999999999997,454.8000000000002);
    ctx.bezierCurveTo(386.4,456.1,383.9,457,382.6,457);
    ctx.bezierCurveTo(381.3,457,379.1,457.9,377.70000000000005,459);
    ctx.bezierCurveTo(376.20000000000005,460.2,373.6,461,371.30000000000007,461);
    ctx.bezierCurveTo(365.9000000000001,461,361.70000000000005,462.4,356.4000000000001,465.9);
    ctx.bezierCurveTo(352.1000000000001,468.79999999999995,348.0000000000001,469.9,347.9000000000001,468.2);
    ctx.bezierCurveTo(347.9000000000001,467.8,347.7000000000001,463.7,347.5000000000001,459.2);
    ctx.bezierCurveTo(347.3000000000001,453.5,346.60000000000014,450.09999999999997,345.4000000000001,448.2);
    ctx.bezierCurveTo(341.5000000000001,442.09999999999997,314.30000000000007,416.2,305.80000000000007,410.7);
    ctx.bezierCurveTo(301.1000000000001,407.59999999999997,296.6000000000001,405,296.00000000000006,405);
    ctx.bezierCurveTo(295.30000000000007,405,293.6000000000001,404.1,292.20000000000005,403);
    ctx.bezierCurveTo(290.80000000000007,401.9,288.40000000000003,401,286.90000000000003,401);
    ctx.bezierCurveTo(285.40000000000003,401,282.40000000000003,400.4,280.3,399.6);
    ctx.bezierCurveTo(277.8,398.70000000000005,268.5,398,253.9,397.5);
    ctx.bezierCurveTo(236.20000000000002,396.9,231.1,396.5,229.8,395.3);
    ctx.bezierCurveTo(228.9,394.5,226.4,393.6,224.3,393.2);
    ctx.bezierCurveTo(222.20000000000002,392.9,219.8,392,218.9,391.3);
    ctx.bezierCurveTo(218.1,390.6,216.1,389.7,214.4,389.3);
    ctx.bezierCurveTo(211.4,388.6,205.8,386.3,198.70000000000002,382.7);
    ctx.bezierCurveTo(196.8,381.8,194.6,381,194,381);
    ctx.bezierCurveTo(193.4,381,191.7,380.1,190.3,379);
    ctx.bezierCurveTo(188.9,377.9,186.9,377,185.9,377);
    ctx.bezierCurveTo(184.9,377,182.4,376,180.4,374.8);
    ctx.bezierCurveTo(177.3,373,175.1,372.6,167,372.6);
    ctx.bezierCurveTo(157.8,372.5,157.1,372.70000000000005,152.9,375.5);
    ctx.bezierCurveTo(148.9,378.2,140.70000000000002,384.5,137,387.8);
    ctx.bezierCurveTo(136.2,388.5,132.6,391.40000000000003,129,394.2);
    ctx.bezierCurveTo(125.4,397,122.3,399.59999999999997,122,400);
    ctx.bezierCurveTo(121,401.3,106.5,412.8,104.3,414);
    ctx.bezierCurveTo(101.39999999999999,415.5,100.6,418.6,102.2,421.6);
    ctx.bezierCurveTo(102.9,423,106.10000000000001,429.20000000000005,109.3,435.6);
    ctx.bezierCurveTo(112.5,441.90000000000003,115.5,447.40000000000003,116.1,447.70000000000005);
    ctx.bezierCurveTo(116.6,448.00000000000006,117,449.20000000000005,117,450.30000000000007);
    ctx.bezierCurveTo(117,451.4000000000001,118,454.4000000000001,119.1,456.9000000000001);
    ctx.bezierCurveTo(120.69999999999999,460.30000000000007,121,462.2000000000001,120.39999999999999,464.0000000000001);
    ctx.bezierCurveTo(119.19999999999999,467.5000000000001,117.49999999999999,467.7000000000001,114.49999999999999,464.7000000000001);
    ctx.bezierCurveTo(106.89999999999999,457.1000000000001,100.89999999999999,457.9000000000001,95.79999999999998,467.2000000000001);
    ctx.bezierCurveTo(92.59999999999998,473.0000000000001,90.59999999999998,474.3000000000001,88.29999999999998,471.9000000000001);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = "#e32c16";
    ctx.beginPath();
    ctx.moveTo(347,164.1);
    ctx.bezierCurveTo(338.9,159.79999999999998,336.5,146.29999999999998,342.3,138.6);
    ctx.bezierCurveTo(345.40000000000003,134.5,351,132.4,356.2,133.4);
    ctx.bezierCurveTo(360,134.1,365.3,139,366.9,143.3);
    ctx.bezierCurveTo(370.8,153.5,363.4,166,353.5,166);
    ctx.bezierCurveTo(351.8,166,348.9,165.2,347,164.1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.restore();
};

var drawBackground = function(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.lineTo(1200,0);
    ctx.lineTo(1200,750);
    ctx.lineTo(0,750);
    ctx.closePath();
    ctx.clip();
    ctx.translate(0,0);
    ctx.translate(0,0);
    ctx.scale(1,1);
    ctx.translate(0,0);
    ctx.strokeStyle = 'rgba(0,0,0,0)';
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 4;
    ctx.save();
    ctx.restore();
    ctx.save();
    ctx.save();
    ctx.fillStyle = "#fad2dc";
    ctx.beginPath();
    ctx.moveTo(0,375);
    ctx.lineTo(0,0);
    ctx.lineTo(600,0);
    ctx.lineTo(1200,0);
    ctx.lineTo(1200,375);
    ctx.lineTo(1200,750);
    ctx.lineTo(600,750);
    ctx.lineTo(0,750);
    ctx.lineTo(0,375);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = "#fad2db";
    ctx.beginPath();
    ctx.moveTo(0,500.92857);
    ctx.bezierCurveTo(0,286.52462,0.19862547,251.65852,1.4270414,250.4301);
    ctx.bezierCurveTo(2.6561425,249.201,47.631808,248.96764,325.67704,248.74773);
    ctx.lineTo(648.5,248.4924);
    ctx.lineTo(324.42855,248.4962);
    ctx.bezierCurveTo(65.171381,248.49924,0.60710626,248.25,1.6071226,247.25);
    ctx.bezierCurveTo(2.6020351,246.2551,69.504773,246,329.42857,246);
    ctx.bezierCurveTo(619.04762,246,656,246.16973,656,247.5);
    ctx.bezierCurveTo(656,248.72295,657.67322,249,665.05902,249);
    ctx.bezierCurveTo(670.04148,249,673.87541,248.60743,673.57887,248.12762);
    ctx.bezierCurveTo(673.2823400000001,247.64781000000002,674.71828,246.97776000000002,676.7698600000001,246.63863);
    ctx.bezierCurveTo(678.82144,246.29949000000002,796.7446400000001,246.01706000000001,938.8214300000002,246.01101);
    ctx.bezierCurveTo(1144.1570000000002,246.00201,1197.3993000000003,246.25639,1198.3929000000003,247.25);
    ctx.bezierCurveTo(1199.3929000000003,248.25,1148.7286000000004,248.49904,945.0714600000003,248.49519);
    ctx.lineTo(690.5000000000003,248.49019);
    ctx.lineTo(943.8233700000003,248.74695000000003);
    ctx.bezierCurveTo(1161.6344000000004,248.96771000000004,1197.3467000000003,249.20370000000003,1198.5734000000002,250.43033000000003);
    ctx.bezierCurveTo(1199.8012,251.65820000000002,1200.0000000000002,286.55815,1200.0000000000002,500.92839000000004);
    ctx.lineTo(1200,750);
    ctx.lineTo(600,750);
    ctx.lineTo(0,750);
    ctx.lineTo(0,500.92857);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = "#e0bcc4";
    ctx.beginPath();
    ctx.moveTo(0,500.92857);
    ctx.bezierCurveTo(0,286.4,0.19812364,251.65902,1.4285714,250.42857);
    ctx.bezierCurveTo(3.5867145000000002,248.27043,1196.4133,248.27043,1198.5714,250.42857);
    ctx.bezierCurveTo(1199.8019,251.65902,1200,286.4,1200,500.92857000000004);
    ctx.lineTo(1200,750);
    ctx.lineTo(600,750);
    ctx.lineTo(0,750);
    ctx.lineTo(0,500.92857);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = "#debcc4";
    ctx.beginPath();
    ctx.moveTo(0,500.92857);
    ctx.bezierCurveTo(0,286.45901,0.19836138,251.65878,1.4278466,250.4293);
    ctx.bezierCurveTo(3.5837633,248.27338,1196.4173,248.27443,1198.5732,250.43035);
    ctx.bezierCurveTo(1199.8013,251.65844,1200,286.5451,1200,500.92857);
    ctx.lineTo(1200,750);
    ctx.lineTo(600,750);
    ctx.lineTo(0,750);
    ctx.lineTo(0,500.92857);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = "#a38990";
    ctx.beginPath();
    ctx.moveTo(0,500.60699);
    ctx.bezierCurveTo(0,274.11567,0.14525512,251.15824,1.5817875,250.60699);
    ctx.bezierCurveTo(3.6501079,249.8133,1196.3499,249.8133,1198.4182,250.60699);
    ctx.bezierCurveTo(1199.8547,251.15824,1200,274.11567,1200,500.60699);
    ctx.lineTo(1200,750);
    ctx.lineTo(600,750);
    ctx.lineTo(0,750);
    ctx.lineTo(0,500.60699);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = "#56484c";
    ctx.beginPath();
    ctx.moveTo(0,500.5);
    ctx.lineTo(0,251);
    ctx.lineTo(600,251);
    ctx.lineTo(1200,251);
    ctx.lineTo(1200,500.5);
    ctx.lineTo(1200,750);
    ctx.lineTo(600,750);
    ctx.lineTo(0,750);
    ctx.lineTo(0,500.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = "#1a1617";
    ctx.beginPath();
    ctx.moveTo(0,500.75);
    ctx.lineTo(0,251.5);
    ctx.lineTo(600,251.5);
    ctx.lineTo(1200,251.5);
    ctx.lineTo(1200,500.75);
    ctx.lineTo(1200,750);
    ctx.lineTo(600,750);
    ctx.lineTo(0,750);
    ctx.lineTo(0,500.75);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.moveTo(0,500.5);
    ctx.bezierCurveTo(0,334.83333,0.33600534,251,1,251);
    ctx.bezierCurveTo(1.55,251,2,251.45,2,252);
    ctx.bezierCurveTo(2,252.66555,202,253,600,253);
    ctx.bezierCurveTo(998,253,1198,252.66555,1198,252);
    ctx.bezierCurveTo(1198,251.45,1198.45,251,1199,251);
    ctx.bezierCurveTo(1199.664,251,1200,334.83333,1200,500.5);
    ctx.lineTo(1200,750);
    ctx.lineTo(600,750);
    ctx.lineTo(0,750);
    ctx.lineTo(0,500.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.restore();
    ctx.restore();
};

var drawWall = function(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.lineTo(1024,0);
    ctx.lineTo(1024,1024);
    ctx.lineTo(0,1024);
    ctx.closePath();
    ctx.clip();
    ctx.translate(0,0);
    ctx.translate(0,0);
    ctx.scale(1,1);
    ctx.translate(0,0);
    ctx.strokeStyle = 'rgba(0,0,0,0)';
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 4;
    ctx.save();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = "#c9c9c9";
    ctx.beginPath();
    ctx.moveTo(0,2.1694915);
    ctx.lineTo(1024,2.1694915);
    ctx.lineTo(1024,1026.1695);
    ctx.lineTo(0,1026.1695);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.transform(2,0,0,2,0,2.1694915);
    ctx.save();
    ctx.fillStyle = "#d0021b";
    ctx.beginPath();
    ctx.moveTo(494,18.02);
    ctx.lineTo(393,18.123);
    ctx.lineTo(393,119);
    ctx.lineTo(494,119);
    ctx.closePath();
    ctx.moveTo(375,18.14);
    ctx.lineTo(137,18.387);
    ctx.lineTo(137,119);
    ctx.lineTo(375,119);
    ctx.closePath();
    ctx.moveTo(119,18.406);
    ctx.lineTo(18,18.51);
    ctx.lineTo(18,119);
    ctx.lineTo(119,119);
    ctx.closePath();
    ctx.moveTo(18,137);
    ctx.lineTo(18,247);
    ctx.lineTo(247,247);
    ctx.lineTo(247,137);
    ctx.closePath();
    ctx.moveTo(494,137);
    ctx.lineTo(494,247);
    ctx.lineTo(723,247);
    ctx.lineTo(723,137);
    ctx.closePath();
    ctx.moveTo(476,265);
    ctx.lineTo(476,375);
    ctx.lineTo(577,375);
    ctx.lineTo(577,265);
    ctx.closePath();
    ctx.moveTo(696,265);
    ctx.lineTo(696,375);
    ctx.lineTo(934,375);
    ctx.lineTo(934,265);
    ctx.closePath();
    ctx.moveTo(1190,265);
    ctx.lineTo(1190,375);
    ctx.lineTo(1291,375);
    ctx.lineTo(1291,265);
    ctx.closePath();
    ctx.moveTo(18,393);
    ctx.lineTo(18,493.98);
    ctx.lineTo(247,493.744);
    ctx.lineTo(247,393);
    ctx.closePath();
    ctx.moveTo(494,393);
    ctx.lineTo(494,493.727);
    ctx.lineTo(723,493.48999999999995);
    ctx.lineTo(723,392.99999999999994);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.restore();
    ctx.restore();
};

var display = document.getElementById('display');
var map = new Map(12);
var controls = new Controls();
var camera = new Camera(display, MOBILE ? 160 : 320, 0.8);
var loop = new GameLoop();
var player = new Player(map, Math.PI * 0.3);

loop.start(function frame(seconds) {
    map.update(seconds);
    player.update(controls.states, map, seconds);
    camera.render(player, map);
});
})();