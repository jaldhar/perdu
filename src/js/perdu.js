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

function Bitmap(src, width, height) {
    this.image = new Image();
    this.image.src = src;
    this.width = width;
    this.height = height;
}

function Player(x, y, direction, weapon) {
    this.x = x;
    this.y = y;
    this.direction = direction;
    this.weapon = weapon;
    this.paces = 0;
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

function Map(size, skybox, wallTexture) {
    this.size = size;
    this.wallGrid = new Uint8Array(size * size);
    this.skybox = skybox;
    this.wallTexture = wallTexture;
    this.light = 0;
};

Map.prototype.get = function(x, y) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x > this.size - 1 || y < 0 || y > this.size - 1)
        return -1;
    return this.wallGrid[y * this.size + x];
};

Map.prototype.randomize = function() {
    for (var i = 0; i < this.size * this.size; i++) {
        this.wallGrid[i] = Math.random() < 0.3 ? 1 : 0;
    }
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
    this.drawWeapon(player.weapon, player.paces);
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

Camera.prototype.drawColumns = function(player, map) {
    this.ctx.save();
    for (var column = 0; column < this.resolution; column++) {
        var x = column / this.resolution - 0.5;
        var angle = Math.atan2(x, this.focalLength);
        var ray = map.cast(player, player.direction + angle, this.range);
        this.drawColumn(column, ray, angle, map);
    }
    this.ctx.restore();
};

Camera.prototype.drawWeapon = function(weapon, paces) {
    var bobX = Math.cos(paces * 2) * this.scale * 6;
    var bobY = Math.sin(paces * 4) * this.scale * 6;
    var left = this.width * 0.66 + bobX;
    var top = this.height * 0.6 + bobY;
    this.ctx.drawImage(weapon.image, left, top, weapon.width * this.scale,
        weapon.height * this.scale);
};

Camera.prototype.drawColumn = function(column, ray, angle, map) {
    var ctx = this.ctx;
    var texture = map.wallTexture;
    var left = Math.floor(column * this.spacing);
    var width = Math.ceil(this.spacing);
    var hit = -1;

    while (++hit < ray.length && ray[hit].height <= 0);

    for (var s = ray.length - 1; s >= 0; s--) {
        var step = ray[s];

        if (s === hit) {
            var textureX = Math.floor(texture.width * step.offset);
            var wall = this.project(step.height, angle, step.distance);

            ctx.globalAlpha = 1;
            ctx.drawImage(texture.image, textureX, 0, 1, texture.height,
                left, wall.top, width, wall.height);

            ctx.fillStyle = '#000000';
            ctx.globalAlpha = Math.max((step.distance + step.shading) /
                this.lightRange - map.light, 0);
            ctx.fillRect(left, wall.top, width, wall.height);
        }
    }
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
var player = new Player(15.3, -1.2, Math.PI * 0.3,
    new Bitmap('./hand.gif', 319, 320));
var map = new Map(32, new Bitmap('./background.gif', 2000, 750),
    new canvasToImage(drawWall, 1024, 1024));
var controls = new Controls();
var camera = new Camera(display, MOBILE ? 160 : 320, 0.8);
var loop = new GameLoop();
map.randomize();

loop.start(function frame(seconds) {
    map.update(seconds);
    player.update(controls.states, map, seconds);
    camera.render(player, map);
});
})();