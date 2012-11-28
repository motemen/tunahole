var express = require('express'),
    app     = express(),
    server  = require('http').createServer(app),
    io      = require('socket.io').listen(server),
    util    = require('./util');

var config = process.argv[2].split(/:/),
    baseDomain = config[0],
    listenPort = config[1],
    domainRe   = new RegExp(baseDomain.replace(/(\W)/g, function ($1) { return $1 === '*' ? '(.+?)' : '\\' + $1 }));

function Connection (name, socket) {
    this.name   = name;
    this.socket = socket;
}

Connection.register = function (name, socket) {
    return Connection.all[name] = new Connection(name, socket);
};

Connection.all = {};

var subapp = {};

subapp.manager = express();

subapp.manager.use(express.bodyParser());

subapp.manager.get ('/', function (req, res) {
    res.send('tunahole');
});

subapp.manager.post('/', function (req, res) {
    var name = req.param('name');

    io.of('/-/' + name).on('connection', function (socket) {
        // TODO accept only one connection
        Connection.register(name, socket);
    });
    // TODO unregister

    res.writeHead(201, { Location: baseDomain.replace(/\*/, name) });
    res.end();
});

subapp.tunnel = function (name, req, res) {
    var connection = Connection.all[name];
    if (!connection) {
        res.send(404);
        return;
    }

    var id = Math.random().toString(36).substring(2);
    var socket = connection.socket;

    socket.emit('request.header', {
        id: id,
        url: req.url,
        method: req.method,
        headers: req.headers
    });

    req.pipe(util.toWritableStream(socket, 'request', id));

    socket.on('response.header', function (data) {
        if (data.id !== id) return;

        res.writeHead(data.statusCode, data.headers);

        util.toReadableStream(socket, 'response', id).pipe(res);
    });
};

app.use(function (req, res, next) {
    var m = domainRe.exec(req.host);
    if (m) {
        return subapp.tunnel(m[1], req, res);
    }

    return subapp.manager(req, res, next);
});

server.listen(listenPort);
