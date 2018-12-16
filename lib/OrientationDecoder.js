const EventEmitter = require("events");
const util = require("util");

const createOrientationDecodingStream = require("./createOrientationDecodingStream");

function OrientationDecoder(inputStream) {
    EventEmitter.call(this);

    createOrientationDecodingStream(
        inputStream,
        (err, { stream: orientedStream, rotate }) => {
            if (err) {
                this.emit("error", err);
                return;
            }

            if (typeof rotate === "number") {
                this.emit("rotation", rotate);
            }

            this.emit("stream", orientedStream);
        }
    );
}

util.inherits(OrientationDecoder, EventEmitter);

module.exports = OrientationDecoder;
