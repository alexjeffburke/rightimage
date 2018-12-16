const BufferedStream = require("bufferedstream");
const exifParser = require("exif-parser");

const BYTES_128K = Math.pow(2, 17);
const IMAGE_ORIENTATIONS_TO_ANGLE = {
    3: 180,
    6: 90,
    8: 270
};

function streamCollectSizeBytesAndReturn(stream, sizeLimit, callback) {
    const chunks = [];
    let seenBytes = 0;
    let sawEnded = false;

    stream.on("data", function sizeChecker(chunk) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : new Buffer(chunk);

        seenBytes += buffer.length;

        chunks.push(buffer);

        if (seenBytes > sizeLimit) {
            sawEnded = true;
            stream.removeListener("data", sizeChecker);
            callback(null, {
                buffer: Buffer.concat(chunks),
                isEnded: false
            });
        }
    });

    stream.on("end", function endChecker() {
        if (sawEnded) {
            return;
        }
        sawEnded = true;
        callback(null, { buffer: Buffer.concat(chunks), isEnded: true });
    });

    stream.on("error", function errorChecker(e) {
        if (sawEnded) {
            return;
        }
        sawEnded = true;
        callback(e, {});
    });
}

function createOrientationDecodingStream(inputStream, callback) {
    const bufferedStream = new BufferedStream();
    // wire errors to next as all will be propogated to the buffered stream
    inputStream.on("error", e => bufferedStream.emit("error", e));
    // send the response data directly into the buffered stream
    inputStream.pipe(bufferedStream);

    streamCollectSizeBytesAndReturn(
        bufferedStream,
        BYTES_128K,
        (err, { buffer, isEnded }) => {
            if (err) {
                return callback(err, {});
            }

            // cause us to buffer data in the steam until image metadata is parsed
            bufferedStream.pause();

            let parsedExifData;
            try {
                parsedExifData = exifParser.create(buffer).parse();
            } catch (e) {
                // no exif metadata
                if (isEnded) {
                    // the ended buffer contains a complete image so pass it on
                    return callback(null, {
                        stream: new BufferedStream(buffer)
                    });
                } else {
                    parsedExifData = {};
                }
            }

            if (!isEnded) {
                // ensure the metadata we have seen will bew re-read by the image pipeline
                bufferedStream.unshift(buffer);
            }

            const imageMetadata = parsedExifData.tags || {};
            const rotate =
                IMAGE_ORIENTATIONS_TO_ANGLE[imageMetadata.Orientation] || 0;

            callback(null, { stream: bufferedStream, rotate });
        }
    );
}

module.exports = createOrientationDecodingStream;
