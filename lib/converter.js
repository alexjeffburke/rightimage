const { Impro, engines } = require("impro");

const converter = new Impro().use(engines.gifsicle).use(engines.sharp);

const supportedTypes = Object.keys(
    converter.isSupportedByEngineNameAndInputType
).reduce((set, engineName) => {
    Object.keys(
        converter.isSupportedByEngineNameAndInputType[engineName]
    ).forEach(type => set.add(type));

    return set;
}, new Set());
supportedTypes.delete("*");

exports.converter = converter;
exports.supportedTypes = supportedTypes;
