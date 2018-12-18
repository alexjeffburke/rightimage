const expect = require("unexpected");
const fs = require("fs");
const path = require("path");

const TEST_DATA_PATH = path.resolve(__dirname, "..", "testdata");

const createRightImagePipeline = require("../lib/createRightImagePipeline");

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
});
