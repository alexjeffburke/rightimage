const getFilterInfosAndTargetContentTypeFromQueryString = require("express-processimage/lib/getFilterInfosAndTargetContentTypeFromQueryString");
const isAnimatedGIF = require("is-animated/lib/types/gif").isAnimated;
const PassThrough = require("stream").PassThrough;
const queryString = require("querystring");

const OrientationDecoder = require("./OrientationDecoder");

function arrangeImageTransformsAndApply(contentType, imageOptions) {
    const queryAsString = queryString.stringify(imageOptions, null, null, {
        encodeURIComponent: str => String(str)
    });
    const expressProcessImageResult = getFilterInfosAndTargetContentTypeFromQueryString(
        queryAsString,
        {
            defaultEngineName: "sharp",
            sourceMetadata: { contentType }
        }
    );

    const filterInfos = expressProcessImageResult.filterInfos;
    if (filterInfos.length === 0) {
        throw new Error("No image transforms were generated for application");
    }

    let imageFilterStream = null;
    let lastImageFilterStream;

    filterInfos.forEach(filterInfo => {
        let transformStream = filterInfo.create();
        if (
            filterInfo.operationName === "gifsicle" &&
            Array.isArray(transformStream) &&
            transformStream.length === 0
        ) {
            transformStream = new PassThrough();
        }

        if (imageFilterStream === null) {
            imageFilterStream = transformStream;
            lastImageFilterStream = transformStream;
        } else {
            lastImageFilterStream.pipe(transformStream);
            lastImageFilterStream = transformStream;
        }
    });

    return { input: imageFilterStream, output: lastImageFilterStream };
}

function makeOutputContentType(contentType, imageOptions) {
    if (imageOptions && imageOptions.setFormat) {
        let outFormat = imageOptions.setFormat;
        if (outFormat === "jpg") {
            outFormat = "jpeg";
        }
        return `image/${outFormat}`;
    } else {
        return contentType;
    }
}

function createRightImagePipeline(
    { contentType, inputStream, imageOptions, postProcessImageOptions },
    callback
) {
    const orientationDecodingStream = new OrientationDecoder(inputStream);
    orientationDecodingStream.once("error", err => callback(err));
    const imageMetadata = {};
    orientationDecodingStream.on("identify", buffer => {
        imageMetadata.animated =
            contentType === "image/gif" && isAnimatedGIF(buffer);
    });
    orientationDecodingStream.on("rotation", rotate => {
        // include the rotation in the applied options
        imageOptions = { rotate, ...imageOptions };
    });
    orientationDecodingStream.on("stream", stream => {
        if (typeof postProcessImageOptions === "function") {
            imageOptions = postProcessImageOptions(
                contentType,
                imageOptions,
                imageMetadata
            );
        }

        if (imageOptions === null) {
            // no transformation was requested
            return callback(null, {
                outputContentType: contentType,
                outputStream: stream,
                outputTransformed: false
            });
        }

        const { input, output } = arrangeImageTransformsAndApply(
            contentType,
            imageOptions
        );

        // send the complete image data into the image pipeline (.resume() called automatically)
        stream.pipe(input);
        // propogate errors
        stream.on("error", error => output.emit("error", error));

        callback(null, {
            outputContentType: makeOutputContentType(contentType, imageOptions),
            outputStream: output,
            outputTransformed: true
        });
    });
}

module.exports = createRightImagePipeline;
