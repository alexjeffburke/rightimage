const express = require("express");
const fs = require("fs");
const path = require("path");
const httpErrors = require("httperrors");
const purify = require("purify");

const rightImage = require("../lib");

const testDataPath = path.resolve(__dirname, "..", "testdata");

function validateImageOptions(query) {
    const outFormat = purify.visibleAscii(query.format);
    const width = purify.positiveInteger(query.width);
    const height = purify.positiveInteger(query.height);
    const queryCrop = purify.boolean(query.crop);
    const gravity = purify.visibleAscii(query.gravity);
    const rotate = purify.positiveIntegerOrZero(query.rotate);

    if (!(outFormat || (width && height) || queryCrop || gravity || rotate)) {
        return null;
    }

    if (outFormat && !/^(png|gif|jpg|jpeg)$/.test(outFormat)) {
        throw new httpErrors.BadRequest();
    }

    const imageOptions = {};
    if (outFormat) {
        imageOptions.setFormat = outFormat;
    }
    if (width && height) {
        imageOptions.resize = `${width},${height}`;
    }
    if (queryCrop && gravity) {
        imageOptions.crop = gravity.toLowerCase();
    }
    if (query.background && query.embed !== undefined) {
        imageOptions.background = "#000000";
        imageOptions.embed = "";
    }
    if (typeof rotate === "number") {
        imageOptions.rotate = rotate;
    }

    return imageOptions;
}

const app = express();

app.get(
    "/:imageFile",
    (req, res, next) => {
        const inputStream = fs.createReadStream(
            path.join(testDataPath, req.params.imageFile)
        );

        let contentType;
        let imageOptions;
        try {
            let inFormat = path.extname(req.params.imageFile);
            if (inFormat) {
                inFormat = inFormat.slice(1);
            }
            if (inFormat === "jpg") {
                inFormat = "jpeg";
            }
            contentType = `image/${inFormat}`;
            imageOptions = validateImageOptions(req.query);
        } catch (e) {
            return next(e);
        }

        res.locals.rightImage = {
            contentType,
            inputStream,
            imageOptions
        };

        next();
    },
    rightImage.createMiddleware(),
    (req, res, next) => {
        const { outputContentType, outputStream } = res.locals.rightImage;
        res.setHeader("Content-Type", outputContentType);
        outputStream.pipe(res);
    }
);

app.post(
    "/stream/:imageFile",
    (req, res, next) => {
        const inputStream = req;

        let contentType;
        let imageOptions;
        try {
            let inFormat = path.extname(req.params.imageFile);
            if (inFormat) {
                inFormat = inFormat.slice(1);
            }
            if (inFormat === "jpg") {
                inFormat = "jpeg";
            }
            contentType = `image/${inFormat}`;
            imageOptions = validateImageOptions(req.query);
        } catch (e) {
            return next(e);
        }

        res.locals.rightImage = {
            contentType,
            inputStream,
            imageOptions
        };

        next();
    },
    rightImage.createMiddleware(),
    (req, res, next) => {
        res.locals.rightImage.outputStream.pipe(res);
    }
);

if (require.main === module) {
    app.listen(5000);
} else {
    module.exports = app;
}
