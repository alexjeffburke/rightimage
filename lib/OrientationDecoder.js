const EventEmitter = require("events");
const util = require("util");

const createOrientationDecodingStream = require("./createOrientationDecodingStream");

function OrientationDecoder(inputStream) {
    EventEmitter.call(this);

    createOrientationDecodingStream(
        inputStream,
        (err, { buffer, stream: orientedStream, rotate }) => {
            if (err) {
                return this.emit("error", err);
            }

            this.emit("identify", buffer);

            if (typeof rotate === "number") {
                this.emit("rotation", rotate);
            }

            this.emit("stream", orientedStream);
        }
    );
}

util.inherits(OrientationDecoder, EventEmitter);

module.exports = OrientationDecoder;
