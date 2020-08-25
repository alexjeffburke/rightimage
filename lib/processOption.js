const optionConverters = {
    resize: value => {
        const match = value.match(/\d+(x|,)\d+/)
        if (match === null) {
            throw new Error(`invalid argument for resize ${value}`);
        }

        const [width, height] = value.split(match[1]);

        return [parseInt(width, 10), parseInt(height, 10)];
    }
};

module.exports = function(name, value) {
    const converter = optionConverters[name];

    if (!converter) {
        throw new Error(`unsupported argument for ${name}`);
    }

    return converter(value);
};
