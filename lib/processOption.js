const optionConverters = {
    resize: value => {
        if (!/\d+x\d+/.test(value)) {
            throw new Error(`invalid argument for resize ${value}`);
        }

        const [width, height] = value.split("x");

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
