var ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
var SEPARATOR = '1';
var alphabetMap = new Map();
for (var i = 0; i < ALPHABET.length; i++) {
    var char = ALPHABET.charAt(i);
    if (alphabetMap.get(char) !== undefined) {
        throw new TypeError(char + " is ambiguous");
    }
    alphabetMap.set(char, i);
}
var polymodStep = function (values) {
    var b = values >> 25;
    return (((values & 0x1ffffff) << 5) ^
        (-((b >> 0) & 1) & 0x3b6a57b2) ^
        (-((b >> 1) & 1) & 0x26508e6d) ^
        (-((b >> 2) & 1) & 0x1ea119fa) ^
        (-((b >> 3) & 1) & 0x3d4233dd) ^
        (-((b >> 4) & 1) & 0x2a1462b3));
};
var prefixChecksum = function (prefix) {
    var checksum = 1;
    for (var i = 0; i < prefix.length; ++i) {
        var c = prefix.charCodeAt(i);
        if (c < 33 || c > 126)
            throw new Error("Invalid prefix (" + prefix + ")");
        checksum = polymodStep(checksum) ^ (c >> 5);
    }
    checksum = polymodStep(checksum);
    for (var i = 0; i < prefix.length; ++i) {
        var v = prefix.charCodeAt(i);
        checksum = polymodStep(checksum) ^ (v & 0x1f);
    }
    return checksum;
};
var encode = function (prefix, words) {
    var formattedPrefix = prefix.toLowerCase();
    // determine checksum mod
    var checksum = prefixChecksum(formattedPrefix);
    var result = "" + formattedPrefix + SEPARATOR;
    for (var i = 0; i < words.length; ++i) {
        var x = words[i];
        if (x >> 5 !== 0)
            throw new Error('Non 5-bit word');
        checksum = polymodStep(checksum) ^ x;
        result += ALPHABET.charAt(x);
    }
    for (var i = 0; i < 6; ++i) {
        checksum = polymodStep(checksum);
    }
    checksum ^= 1;
    for (var i = 0; i < 6; ++i) {
        var v = (checksum >> ((5 - i) * 5)) & 0x1f;
        result += ALPHABET.charAt(v);
    }
    return result;
};
var decode = function (encoded) {
    var lowered = encoded.toLowerCase();
    var uppered = encoded.toUpperCase();
    if (encoded !== lowered && encoded !== uppered)
        throw new Error("Mixed-case string " + encoded);
    var str = lowered;
    if (str.length < 8)
        throw new TypeError(str + " too short");
    var split = str.lastIndexOf(SEPARATOR);
    if (split === -1)
        throw new Error("No separator character for " + str);
    if (split === 0)
        throw new Error("Missing prefix for " + str);
    var prefix = str.slice(0, split);
    var wordChars = str.slice(split + 1);
    if (wordChars.length < 6)
        throw new Error('Data too short');
    var checksum = prefixChecksum(prefix);
    var words = [];
    wordChars.split('').forEach(function (_, i) {
        var c = wordChars.charAt(i);
        var v = alphabetMap.get(c);
        if (v === undefined)
            throw new Error("Unknown character " + c);
        checksum = polymodStep(checksum) ^ v;
        if (i + 6 < wordChars.length) {
            words.push(v);
        }
    });
    if (checksum !== 1)
        throw new Error("Invalid checksum for " + str);
    return {
        prefix: prefix,
        words: words
    };
};
var convert = function (data, inBits, outBits, pad) {
    var value = 0;
    var bits = 0;
    var maxV = (1 << outBits) - 1;
    var result = [];
    for (var i = 0; i < data.length; ++i) {
        value = (value << inBits) | data[i];
        bits += inBits;
        while (bits >= outBits) {
            bits -= outBits;
            result.push((value >> bits) & maxV);
        }
    }
    if (pad) {
        if (bits > 0) {
            result.push((value << (outBits - bits)) & maxV);
        }
    }
    else {
        if (bits >= inBits)
            throw new Error('Excess padding');
        if ((value << (outBits - bits)) & maxV)
            throw new Error('Non-zero padding');
    }
    return new Uint8Array(result);
};
var toWords = function (bytes) { return convert(bytes, 8, 5, true); };
var fromWords = function (words) { return convert(words, 5, 8, false); };
var bytesToHex = function (bytes) {
    var hex = [];
    /* eslint-disabled */
    for (var i = 0; i < bytes.length; i++) {
        hex.push((bytes[i] >>> 4).toString(16));
        hex.push((bytes[i] & 0xf).toString(16));
    }
    /* eslint-enabled */
    return "0x" + hex.join('');
};
var hexToBytes = function (rawhex) {
    if (rawhex === '')
        return new Uint8Array();
    if (typeof rawhex === 'string' && !rawhex.startsWith('0x')) {
        throw new Error('Should start with 0x: ' + rawhex);
    }
    var hex = rawhex.toString(16);
    hex = hex.replace(/^0x/i, '');
    hex = hex.length % 2 ? "0" + hex : hex;
    var bytes = [];
    for (var c = 0; c < hex.length; c += 2) {
        bytes.push(parseInt(hex.substr(c, 2), 16));
    }
    return new Uint8Array(bytes);
};
