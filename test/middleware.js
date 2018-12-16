const unexpected = require("unexpected");
const stream = require("stream");

const app = require("../examples/app");

function createExpectForExamleApp() {
    return unexpected
        .clone()
        .use(require("unexpected-express"))
        .use(require("unexpected-mitm"))
        .addAssertion("<any> to yield response <any>", function(
            expect,
            subject,
            value
        ) {
            if (typeof subject === "string") {
                subject = { url: subject };
            }

            return expect(app, "to yield exchange", {
                request: subject,
                response: value
            });
        });
}

describe("middleware", () => {
    it("should pass through an image", () => {
        const expect = createExpectForExamleApp();

        return expect("GET /test.jpg", "to yield response", 200);
    });

    it("should pass through an image underneath the byte count", () => {
        const expect = createExpectForExamleApp();

        return expect("GET /tiny.png", "to yield response", 200);
    });

    describe("when the stream errors", () => {
        it("should forward the error while buffering EXIF", function() {
            const theError = new Error("Fake error");
            const requestStream = new stream.Readable();
            requestStream._read = (num, cb) => {
                requestStream._read = () => {};
                requestStream.push("foobarquux");
                setImmediate(() => {
                    requestStream.emit("error", theError);
                });
            };

            const expect = createExpectForExamleApp();

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
    });
});
