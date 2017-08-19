function Bitmap(src, width, height) {
    this.image = new Image();
    this.image.src = src;
    this.width = width;
    this.height = height;
}

var camera = (function() {
    var _ctx = null;
    var _width = 0;
    var _height = 0;
    var _resolution = 0;
    var _spacing = 0;
    var _focalLength = 0;
    var _range = 0;
    var _lightRange = 0;
    var _scale = 0;

    var _init = function(canvas, resolution, focalLength) {
        _ctx = canvas.getContext('2d');
        _width = canvas.width = window.innerWidth * 0.5;
        _height = canvas.height = window.innerHeight * 0.5;
        _resolution = resolution;
        _spacing = _width / resolution;
        _focalLength = focalLength || 0.8;
        _range = MOBILE ? 8 : 14;
        _lightRange = 5;
        _scale = (_width + _height) / 1200;
    };

    var _render = function(player, map) {
        _drawSky(player.direction(), map.skybox(), map.light());
        _drawColumns(player, map);
        _drawWeapon(player.weapon(), player.paces);
    };

    var _drawSky = function(direction, sky, ambient) {
        var width = sky.width * (_height / sky.height) * 2;
        var left = (direction / CIRCLE) * -width;

        _ctx.save();
        _ctx.drawImage(sky.image, left, 0, width, _height);
        if (left < width - _width) {
            _ctx.drawImage(sky.image, left + width, 0, width, _height);
        }

        if (ambient > 0) {
            _ctx.fillStyle = '#ffffff';
            _ctx.globalAlpha = ambient * 0.1;
            _ctx.fillRect(0, _height * 0.5, _width, _height * 0.5);
        }
        _ctx.restore();
    };

    var _drawColumns = function(player, map) {
        _ctx.save();
        for (var column = 0; column < _resolution; column++) {
            var x = column / _resolution - 0.5;
            var angle = Math.atan2(x, _focalLength);
            var ray = map.cast(player, player.direction() + angle, _range);
            _drawColumn(column, ray, angle, map);
        }
        _ctx.restore();
    };

    var _drawWeapon = function(weapon, paces) {
        var bobX = Math.cos(paces * 2) * _scale * 6;
        var bobY = Math.sin(paces * 4) * _scale * 6;
        var left = _width * 0.66 + bobX;
        var top = _height * 0.6 + bobY;
        _ctx.drawImage(weapon.image, left, top, weapon.width * _scale,
            weapon.height * _scale);
    };

    var _drawColumn = function(column, ray, angle, map) {
        var ctx = _ctx;
        var texture = map.wallTexture();
        var left = Math.floor(column * _spacing);
        var width = Math.ceil(_spacing);
        var hit = -1;

        while (++hit < ray.length && ray[hit].height <= 0);

        for (var s = ray.length - 1; s >= 0; s--) {
            var step = ray[s];
            var rainDrops = Math.pow(Math.random(), 3) * s;
            var rain = (rainDrops > 0) && _project(0.1, angle, step.distance);

            if (s === hit) {
                var textureX = Math.floor(texture.width * step.offset);
                var wall = _project(step.height, angle, step.distance);

                ctx.globalAlpha = 1;
                ctx.drawImage(texture.image, textureX, 0, 1, texture.height,
                    left, wall.top, width, wall.height);
            
                ctx.fillStyle = '#000000';
                ctx.globalAlpha = Math.max((step.distance + step.shading) /
                    _lightRange - map.light, 0);
                ctx.fillRect(left, wall.top, width, wall.height);
            }
          
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 0.15;
            while (--rainDrops > 0)
                ctx.fillRect(left, Math.random() * rain.top, 1, rain.height);
        }
    };

    var _project = function(height, angle, distance) {
        var z = distance * Math.cos(angle);
        var wallHeight = _height * height / z;
        var bottom = _height / 2 * (1 + 1 / z);
        return {
            top: bottom - wallHeight,
            height: wallHeight
        };
    };

    return {
        init: _init,
        render: _render,
    };
})();

var controls = (function(){
    var _codes  = { 37: 'left', 39: 'right', 38: 'forward', 40: 'backward' };
    var _states = { 'left': false, 'right': false, 'forward': false,
        'backward': false };

    var _init = function() {
        document.addEventListener('keydown', _onKey.bind(this, true), false);
        document.addEventListener('keyup', _onKey.bind(this, false), false);
        document.addEventListener('touchstart', _onTouch.bind(this), false);
        document.addEventListener('touchmove', _onTouch.bind(this), false);
        document.addEventListener('touchend', _onTouchEnd.bind(this), false);
    }

    var _onTouch = function(e) {
        var t = e.touches[0];
        this.onTouchEnd(e);
        if (t.pageY < window.innerHeight * 0.5)
            _onKey(true, { keyCode: 38 });
        else if (t.pageX < window.innerWidth * 0.5)
            _onKey(true, { keyCode: 37 });
        else if (t.pageY > window.innerWidth * 0.5)
            _onKey(true, { keyCode: 39 });
    };

    var _onTouchEnd = function(e) {
        _states = { 'left': false, 'right': false, 'forward': false,
            'backward': false };
        e.preventDefault();
        e.stopPropagation();
    };

    var _onKey = function(val, e) {
        var state = _codes[e.keyCode];
        if (typeof state === 'undefined')
            return;
        _states[state] = val;
        e.preventDefault && e.preventDefault();
        e.stopPropagation && e.stopPropagation();
    };

    return {
        init: _init,
        states: _states,
    };
})();

var gameloop = (function(){
    var _callback = null;
    var _lastTime = 0;

    var _init = function() {
        _frame.bind(this);
    };

    var _start = function(callback) {
        _callback = callback;
        requestAnimationFrame(_frame);
    };

    var _frame = function(time) {
        var seconds = (time - _lastTime) / 1000;
        _lastTime = time;
        if (seconds < 0.2)
            _callback(seconds);
        requestAnimationFrame(_frame);
    };

    return {
        init: _init,
        start: _start,
    };
})();

var map = (function() {
    var _size = 0;
    var _wallGrid = null;
    var _skybox = null;
    var _wallTexture = null;
    var _light = 0;

    var _init = function(size, skybox, wallTexture) {
        _size = size;
        _wallGrid = new Uint8Array(size * size);
        _skybox = skybox;
        _wallTexture = wallTexture;
    };

    var _getLight = function() {
        return _light;
    };

    var _getSkybox = function() {
        return _skybox;
    };

    var _getWallTexture = function() {
        return _wallTexture;
    };

    var _get = function(x, y) {
        x = Math.floor(x);
        y = Math.floor(y);
        if (x < 0 || x > _size - 1 || y < 0 || y > _size - 1)
            return -1;
        return _wallGrid[y * _size + x];
    };

    var _randomize = function() {
        for (var i = 0; i < _size * _size; i++) {
            _wallGrid[i] = Math.random() < 0.3 ? 1 : 0;
        }
    };


    var _cast = function(point, angle, range) {
        var self = this;        
        var sin = Math.sin(angle);
        var cos = Math.cos(angle);
        var noWall = {
            length2: Infinity
        };

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
        };

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
        };

        function inspect(step, shiftX, shiftY, distance, offset) {
            var dx = cos < 0 ? shiftX : 0;
            var dy = sin < 0 ? shiftY : 0;
            step.height = _get(step.x - dx, step.y - dy);
            step.distance = distance + Math.sqrt(step.length2);
            if (shiftX)
                step.shading = cos < 0 ? 2 : 0;
            else
                step.shading = sin < 0 ? 2 : 1;
            step.offset = offset - Math.floor(offset);
            return step;
        };
    };

    var _update = function(seconds) {
        if (_light > 0)
            _light = Math.max(_light - 10 * seconds, 0);
        else if (Math.random() * 5 < seconds)
            _light = 2;
    };

    return {
        init: _init,
        get: _get,
        randomize: _randomize,
        cast: _cast,
        update: _update,
        skybox: _getSkybox,
        wallTexture: _getWallTexture,
        light: _getLight,
    }
})();

var player = (function() {
    var _x = 0;
    var _y = 0;
    var _direction = 0;
    var _weapon = null;
    _paces = 0;

    var _init = function(x, y, direction, weapon) {
        _x = x;
        _y = y;
        _direction = direction;
        _weapon = weapon;
    };

    var _getDirection = function() {
        return _direction;
    };

    var _getWeapon = function() {
        return _weapon;
    }

    var _rotate = function(angle) {
        _direction = (_direction + angle + CIRCLE) % (CIRCLE);
    };

    var _walk = function(distance, map) {
        var dx = Math.cos(_direction) * distance;
        var dy = Math.sin(_direction) * distance;
        if (map.get(_x + dx, _y) <= 0)
            _x += dx;
        if (map.get(_x, _y + dy) <= 0)
            _y += dy;
        _paces += distance;
    };

    var _update = function(controls, map, seconds) {
        if (controls.left)
            _rotate(-Math.PI * seconds);
        if (controls.right)
            _rotate(Math.PI * seconds);
        if (controls.forward)
            _walk(3 * seconds, map);
        if (controls.backward)
            _walk(-3 * seconds, map);
    };

    return {
        init: _init,
        direction: _getDirection,
        weapon: _getWeapon,
        paces: _paces,
        update: _update,
    }
})();


var MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent);
var CIRCLE = Math.PI * 2;

var weapon = new Bitmap("./knife_hand.png", 319, 320);
var skybox = new Bitmap("./deathvalley_panorama.jpg", 2000, 750);
var wallTexture = new Bitmap("./wall_texture.jpg", 1024, 1024);
var display = document.getElementById('display');
player.init(15.3, -1.2, Math.PI * 0.3, weapon);
map.init(32, skybox, wallTexture);
controls.init();
camera.init(display, MOBILE ? 160 : 320, 0.8);
gameloop.init();

map.randomize();

gameloop.start(function(seconds) {
    map.update(seconds);
    player.update(controls.states, map, seconds);
    camera.render(player, map);
});