const optionConverters = {
    resize: value => {
        const match = value.match(/\d+(x|,)\d+/);
        if (match === null) {
            // eslint-disable-next-line
            throw undefined;
        }

        const [width, height] = value.split(match[1]);

        return [parseInt(width, 10), parseInt(height, 10)];
    }
};

module.exports = function(name, value) {
    const converter = optionConverters[name];

    try {
        return converter(value);
    } catch (e) {
        throw new Error(
            `invalid argument for operation resize=${JSON.stringify(value)}`
        );
    }
};

module.exports.canConvert = function canConvert(name) {
    return !!optionConverters[name];
};
