'use strict';

// Matches one or more consecutive percent-encoded bytes (e.g. `%C3%A5`).
var token = '%[a-f0-9]{2}';
var multiMatcher = new RegExp('(' + token + ')+', 'gi');
var hexPair = /^[a-f\d]{2}$/i;

// Read a `%XX` sequence at `position`, returning the byte value and where to continue scanning.
function parsePercentByte(input, position) {
	if (input.charCodeAt(position) !== 37 || position + 3 > input.length) {
		return;
	}

	var digits = input.slice(position + 1, position + 3);

	if (!hexPair.test(digits)) {
		return;
	}

	return {byte: parseInt(digits, 16), next: position + 3};
}

/**
 * Return how many bytes a UTF-8 code point needs based on its lead byte.
 * Returns 0 for continuation bytes and other invalid lead bytes.
 */
function utf8SequenceLength(byte) {
	if (byte <= 0x7F) {
		return 1;
	}

	// Start at 0xC2 to exclude overlong 2-byte encodings (0xC0/0xC1).
	if (byte >= 0xC2 && byte <= 0xDF) {
		return 2;
	}

	if (byte >= 0xE0 && byte <= 0xEF) {
		return 3;
	}

	if (byte >= 0xF0 && byte <= 0xF4) {
		return 4;
	}

	return 0;
}

function isContinuationByte(byte) {
	return byte >= 0x80 && byte <= 0xBF;
}

/**
 * Decode as much of `input` as possible without throwing.
 * Scans left-to-right in O(n), decoding valid UTF-8 runs and leaving the rest literal.
 */
function decode(input) {
	try {
		return decodeURIComponent(input);
	} catch (err) {
		var output = '';
		var position = 0;

		while (position < input.length) {
			if (input.charCodeAt(position) !== 37) {
				output += input.charAt(position);
				position++;
				continue;
			}

			var firstByte = parsePercentByte(input, position);

			// `%` not followed by two hex digits (e.g. `%` or `%G`).
			if (!firstByte) {
				output += input.charAt(position);
				position++;
				continue;
			}

			var sequenceLength = utf8SequenceLength(firstByte.byte);

			// Continuation byte or invalid lead byte — emit one `%XX` literally.
			if (sequenceLength === 0) {
				output += input.slice(position, position + 3);
				position += 3;
				continue;
			}

			var end = firstByte.next;
			var validSequence = true;

			for (var index = 1; index < sequenceLength; index++) {
				var nextByte = parsePercentByte(input, end);

				if (!nextByte || !isContinuationByte(nextByte.byte)) {
					validSequence = false;
					break;
				}

				end = nextByte.next;
			}

			if (validSequence) {
				var encodedSequence = input.slice(position, end);

				try {
					output += decodeURIComponent(encodedSequence);
					position = end;
					continue;
				} catch (decodeErr) {
					// Invalid UTF-8 despite correct structure — emit the first byte literally.
				}
			}

			// Missing continuation bytes or decode failure — emit the first byte literally.
			output += input.slice(position, position + 3);
			position += 3;
		}

		return output;
	}
}

function customDecodeURIComponent(input) {
	// Keep track of all the replacements and prefill the map with the `BOM`
	var replaceMap = {
		'%FE%FF': '\uFFFD\uFFFD',
		'%FF%FE': '\uFFFD\uFFFD'
	};

	// Find percent-encoded runs separated by literal text or lone `%` characters.
	var match = multiMatcher.exec(input);

	while (match) {
		try {
			// Decode as big chunks as possible
			replaceMap[match[0]] = decodeURIComponent(match[0]);
		} catch (err) {
			var result = decode(match[0]);

			if (result !== match[0]) {
				replaceMap[match[0]] = result;
			}
		}

		match = multiMatcher.exec(input);
	}

	// Add `%C2` at the end of the map to make sure it does not replace the combinator before everything else
	replaceMap['%C2'] = '\uFFFD';

	var entries = Object.keys(replaceMap);

	for (var i = 0; i < entries.length; i++) {
		var key = entries[i];
		input = input.replace(new RegExp(key, 'g'), replaceMap[key]);
	}

	return input;
}

module.exports = function (encodedURI) {
	if (typeof encodedURI !== 'string') {
		throw new TypeError('Expected `encodedURI` to be of type `string`, got `' + typeof encodedURI + '`');
	}

	try {
		encodedURI = encodedURI.replace(/\+/g, ' ');

		// Try the built in decoder first
		return decodeURIComponent(encodedURI);
	} catch (err) {
		// Fallback to a more advanced decoder
		return customDecodeURIComponent(encodedURI);
	}
};
