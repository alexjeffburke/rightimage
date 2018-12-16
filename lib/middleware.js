const createRightImagePipeline = require("./createRightImagePipeline");

function createMiddleware() {
    return (req, res, next) => {
        const rightImage = res.locals.rightImage;

        if (!(typeof rightImage === "object" && rightImage)) {
            return next();
        }

        if (
            !(
                rightImage.inputStream &&
                (rightImage.imageOptions === null || rightImage.contentType)
            )
        ) {
            return next(
                new Error("rightImage: invalid inputStream or contentType")
            );
        }

        createRightImagePipeline(rightImage, (err, outputStream) => {
            if (err) {
                return next(err);
            }

            rightImage.outputStream = outputStream;

            next();
        });
    };
}

exports.createMiddleware = createMiddleware;
