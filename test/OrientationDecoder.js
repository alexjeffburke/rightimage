const expect = require("unexpected");
const fs = require("fs");
const path = require("path");
const stream = require("stream");

const OrientationDecoder = require("../lib/OrientationDecoder");

const BYTES_128K = Math.pow(2, 17);
const BYTES_32K = Math.pow(2, 15);
const BYTES_160K = BYTES_128K + BYTES_32K;
const testDataPath = path.resolve(__dirname, "..", "testdata");

describe("OrientationDecoder", () => {
    it("should decode an image", () => {
        const readStream = fs.createReadStream(
            path.join(testDataPath, "test.jpg")
        );

        const decoder = new OrientationDecoder(readStream);
        const rotationPromise = new Promise((resolve, reject) => {
            let rotate = null;

            decoder.on("rotation", r => (rotate = r));

            decoder.on("stream", stream => {
                stream.resume();
                stream.on("end", () => resolve(rotate));
            });
        });

        return expect(rotationPromise, "to be fulfilled with", 90);
    });

    it("should pass through an image underneath the byte count", () => {
        const readStream = fs.createReadStream(
            path.join(testDataPath, "tiny.png")
        );

        const decoder = new OrientationDecoder(readStream);
        const rotationPromise = new Promise((resolve, reject) => {
            let rotate = null;

            decoder.on("rotation", r => (rotate = r));

            decoder.on("stream", stream => {
                stream.resume();
                stream.on("end", () => resolve(rotate));
            });
        });

        return expect(rotationPromise, "to be fulfilled with", null);
    });

    describe("when the stream errors", () => {
        it("should forward while buffering", function() {
            const theError = new Error("Fake error");
            const requestStream = new stream.Readable();
            requestStream._read = (num, cb) => {
                requestStream.push(Buffer.alloc(BYTES_32K));
                requestStream._read = () => {
                    setImmediate(() => {
                        requestStream.emit("error", theError);
                    });
                };
            };

            const decoder = new OrientationDecoder(requestStream);
            const rotationPromise = new Promise((resolve, reject) => {
                decoder.on("error", error => reject(error));
            });

            return expect(rotationPromise, "to be rejected with", theError);
        });

        it("should not deal with errors after buffering is complete", function() {
            const theError = new Error("Fake error");
            const requestStream = new stream.Readable();
            requestStream._read = (num, cb) => {
                requestStream._read = () => {};
                requestStream.push(Buffer.alloc(BYTES_160K));
            };

            const decoder = new OrientationDecoder(requestStream);
            const rotationPromise = new Promise((resolve, reject) => {
                decoder.on("stream", stream => {
                    // catch the transition to after buffering and arrange for an error
                    setImmediate(() => {
                        requestStream.emit("error", theError);
                    });

                    // the expected error should now come out on the output stream
                    stream.on("error", error => reject(error));
                });

                decoder.on("error", () => resolve());
            });

            return expect(rotationPromise, "to be rejected with", theError);
        });
    });
});
