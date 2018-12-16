const express = require("express");
const fs = require("fs");
const path = require("path");
const httpErrors = require("httpErrors");
const purify = require("purify");

const rightImage = require("../lib");

const testDataPath = path.resolve(__dirname, "..", "testdata");

function validateImageOptions(query) {
    const outFormat = purify.visibleAscii(query.format);
    const width = purify.positiveInteger(query.width);
    const height = purify.positiveInteger(query.height);
    const queryCrop = purify.boolean(query.crop);
    const gravity = purify.visibleAscii(query.gravity);

    if (!(outFormat || (width && height) || queryCrop || gravity)) {
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

app.post(
    "/stream/:imageFile",
    (req, res, next) => {
        let contentType;
        let imageOptions;
        let inputStream;
        try {
            let inFormat = path.extname(req.params.imageFile);
            if (inFormat === "jpg") {
                inFormat = "jpeg";
            }
            contentType = `image/${inFormat}`;
            imageOptions = validateImageOptions(req.query);
            inputStream = req;
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
