var http = require('http'),
    io   = require('socket.io-client');

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
    var socket = io.connect('http://' + remoteHost + ':' + remotePort + '/-/' + name);

    socket.on('connect', function () {
        console.log('tunnel opened at http://' + name + '.' + remoteHost + ':' + remotePort);
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

            res.on('data', function (chunk) {
                socket.emit('response.body', {
                    id: id,
                    body: chunk.toString('base64')
                });
            });

            res.on('end', function () {
                socket.emit('response.end', { id: id })
            });
        });

        socket.on('request.body', function (data) {
            var buffer = new Buffer(data.body, 'base64');
            req.write(buffer);
        });

        socket.on('request.end', function (d) {
            req.end();
        });
    });
});

registerReq.write('name=' + encodeURIComponent(name));
registerReq.end();

/**
 * node tuna-client hoge:9999:local.hatena.com:8877
 */
