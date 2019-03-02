# rightimage

[![NPM version](https://img.shields.io/npm/v/rightimage.svg)](https://www.npmjs.com/package/rightimage)
[![Build Status](https://img.shields.io/travis/alexjeffburke/rightimage/master.svg)](https://travis-ci.org/alexjeffburke/rightimage)
[![Coverage Status](https://img.shields.io/coveralls/alexjeffburke/rightimage/master.svg)](https://coveralls.io/r/alexjeffburke/rightimage?branch=master)

This module is a small library for streaming dynamic images. Its
primary trick is to automatically detect and correct oritentation.

# Use

The library exposes a function that can be passed image processing options
and will return a stream. We carefully arrange for error propogation and
teardown of resources to ensure operation in servers is safe.

```js
const fs = require("fs");
const inputStream = fs.createReadStream("./testdata/test.jpg");

const rightimage = require("rightimage");

rightImage.createRightImagePipeline(
  {
    contentType: "image/jpeg",
    imageOptions: {
      setFormat: 'png',
      resize: "100,100"
    },
    inputStream
  },
  passError(next, pipelineResult => {
    const { outputContentType, outputStream } = pipelineResult;

    const outputFile = fs.writeFileStream("./testdata/output_small.png");
    outputFile.on('close', () => {
      console.log(`wrote ${outputContentType}`);
    })

    outputStream.pipe(outputFile);
  });
);
```

The example above would take the test JPEG file in the project repository
and convert it to a 100x100 PNG write the output "wrote image/png". Since
the source JPEG has an orientation, it will be oriented correctly without
any further options required.

# Implementation

The primary trick is to read the first 128K bytes of the imahe on-the-fly
and parse the EXIF data for the image oritentation. We use any present
orientation data to calculate the correction required and trigger rotation
via image processing libraries. The image data is never buffered.

# Image processing

Internally two modules are used to do the core image manipulation work.

## [express-processimage](https://github.com/papandreou/express-processimage)

This awesome library wraps multiple image libraries - the two invoked by
rightimage are [sharp](https://github.com/lovell/sharp) and
[Gifsicle](https://github.com/kohler/gifsicle) (for the correct conversion
of _all_ GIFs including those with animated frames).

We bypass the outer layer that exposes a middleware and instead directly use
the internal `engine` which, based on input options and input content-type,
will construct a streaming pipeline that will perform the conversion.

## [jpegtran](https://github.com/papandreou/node-jpegtran)

In the case of JPEGs that require nothing more than an orientation change
we switch over to the `jpegtran` library to ensure we make a best effort to
best preserve the image quality.
