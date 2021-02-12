# rightimage

[![NPM version](https://img.shields.io/npm/v/rightimage.svg)](https://www.npmjs.com/package/rightimage)
[![Build Status](https://img.shields.io/travis/alexjeffburke/rightimage/master.svg)](https://travis-ci.org/alexjeffburke/rightimage)
[![Coverage Status](https://img.shields.io/coveralls/alexjeffburke/rightimage/master.svg)](https://coveralls.io/r/alexjeffburke/rightimage?branch=master)

This module is a small library for streaming dynamic images. Its
key feature is to automatically detect and correct oritentation.

## Use

The library exposes a function that can be passed image processing options
and will return a stream. We carefully arrange for error propogation and
teardown of resources to ensure operation in servers is safe.

```js
const fs = require("fs");

const rightImage = require("rightimage");

rightImage.createRightImagePipeline(
  {
    contentType: "image/jpeg",
    imageOptions: {
      setFormat: "png",
      resize: "100,100"
    },
    inputStream: fs.createReadStream("./testdata/test.jpg")
  },
  (err, pipelineResult) => {
    if (err) {
      // call error handling code
      return callback(err);
    }

    const { outputContentType, outputStream } = pipelineResult;

    const outputFile = "./testdata/output/test_small.png";
    const outputFileStream = fs.createWriteStream(outputFile);
    outputFileStream.on("close", () => {
      // call some callback to signify success
      callback(null, `wrote an ${outputContentType} to path ${outputFile}`);
    });

    outputStream.pipe(outputFileStream);
  }
);
```

<!-- evaldown output:true -->

```
'wrote an image/png to path ./testdata/output/test_small.png'
```

The example above would take the test JPEG file in the project repository
and convert it to a 100x100 PNG write the output "wrote image/png". Since
the source JPEG has an orientation, it will be oriented correctly without
any additional steps required.

## Implementation

The primary trick is to read the first 128K bytes of the image on-the-fly
and parse the EXIF data for the image oritentation. We use any present
orientation data to calculate the correction required and trigger rotation
via image processing libraries. The image data is never buffered.

## Production safety

This module is intended to be used in production situations for the dynamic
conversion of untrusted image data; it is imperative that the library is safe.
A great deal of emphasis has been placed on error codepath hardening and the
validation of any operations that will be performed.

Every requested format conversion and transformation operation is checked
against a set of whitelisted operations and the module will not proceed if
these checks fail. _This module will always prefer a safer feature subset._

## Image processing

Internally two modules are used to do the core image manipulation work.

### [impro](https://github.com/papandreou/impro)

This awesome library wraps multiple image libraries - those configured by
rightimage are [sharp](https://github.com/lovell/sharp) and
[Gifsicle](https://github.com/kohler/gifsicle) (for the correct conversion
of _all_ GIFs including those with animated frames).

We bypass the outer layer and instead use the lower-level "operations API"
where we construct an array of operations and pass that directly into the
core fo the library. Based on input options and input content-type,
will construct a streaming pipeline that will perform the conversion.

### [jpegtran](https://github.com/papandreou/node-jpegtran)

In the case of JPEGs that require nothing more than an orientation change
we switch over to the `jpegtran` library to ensure we make a best effort to
best preserve the image quality.

