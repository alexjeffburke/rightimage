const BufferedStream = require("@alexjeffburke/bufferedstream");
const exifReader = require("exif-reader");

const BYTES_128K = Math.pow(2, 17);
const IMAGE_ORIENTATIONS_TO_ANGLE = {
    1: 0,
    3: 180,
    6: 90,
    8: 270
};

function streamCollectSizeBytesAndReturn(stream, sizeLimit, callback) {
    const chunks = [];
    let seenBytes = 0;
    let sawEnded = false;

    function cleanUpAndReturn(err, data) {
        sawEnded = true;

        stream.removeListener("data", sizeChecker);
        stream.removeListener("end", endChecker);
        stream.removeListener("error", errorChecker);

        callback(err, data);
    }

    function sizeChecker(chunk) {
        if (sawEnded) {
            return;
        }

        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        seenBytes += buffer.length;
        chunks.push(buffer);

        if (seenBytes > sizeLimit) {
            cleanUpAndReturn(null, {
                buffer: Buffer.concat(chunks),
                isEnded: stream.ended
            });
        }
    }
    stream.on("data", sizeChecker);

    function endChecker() {
        if (sawEnded) {
            return;
        }

        cleanUpAndReturn(null, {
            buffer: Buffer.concat(chunks),
            isEnded: true
        });
    }
    stream.on("end", endChecker);

    function errorChecker(e) {
        if (sawEnded) {
            return;
        }

        cleanUpAndReturn(e);
    }

    stream.on("error", errorChecker);
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
        (err, collectedInfo) => {
            if (err) {
                return callback(err, {});
            }

            const { buffer, isEnded } = collectedInfo;

            // cause us to buffer data in the steam until image metadata is parsed
            bufferedStream.pause();

            let parsedExifData;
            try {
                let exifIndexInBuffer;
                if (
                    (exifIndexInBuffer = buffer.indexOf(
                        "Exif\0",
                        0,
                        "ascii"
                    )) === -1
                ) {
                    throw new Error("missing EXIF data");
                }
                parsedExifData = exifReader(buffer.slice(exifIndexInBuffer));
            } catch (e) {
                // no exif metadata
                parsedExifData = null;
            }

            // ensure the metadata we have seen will be re-read by the image pipeline
            if (!isEnded) {
                bufferedStream.unshift(buffer);
            } else if (bufferedStream._buffer) {
                // If the delivers almost all the image data as one large final chunk
                // the buffered stream will be ended and the use of the standard stream
                // unshift() method is not allows in those circumstances.
                //
                // Since we have carefully arranged to detect this case and manage the
                // buffered stream ourselves, when detecting the case (ab)use internals
                // to add the buffer before it is served out.
                bufferedStream._buffer.unshift(buffer);
            } else {
                // the ended buffer contains a complete image so pass it on
                const stream = new BufferedStream(buffer);
                return callback(null, { buffer, stream });
            }

            let rotate;
            if (parsedExifData !== null) {
                const imageMetadata = parsedExifData.image || {};
                const { Orientation = 1 } = imageMetadata;
                rotate = IMAGE_ORIENTATIONS_TO_ANGLE[Orientation];
            }

            callback(null, { buffer, stream: bufferedStream, rotate });
        }
    );
}

module.exports = createOrientationDecodingStream;
