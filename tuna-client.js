var http = require('http'),
    io   = require('socket.io-client'),
    util = require('./util');

var config = process.argv[2].split(/:/),
    name       = config[0],
    localPort  = config[1],
    remoteHost = config[2],
    remotePort = config[3] || 80;

var registerReq = http.request({
    host: remoteHost,
    port: remotePort,
    path: '/',
    method: 'POST',
    headers: {
        'content-type': 'application/x-www-form-urlencoded'
    }
}, function (res) {
    if (!(200 <= res.statusCode && res.statusCode < 300)) {
        var body = ''
        res.on('data', function (chunk) { body += chunk });
        res.on('end',  function () {
            console.log('Could not register: [' + res.statusCode + '] ' + body);
        });
        return;
    }

    var socket = io.connect('http://' + remoteHost + ':' + remotePort + '/-/' + name);

    socket.on('connect', function () {
        console.log('tunnel opened at ' + res.headers['location']);
    });

    socket.on('request.header', function (data) {
        delete data.headers.connection;
        // TODO drop other headers

        var id = data.id;
        var req = http.request({
            host: 'localhost',
            port: localPort,
            path: data.url,
            method: data.method,
            headers: data.headers
        }, function (res) {
            socket.emit('response.header', {
                id: id,
                statusCode: res.statusCode,
                headers: res.headers
            });

            res.pipe(util.toWritableStream(socket, 'response', id));
        });

        util.toReadableStream(socket, 'request', id).pipe(req);
    });
});

registerReq.write('name=' + encodeURIComponent(name));
registerReq.end();

/**
 * node tuna-client hoge:9999:local.hatena.com:8877
 */
