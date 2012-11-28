var Stream = require('stream').Stream,
    util   = require('util');

function WritableSocketStream (socket, prefix, id) {
    this.socket = socket;
    this.prefix = prefix;
    this.id     = id;

    Stream.call(this);
    this.writable = true;
}
util.inherits(WritableSocketStream, Stream);

WritableSocketStream.prototype.write = function (chunk) {
    this.socket.emit(this.prefix + '.body', {
        id: this.id,
        body: chunk.toString('base64')
    });
};

WritableSocketStream.prototype.end = function () {
    this.socket.emit(this.prefix + '.end', {
        id: this.id
    });
};

function ReadableSocketStream (socket, prefix, id) {
    var stream = this;

    Stream.call(this);
    this.readable = true;

    socket.on(prefix + '.body', function (data) {
        if (data.id !== id) return;
        var buffer = new Buffer(data.body, 'base64');
        stream.emit('data', buffer);
    });

    socket.on(prefix + '.end', function (data) {
        if (data.id !== id) return;
        stream.emit('end');
    });
}
util.inherits(ReadableSocketStream, Stream);

exports.toWritableStream = function (socket, prefix, id) {
    return new WritableSocketStream(socket, prefix, id);
};
exports.toReadableStream = function (socket, prefix, id) {
    return new ReadableSocketStream(socket, prefix, id);
};
