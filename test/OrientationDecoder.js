const expect = require("unexpected");
const fs = require("fs");
const path = require("path");

const OrientationDecoder = require("../lib/OrientationDecoder");

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
});
