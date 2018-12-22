const expect = require("unexpected");
const fs = require("fs");
const path = require("path");

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
        let sawPostProcessCall = false;

        return expect(function(cb) {
            createRightImagePipeline(
                {
                    contentType: "image/jpeg",
                    inputStream: imageFileStream,
                    imageOptions: { foo: "bar" },
                    postProcessImageOptions: () => {
                        sawPostProcessCall = true;

                        return null;
                    }
                },
                cb
            );
        }, "to call the callback without error").then(([pipelineResult]) => {
            const { outputStream, outputTransformed } = pipelineResult;

            outputStream.resume();

            expect(sawPostProcessCall, "to be true");
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
    });
});
