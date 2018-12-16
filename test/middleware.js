const unexpected = require("unexpected");
const stream = require("stream");

const app = require("../examples/app");

const BYTES_128K = Math.pow(2, 17);
const BYTES_32K = Math.pow(2, 15);
const BYTES_160K = BYTES_128K + BYTES_32K;

const expect = unexpected
    .clone()
    .use(require("unexpected-express"))
    .use(require("unexpected-mitm"))
    .addAssertion("<any> to yield response <any>", (expect, subject, value) => {
        if (typeof subject === "string") {
            subject = { url: subject };
        }

        return expect(app, "to yield exchange", {
            request: subject,
            response: value
        });
    });

describe("middleware", () => {
    it("should pass through a image", () => {
        return expect("GET /test.jpg", "to yield response", 200);
    });

    it("should pass through an image underneath the byte count", () => {
        return expect("GET /tiny.png", "to yield response", 200);
    });

    describe("when the stream errors", () => {
        it("should forward an error while buffering EXIF", function() {
            const theError = new Error("Fake error");
            const requestStream = new stream.Readable();
            requestStream._read = (num, cb) => {
                requestStream._read = () => {};
                requestStream.push("foobarquux");
                setImmediate(() => {
                    requestStream.emit("error", theError);
                });
            };

            return expect(
                {
                    url: "POST /stream/test.jpg",
                    body: requestStream
                },
                "to yield response",
                {
                    errorPassedToNext: theError
                }
            );
        });

        it("should forward an error after buffering is complete", function() {
            const theError = new Error("Fake error");
            const requestStream = new stream.Readable();
            requestStream._read = (num, cb) => {
                requestStream._read = () => {};

                setImmediate(() => {
                    requestStream.push(Buffer.alloc(BYTES_160K));

                    setImmediate(() => {
                        requestStream.emit("error", theError);
                    });
                });
            };

            return expect(
                {
                    url: "POST /stream/something.jpg",
                    body: requestStream
                },
                "to yield response",
                {
                    errorPassedToNext: theError
                }
            );
        });
    });
});
