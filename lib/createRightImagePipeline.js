const isAnimatedGIF = require("is-animated/lib/types/gif").isAnimated;
const JpegTran = require("jpegtran");

const OrientationDecoder = require("./OrientationDecoder");
const processOption = require("./processOption");
const {
    converter,
    supportedInputTypes,
    supportedOutputTypes
} = require("./converter");

function arrangeImageTransformsAndApply(contentType, imageOptions, maxInputPixels) {
    const [, type] = contentType.split("/");

    imageOptions = { ...imageOptions };
    let { setFormat } = imageOptions;

    const operations = [];
    if (setFormat) {
        if (setFormat === "jpg") {
            setFormat = "jpeg";
        }
        operations.push({ name: setFormat, args: [] });
        delete imageOptions.setFormat;
    }

    for (const [name, value] of Object.entries(imageOptions)) {
        let args;
        if (typeof value === "string" && processOption.canConvert(name)) {
            args = processOption(name, value);
        } else if (typeof value === "undefined") {
            args = [];
        } else if (!Array.isArray(value)) {
            args = [value];
        } else {
            args = value;
        }

        if (!converter.isValidOperation(name, args)) {
            throw new Error(
                `unsupported operation ${name}=${JSON.stringify(args)}`
            );
        }

        operations.push({ name, args });
    }

    const expressProcessImageResult = converter.createPipeline(
        { type, maxInputPixels },
        operations
    );

    return {
        input: expressProcessImageResult,
        output: expressProcessImageResult
    };
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
    {
        contentType,
        inputStream,
        maxInputPixels,
        imageOptions = null,
        postProcessImageOptions,
        ...options
    },
    callback
) {
    const [base, type] = contentType.split("/");
    if (base !== "image" || !supportedInputTypes.has(type)) {
        return callback(new Error(`unsupported input type: ${contentType}`));
    }

    const orientationDecodingStream = new OrientationDecoder(inputStream);
    orientationDecodingStream.once("error", err => callback(err));
    const imageMetadata = {};
    orientationDecodingStream.on("identify", buffer => {
        imageMetadata.animated =
            contentType === "image/gif" && isAnimatedGIF(buffer);
    });
    orientationDecodingStream.on("rotation", rotate => {
        imageOptions = { ...imageOptions };
        // include the rotation in the applied options
        if (typeof imageOptions.rotate === "number") {
            imageOptions.rotate = (imageOptions.rotate + rotate) % 360;
        } else {
            imageOptions.rotate = rotate;
        }
    });
    orientationDecodingStream.on("stream", stream => {
        if (typeof postProcessImageOptions === "function") {
            imageOptions = postProcessImageOptions(
                contentType,
                imageOptions,
                imageMetadata
            );
        }

        const outputContentType = makeOutputContentType(
            contentType,
            imageOptions,
            maxInputPixels
        );
        const [, type] = outputContentType.split("/");
        if (!supportedOutputTypes.has(type)) {
            return callback(
                new Error(`unsupported output type: ${outputContentType}`)
            );
        }

        // determine whether only rotation was requested
        const isOnlyRotation =
            contentType === outputContentType &&
            Object.keys(imageOptions || {}).length === 1 &&
            typeof imageOptions.rotate === "number";

        if (
            imageOptions === null ||
            (isOnlyRotation && imageOptions.rotate === 0)
        ) {
            // no transformation was requested or needed
            return callback(null, {
                outputContentType: contentType,
                outputStream: stream,
                outputTransformed: false
            });
        }

        // If we are dealing with a JPEG where no format
        // conversion is occurring and we only have some
        // rotation to apply then opt to use jpegtran.
        if (contentType === "image/jpeg" && isOnlyRotation) {
            const JpegTranConstructor = options._JpegTran || JpegTran;
            const output = new JpegTranConstructor([
                "-rotate",
                imageOptions.rotate
            ]);

            stream.pipe(output);
            stream.on("error", error => output.emit("error", error));

            return callback(null, {
                outputContentType,
                outputStream: output,
                outputTransformed: true
            });
        }

        let arranged;
        try {
            arranged = arrangeImageTransformsAndApply(
                contentType,
                imageOptions
            );
        } catch (err) {
            return callback(err);
        }
        const { input, output } = arranged;

        // send the complete image data into the image pipeline (.resume() called automatically)
        stream.pipe(input);
        // propogate errors
        stream.on("error", error => output.emit("error", error));

        callback(null, {
            outputContentType,
            outputStream: output,
            outputTransformed: true
        });
    });
}

module.exports = createRightImagePipeline;
