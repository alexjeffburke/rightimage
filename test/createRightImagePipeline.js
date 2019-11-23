const unexpected = require("unexpected");
const fs = require("fs");
const path = require("path");
const stream = require("stream");

const expect = unexpected
    .clone()
    .use(require("unexpected-exif"))
    .use(require("unexpected-image"));

const TEST_DATA_PATH = path.resolve(__dirname, "..", "testdata");

const createRightImagePipeline = require("../lib/createRightImagePipeline");

function createPromiseFromStream(stream) {
    return new Promise(function(resolve, reject) {
        var chunks = [];

        // attach handlers
        stream
            .on("data", function(chunk) {
                chunks.push(chunk);
            })
            .on("end", function() {
                resolve(Buffer.concat(chunks));
            })
            .on("error", reject);

        // ensure data is flowing
        stream.resume();
    });
}

describe("createRightImagePipeline", () => {
    it("should throw on a non-image content type", () => {
        return expect(
            function(cb) {
                createRightImagePipeline(
                    {
                        contentType: "text/plain"
                    },
                    cb
                );
            },
            "to call the callback with error",
            "unsupported input type: text/plain"
        );
    });

    it("should throw on an unsuppported image content type", () => {
        return expect(
            function(cb) {
                createRightImagePipeline(
                    {
                        contentType: "image/x-unknown"
                    },
                    cb
                );
            },
            "to call the callback with error",
            "unsupported input type: image/x-unknown"
        );
    });

    it("should error on an unsupported output type", () => {
        const imageFileStream = fs.createReadStream(
            path.join(TEST_DATA_PATH, "tiny.png")
        );

        return expect(
            function(cb) {
                createRightImagePipeline(
                    {
                        contentType: "image/png",
                        inputStream: imageFileStream,
                        imageOptions: { setFormat: "ico" }
                    },
                    cb
                );
            },
            "to call the callback with error",
            "unsupported output type: image/ico"
        );
    });

    it("should error on an unsupported operation", () => {
        const imageFileStream = fs.createReadStream(
            path.join(TEST_DATA_PATH, "tiny.png")
        );

        return expect(
            function(cb) {
                createRightImagePipeline(
                    {
                        contentType: "image/png",
                        inputStream: imageFileStream,
                        imageOptions: { transnothingify: undefined }
                    },
                    cb
                );
            },
            "to call the callback with error",
            "unsupported operation transnothingify=[]"
        );
    });

    it("should error when an imageOptions property is not valid", () => {
        const imageFileStream = fs.createReadStream(
            path.join(TEST_DATA_PATH, "tiny.png")
        );

        return expect(
            function(cb) {
                createRightImagePipeline(
                    {
                        contentType: "image/jpeg",
                        inputStream: imageFileStream,
                        imageOptions: {
                            notanoption: ""
                        }
                    },
                    cb
                );
            },
            "to call the callback with error",
            "unsupported argument for notanoption"
        );
    });

    it("should error when an operation argument could not be mapped", () => {
        const imageFileStream = fs.createReadStream(
            path.join(TEST_DATA_PATH, "tiny.png")
        );

        return expect(
            function(cb) {
                createRightImagePipeline(
                    {
                        contentType: "image/jpeg",
                        inputStream: imageFileStream,
                        imageOptions: {
                            resize: "30-30"
                        }
                    },
                    cb
                );
            },
            "to call the callback with error",
            "invalid argument for resize 30-30"
        );
    });

    it("should allow a resize option to be supplied as a string", () => {
        const imageFileStream = fs.createReadStream(
            path.join(TEST_DATA_PATH, "test.jpg")
        );

        return expect(function(cb) {
            createRightImagePipeline(
                {
                    contentType: "image/jpeg",
                    inputStream: imageFileStream,
                    imageOptions: {
                        resize: "30x30"
                    }
                },
                cb
            );
        }, "to call the callback without error").then(([pipelineResult]) => {
            const { outputStream, outputTransformed } = pipelineResult;

            outputStream.resume();

            expect(outputTransformed, "to be true");
        });
    });

    it("should allow no image options to be supplied", () => {
        const imageFileStream = fs.createReadStream(
            path.join(TEST_DATA_PATH, "tiny.png")
        );

        return expect(function(cb) {
            createRightImagePipeline(
                {
                    contentType: "image/png",
                    inputStream: imageFileStream
                },
                cb
            );
        }, "to call the callback without error").then(([pipelineResult]) => {
            const { outputStream, outputTransformed } = pipelineResult;

            outputStream.resume();

            expect(outputTransformed, "to be false");
        });
    });

    it("should allow image options to be post-processed", () => {
        const imageFileStream = fs.createReadStream(
            path.join(TEST_DATA_PATH, "tiny.png")
        );
        let postProcessArgs = null;

        return expect(function(cb) {
            createRightImagePipeline(
                {
                    contentType: "image/png",
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
                "image/png",
                { foo: "bar" },
                { animated: false }
            ]);
            expect(outputTransformed, "to be false");
        });
    });

    it("should combine detected rotation with a custom rotate", () => {
        const imageFileStream = fs.createReadStream(
            path.join(TEST_DATA_PATH, "test.jpg")
        );

        return expect(function(cb) {
            createRightImagePipeline(
                {
                    contentType: "image/jpeg",
                    inputStream: imageFileStream,
                    imageOptions: { rotate: 270 }
                },
                cb
            );
        }, "to call the callback without error")
            .then(([{ outputStream }]) => createPromiseFromStream(outputStream))
            .then(outputBuffer =>
                expect(outputBuffer, "to have EXIF data satisfying", {
                    tags: {
                        Orientation: 6 // check the orientation changed
                    }
                })
            );
    });

    describe("image/jpeg", () => {
        it("should use JpegTran when rotating without a format conversion", () => {
            let fakeJpegTranArgs;
            const fakeJpegTranStream = new stream.PassThrough();
            const FakeJpegTran = function(...args) {
                fakeJpegTranArgs = args;
                return fakeJpegTranStream;
            };
            setImmediate(() => {
                fakeJpegTranStream.push(null);
            });
            const imageFileStream = fs.createReadStream(
                path.join(TEST_DATA_PATH, "test.jpg")
            );

            return expect(function(cb) {
                createRightImagePipeline(
                    {
                        contentType: "image/jpeg",
                        inputStream: imageFileStream,
                        _JpegTran: FakeJpegTran
                    },
                    cb
                );
            }, "to call the callback without error")
                .then(([{ outputStream }]) => {
                    outputStream.resume();
                })
                .then(() => {
                    expect(fakeJpegTranArgs, "to equal", [["-rotate", 90]]);
                });
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
                            // check the orientation changed
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
