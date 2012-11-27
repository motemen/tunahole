var express = require('express'),
    app     = express(),
    server  = require('http').createServer(app),
    io      = require('socket.io').listen(server);

var config = process.argv[2].split(/:/),
    baseDomain = config[0],
    listenPort = config[1],
    domainRe   = new RegExp('^(.+?)\\.' + baseDomain.replace(/\W/g, '\\$&') + '$');

var entries = {};

var baseApp = express();

baseApp.use(express.bodyParser());

baseApp.get ('/', function (req, res) {
    res.send('tunahole');
});

baseApp.post('/', function (req, res) {
    var name = req.param('name');
    var socket = io
        .of('/-/' + name)
        .on('connection', function (socket) {
            socket.on('response.header', function (data) {
                var res = entries[name].responses[data.id];
                res.writeHead(data.statusCode, data.headers);
            });
            socket.on('response.body', function (data) {
                var res = entries[name].responses[data.id];
                var buffer = new Buffer(data.body, 'base64');
                res.write(buffer);
            });
            socket.on('response.end', function (data) {
                var res = entries[name].responses[data.id];
                res.end();
            });
        })
    entries[name] = {
        socket: socket,
        responses: {}
    };
    res.send(201)
});

var tunnelApp = function (name, req, res) {
    var entry = entries[name];
    if (!entry) {
        res.send(404);
        return;
    }

    function genId () { return Math.random().toString(36).substring(2) }

    var id = genId();
    entry.responses[id] = res;
    entry.socket.emit('request.header', {
        id: id,
        url: req.url,
        method: req.method,
        headers: req.headers
    });
    req.on('data', function (chunk) {
        entry.socket.emit('request.body', {
            id: id,
            body: chunk.toString('base64')
        });
    });
    req.on('end', function () { entry.socket.emit('request.end', { id: id }) });
};

app.use(function (req, res, next) {
    if (req.host === baseDomain) {
        return baseApp(req, res, next);
    }

    var m = domainRe.exec(req.host);
    if (m) {
        return tunnelApp(m[1], req, res);
    }

    console.log('Could not handle host:', req.host);
    return next();
});

server.listen(listenPort);
