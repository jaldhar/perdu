
var map = (function() {
    var _size = 0;
    var _wallGrid = null;
    var _skybox = null;
    var _wallTexture = null;
    var _light = 0;

    var _init = function(size) {
        _size = size;
        _wallGrid = new Uint8Array(size * size);
        // _skybox = new Bitmap('assets/deathvalley_panorama.jpg', 2000, 750);
        // _wallTexture = new Bitmap('assets/wall_texture.jpg', 1024, 1024);
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
    }
})();

var g = ga(
    512, 512, setup
);

g.start();

function setup() {
    g.canvas.style.border = "1px solid black";
    g.backgroundColor = "white";
    map.init(32);
    g.state = play;
};

function play() {
};
