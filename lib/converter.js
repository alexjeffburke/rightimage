const { Impro, engines } = require("impro");

const converter = new Impro().use(engines.gifsicle).use(engines.sharp);

function supportedByEngineToTypesSet(suportedByEngine) {
    const supportedTypes = new Set();
    Object.keys(suportedByEngine).forEach(engineName => {
        Object.keys(suportedByEngine[engineName]).forEach(type =>
            supportedTypes.add(type)
        );
    });
    supportedTypes.delete("*");
    return supportedTypes;
}

exports.converter = converter;
exports.supportedInputTypes = supportedByEngineToTypesSet(
    converter.isSupportedByEngineNameAndInputType
);
