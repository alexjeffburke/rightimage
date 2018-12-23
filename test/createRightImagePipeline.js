const unexpected = require("unexpected");
const fs = require("fs");
const path = require("path");

const expect = unexpected.clone().use(require("unexpected-image"));

const TEST_DATA_PATH = path.resolve(__dirname, "..", "testdata");

const createRightImagePipeline = require("../lib/createRightImagePipeline");

function createPromiseFromStream(stream) {
    return new Promise(function(resolve, reject) {
        var chunks = [];
        stream
            .on("data", function(chunk) {
                chunks.push(chunk);
            })
            .on("end", function() {
                resolve(Buffer.concat(chunks));
            })
            .on("error", reject);
    });
}

describe("createRightImagePipeline", () => {
    it("should allow image options to be post-processed", () => {
        const imageFileStream = fs.createReadStream(
            path.join(TEST_DATA_PATH, "tiny.png")
        );
        let postProcessArgs = null;

        return expect(function(cb) {
            createRightImagePipeline(
                {
                    contentType: "image/jpeg",
                    inputStream: imageFileStream,
                    imageOptions: { foo: "bar" },
                    postProcessImageOptions: (...args) => {
                        postProcessArgs = args;

                        return null;
                    }
                },
                cb
            );
        }, "to call the callback without error").then(([pipelineResult]) => {
            const { outputStream, outputTransformed } = pipelineResult;

            outputStream.resume();

            expect(postProcessArgs, "to equal", [
                "image/jpeg",
                { foo: "bar" },
                { animated: false }
            ]);
            expect(outputTransformed, "to be false");
        });
    });

    describe("image/gif", () => {
        it("should pass through an image", () => {
            const imageFileStream = fs.createReadStream(
                path.join(TEST_DATA_PATH, "test.gif")
            );
            const imageFileBuffer = fs.readFileSync(
                path.join(TEST_DATA_PATH, "test.gif")
            );

            return expect(function(cb) {
                createRightImagePipeline(
                    {
                        contentType: "image/gif",
                        inputStream: imageFileStream,
                        imageOptions: { rotate: 0 }
                    },
                    cb
                );
            }, "to call the callback without error")
                .then(([{ outputStream }]) =>
                    createPromiseFromStream(outputStream)
                )
                .then(outputBuffer => {
                    expect(outputBuffer, "to equal", imageFileBuffer);
                });
        });

        it("should pass through an image when rotation is specified but not required", () => {
            const imageFileStream = fs.createReadStream(
                path.join(TEST_DATA_PATH, "test.gif")
            );
            const imageFileBuffer = fs.readFileSync(
                path.join(TEST_DATA_PATH, "test.gif")
            );

            return expect(function(cb) {
                createRightImagePipeline(
                    {
                        contentType: "image/gif",
                        inputStream: imageFileStream,
                        imageOptions: { rotate: 0 }
                    },
                    cb
                );
            }, "to call the callback without error")
                .then(([{ outputStream }]) =>
                    createPromiseFromStream(outputStream)
                )
                .then(outputBuffer => {
                    expect(outputBuffer, "to equal", imageFileBuffer);
                });
        });

        it("should allow rotation to be specified as an integer", () => {
            const imageFileStream = fs.createReadStream(
                path.join(TEST_DATA_PATH, "test.gif")
            );

            return expect(function(cb) {
                createRightImagePipeline(
                    {
                        contentType: "image/gif",
                        inputStream: imageFileStream,
                        imageOptions: { rotate: 90 }
                    },
                    cb
                );
            }, "to call the callback without error")
                .then(([{ outputStream }]) =>
                    createPromiseFromStream(outputStream)
                )
                .then(outputBuffer =>
                    expect(
                        outputBuffer,
                        "to have metadata satisfying",
                        expect.it(({ size }) => {
                            // check image orientation changed
                            expect(
                                size.height,
                                "to be greater than",
                                size.width
                            );
                        })
                    )
                );
        });

        it("should correctly detect an animated GIF", () => {
            const imageFileStream = fs.createReadStream(
                path.join(TEST_DATA_PATH, "test.gif")
            );
            let postProcessArgs = null;

            return expect(function(cb) {
                createRightImagePipeline(
                    {
                        contentType: "image/gif",
                        inputStream: imageFileStream,
                        imageOptions: null,
                        postProcessImageOptions: (...args) => {
                            postProcessArgs = args;

                            return null;
                        }
                    },
                    cb
                );
            }, "to call the callback without error").then(
                ([pipelineResult]) => {
                    const { outputStream } = pipelineResult;

                    outputStream.resume();

                    expect(postProcessArgs, "to equal", [
                        "image/gif",
                        null,
                        { animated: true }
                    ]);
                }
            );
        });
    });
});
