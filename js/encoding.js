const CRC32 = function (r) { for (var a, o = [], c = 0; c < 256; c++) { a = c; for (var f = 0; f < 8; f++)a = 1 & a ? 3988292384 ^ a >>> 1 : a >>> 1; o[c] = a } for (var n = -1, t = 0; t < r.length; t++)n = n >>> 8 ^ o[255 & (n ^ r.charCodeAt(t))]; return (-1 ^ n) >>> 0 };

(function(ctx){
	if (ctx.Utf8)
		return;
	
	const isLittleEndian = new Uint8Array((new Uint16Array([1])).buffer)[0] == 1;
	const swap_endian = function(i){
		return new i.constructor(new Uint8Array(i.buffer).reverse().buffer).reverse();
	};
	
	const encode8 = function(typedArray){
		if (!typedArray.byteLength)
		  throw TypeError("must supply typed array");
		
		if (typedArray.length)
		{	
			if (typedArray.length < typedArray.byteLength)				
				typedArray = new Uint8Array(isLittleEndian ? swap_endian(typedArray).buffer : typedArray.buffer);
		}
		else
			typedArray = new Uint8Array(typedArray);
		
		if (isLittleEndian && typedArray.length && typedArray.byteLength / typedArray.length > 1)
			typedArray = swap_endian(typedArray);
		
		return new TextDecoder().decode(typedArray);
	};
	const decode_buffer8 = function(str){
		const r = new Uint8Array(str.length);
		return new TextEncoder().encode(str).buffer;
	};
	const decode8 = function(str, typedArray){
		if (!typedArray || !typedArray.BYTES_PER_ELEMENT)
			typedArray = Uint8Array;
		
		var res = new typedArray(decode_buffer8(str));
		if (isLittleEndian && typedArray.BYTES_PER_ELEMENT > 1)
			res = swap_endian(res);
		return res;
	};
			
	const encode16 = function(typedArray){
		if (!typedArray.byteLength)
			throw TypeError("must supply typed array");
					
		// Case 1: 1 byte array (cast integer number of 2, if bigEndian swap order, with padding)
		// Case 2: 2 byte array (do nothing)
		// Case 3: 4,8 byte array if bigEndian swap order then cast then swap again (need double swap)
		var str = '';		
		if (!typedArray.length || typedArray.byteLength == typedArray.length)
		{
			// ArrayBuffer or 1-byte array            
			if (typedArray.byteLength & 1) {
				throw TypeError("must be some plural of 2 in bytes length");
			}
			
			typedArray = new Uint16Array(typedArray.buffer ? typedArray.buffer : typedArray);
			if (isLittleEndian)
				typedArray = swap_endian(typedArray); // is currently in little endian, to insert into str it needs big endian
		}
		else if (typedArray.byteLength != typedArray.length * 2)
		{
			// 4,8-byte array
			if (isLittleEndian)
				typedArray = swap_endian(new Uint16Array(swap_endian(typedArray).buffer)); // swap once to get to little endian, then again for proper order for uint16
			else
				typedArray = new Uint16Array(typedArray.buffer);
		}

		for (var i=0; i < typedArray.length; ++i)
			str += String.fromCharCode(typedArray[i]);
		
		return str;
	};
	const decode_buffer16 = function(str){		
		var r = new Uint16Array(str.length);
		for (var i = 0; i < r.length; ++i)
			r[i] = str.charCodeAt(i);
		
		if (isLittleEndian)
			r = swap_endian(r);

		r = new Uint8Array(r.buffer);
		return r.buffer;
	};
	const decode16 = function(str, typedArray){
		if (!typedArray || !typedArray.BYTES_PER_ELEMENT)
			typedArray = Uint16Array;
		
		if (typedArray.BYTES_PER_ELEMENT == 1)
			return new typedArray(decode_buffer16(str));
		
		if (typedArray.BYTES_PER_ELEMENT == 2)
		{
			const r = new Uint16Array(str.length);
			for (var i = 0; i < r.length; ++i)
				r[i] = str.charCodeAt(i);
			return new typedArray(r.buffer);
		}

		var res = new typedArray(decode_buffer16(str));
		if (isLittleEndian)
			res = swap_endian(res);
		return res;
	};


	const encode32 = function(typedArray){
		if (!typedArray.byteLength)
			throw TypeError("must supply typed array");

		
		if (!typedArray.length || typedArray.byteLength != (4 * typedArray.length)){
			// 1, 2-byte array
			 if (typedArray.byteLength & 3){
				throw TypeError("must be some plural of 4 in bytes length");
			 }

			 typedArray = new Uint32Array(typedArray.buffer ? (isLittleEndian && typedArray.BYTES_PER_ELEMENT > 1 ? swap_endian(typedArray) : typedArray).buffer : typedArray);
			 if (isLittleEndian){
				typedArray = swap_endian(typedArray);
			}
		}
				
		// typedArray is now Uint32Array convert to UTF-8
		// need at most 4 bytes per character, otherwise Unicode space is broken
		
		const u8 = new Uint8Array(typedArray.buffer);
		let k = 0;
		for(let i = 0; i < typedArray.length; ++i){
			let v = typedArray[i];
			if (v > 0x10FFFF){
				throw Error("invalid UTF-32 character, doesn't fall in Unicode code-space");
			}
			if (v > 0xFFFF){
				// 4-bytes required
				u8[k] = 0xF0 | (v >> 18);
				v &= 0x3FFFF;
				++k;
				u8[k] = 0x80 | (v >> 12);
				v &= 0x0FFF;
				++k;
				u8[k] = 0x80 | (v >> 6);
				v &= 0x3F;
				++k;
				u8[k] = 0x80 | (v >> 0);
				++k;
			}
			else if (v > 0x07FF){
				// 3-bytes required
				u8[k] = 0xE0 | (v >> 12);
				v &= 0x3F;
				++k;
				u8[k] = 0x80 | (v >> 6);
				v &= 0x3F;
				++k;
				u8[k] = 0x80 | (v >> 0);
				++k;
			}
			else if (v > 0x7F){
				// 2-bytes required
				u8[k] = 0xC0 | (v >> 6);
				v &= 0x3F;
				++k;
				u8[k] = 0x80 | (v >> 0);
				++k;
			}
			else{
				// 1-byte required
				u8[k] = v;
				++k;
			}

		}
		
		return encode8(u8.subarray(0,k));
	};
	const decode_buffer32 = function(str){
		const u8 = decode8(str);
		// convert UTF-8 to UTF-32
		const va = [];
		for (let i = 0; i < u8.length; ++i){
			let v = 0;
			if ((u8[i] & 0xF8) == 0xF0){
				// 4-bytes
				v |= u8[i] & 0x07;				
				++i;
				v <<= 6;
				v |= u8[i] & 0x3F;
				++i;
				v <<= 6;
				v |= u8[i] & 0x3F;
				++i;
				v <<= 6;
				v |= u8[i] & 0x3F;
			}
			else if ((u8[i] & 0xF0) == 0xE0){
				// 3-bytes
				v |= u8[i] & 0x0F;				
				++i;
				v <<= 6;
				v |= u8[i] & 0x3F;
				++i;
				v <<= 6;
				v |= u8[i] & 0x3F;
			}
			else if ((u8[i] & 0xE0) == 0xC0){
				// 2-bytes
				v |= u8[i] & 0x1F;
				++i;
				v <<= 6;
				v |= u8[i] & 0x3F;				
			}
			else{
				// 1-byte
				v |= u8[i] & 0x7F;
			}
			va.push(v);
		}

		let u32 = Uint32Array.from(va);
		if (isLittleEndian){
			u32 = swap_endian(u32);
		}
		return u32.buffer;
	};
	const decode32 = function(str, typedArray){
		if (!typedArray || !typedArray.BYTES_PER_ELEMENT){
			typedArray = Uint32Array;
		}

		const r = new typedArray(decode_buffer32(str));
		if (typedArray.BYTES_PER_ELEMENT > 1 && isLittleEndian){
			return swap_endian(r);
		}
		return r;
	};


	const utf8 = Object.create({}); // default to singleByte (Extended ASCII)
	Object.defineProperty(utf8, "encode", {value: encode8, writable: false});
	Object.defineProperty(utf8, "decodeToBuffer", {value: decode_buffer8, writable: false});
	Object.defineProperty(utf8, "decode", {value: decode8, writable: false});
	
	Object.defineProperty(ctx, "Utf8", {value: utf8, writable: false});
	
	const utf16 = Object.create({}); // only does 16-bit sections, not 32
	Object.defineProperty(utf16, "encode", {value: encode16, writable: false});
	Object.defineProperty(utf16, "decodeToBuffer", {value: decode_buffer16, writable: false});
	Object.defineProperty(utf16, "decode", {value: decode16, writable: false});
	
	Object.defineProperty(ctx, "Utf16", {value: utf16, writable: false});
	

	const utf32 = Object.create({});
	Object.defineProperty(utf32, "encode", {value: encode32, writable: false});
	Object.defineProperty(utf32, "decodeToBuffer", {value: decode_buffer32, writable: false});
	Object.defineProperty(utf32, "decode", {value: decode32, writable: false});

	Object.defineProperty(ctx, "Utf32", {value: utf32, writable: false});

	Object.defineProperty(ctx, "isLittleEndian", {value: isLittleEndian, writable: false});
	Object.defineProperty(ctx, "swapByteOrder", {value: swap_endian, writable: false});	
})(this);

const Base64 = (function(){
	const base64Char = new Uint8Array([0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4A, 0x4B, 0x4C, 0x4D, 0x4E, 0x4F, 0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5A, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x6B, 0x6C, 0x6D, 0x6E, 0x6F, 0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7A, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x2B, 0x2F]);
	const base64CharUrl = new Uint8Array([0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4A, 0x4B, 0x4C, 0x4D, 0x4E, 0x4F, 0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5A, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x6B, 0x6C, 0x6D, 0x6E, 0x6F, 0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7A, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x2D, 0x5F]);


	const base64Reverse = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 62, 0, 62, 0, 63, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 0, 0, 0, 0, 63, 0, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51 ]);

	function Base64Length(byteLength)
	{
		return (Math.trunc(byteLength / 3) + (byteLength % 3 != 0)) * 4;
	}
	function Base64UrlLength(byteLength)
	{
		return Math.trunc(byteLength * 4 / 3) + (byteLength % 3 != 0 ? 1 : 0);
	}
	function Base64DecodeLength(encodedLength, encoded)
	{
		return Math.trunc((encodedLength * 6)/8) - (encoded[encodedLength - 1] == '=') - (encoded[encodedLength - 2] == '=');
	}

	return {
		length: Base64Length,
		urlLength: Base64UrlLength,		
		encode: function(input)
		{
			if (!("BYTES_PER_ELEMENT" in input))
			return false;
			const true_input = input;

			if (input.BYTES_PER_ELEMENT > 1)
				input = new Uint8Array((isLittleEndian ? swapByteOrder(input) : input).buffer);
			
			var inputSize = input.length;
			const output = new Uint8Array(Base64Length(inputSize));

			var i=0, j=0;
			// Always works in blocks of 3 bytes
			for (; inputSize > 2; inputSize -= 3)
			{
				output[j + 0] = base64Char[(input[i + 0] & 0xFC) >> 2];
				output[j + 1] = base64Char[(input[i + 0] & 0x03) << 4 | (input[i + 1] & 0xF0) >> 4];
				output[j + 2] = base64Char[(input[i + 1] & 0x0F) << 2 | (input[i + 2] & 0xC0) >> 6];
				output[j + 3] = base64Char[(input[i + 2] & 0x3F)];

				i += 3;
				j += 4;
			}
			switch (inputSize)
			{
			case 1:
				output[j + 0] = base64Char[(input[i + 0] & 0xFC) >> 2];
				output[j + 1] = base64Char[(input[i + 0] & 0x03) << 4];		
				output[j + 2] = 61;
				output[j + 3] = 61;
				break;
			case 2:
				output[j + 0] = base64Char[(input[i + 0] & 0xFC) >> 2];
				output[j + 1] = base64Char[(input[i + 0] & 0x03) << 4 | (input[i + 1] & 0xF0) >> 4];
				output[j + 2] = base64Char[(input[i + 1] & 0x0F) << 2];
				output[j + 3] = 61;
				break;
			default:
				break;
			}

			if (isLittleEndian){
				swapByteOrder(true_input);
			}
			return Utf8.encode(output);
		},
		encodeUrl: function(input)
		{
			if (!("BYTES_PER_ELEMENT" in input))
				return false;
			const true_input = input;

			if (input.BYTES_PER_ELEMENT > 1)
			input = new Uint8Array((isLittleEndian ? swapByteOrder(input) : input).buffer);

			var inputSize = input.length;
			const output = new Uint8Array(Base64UrlLength(inputSize));

			var i=0, j=0;
			// Always works in blocks of 3 bytes
			for (; inputSize > 2; inputSize -= 3)
			{
				output[j + 0] = base64CharUrl[(input[i + 0] & 0xFC) >> 2];
				output[j + 1] = base64CharUrl[(input[i + 0] & 0x03) << 4 | (input[i + 1] & 0xF0) >> 4];
				output[j + 2] = base64CharUrl[(input[i + 1] & 0x0F) << 2 | (input[i + 2] & 0xC0) >> 6];
				output[j + 3] = base64CharUrl[(input[i + 2] & 0x3F)];

				i += 3;
				j += 4;
			}
			switch (inputSize)
			{
			case 1:
				output[j + 0] = base64CharUrl[(input[i + 0] & 0xFC) >> 2];
				output[j + 1] = base64CharUrl[(input[i + 0] & 0x03) << 4];
				break;
			case 2:
				output[j + 0] = base64CharUrl[(input[i + 0] & 0xFC) >> 2];
				output[j + 1] = base64CharUrl[(input[i + 0] & 0x03) << 4 | (input[i + 1] & 0xF0) >> 4];
				output[j + 2] = base64CharUrl[(input[i + 1] & 0x0F) << 2];
				break;
			default:
				break;
			}

			if (isLittleEndian){
				swapByteOrder(true_input);
			}
			return Utf8.encode(output);
		},
		decode: function(input, typedArray)
		{
			var inputSize = input.length;
			const output = new Uint8Array(Base64DecodeLength(inputSize, input));

			input = Utf8.decode(input, true); // JS internal encode           

			// Input is always in sets of 4 but can be truncated with = at the end	
			inputSize -= input[inputSize - 1] == 61;
			inputSize -= input[inputSize - 1] == 61;

			var i = 0,j = 0;            
			for (; inputSize > 3; inputSize -= 4)
			{
				output[j + 0] = base64Reverse[input[i + 0]] << 2 | (base64Reverse[input[i + 1]] & 0x30) >> 4;
				output[j + 1] = (base64Reverse[input[i + 1]] & 0x0F) << 4 | (base64Reverse[input[i + 2]] & 0x3C) >> 2;
				output[j + 2] = (base64Reverse[input[i + 2]] & 0x03) << 6 | base64Reverse[input[i + 3]];

				i += 4;
				j += 3;
			}
			switch (inputSize)
			{
			case 3:
				output[j + 1] = (base64Reverse[input[i + 1]] & 0x0F) << 4 | (base64Reverse[input[i + 2]] & 0x3C) >> 2;
			case 2:
				output[j + 0] = base64Reverse[input[i + 0]] << 2 | (base64Reverse[input[i + 1]] & 0x30) >> 4;
			default:
				break;
			}
			
			return typedArray ? (isLittleEndian ? swapByteOrder(new typedArray(output.buffer)) : new typedArray(output.buffer)) : output;
		}
	};
}());

const Base32 = (function(){
	
	const base32Char = new Uint8Array([0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4A, 0x4B, 0x4C, 0x4D, 0x4E, 0x4F, 0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5A, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37]);
	const base32Reverse = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 26, 27, 28, 29, 30, 31, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]);
	
	function Base32Length(byteLength)
	{
		return (Math.trunc(byteLength / 5) + (byteLength % 5 != 0)) * 8;
	}
	function Base32UrlLength(byteLength)
	{
		return Math.trunc(byteLength * 8 / 5) + (byteLength % 5 != 0 ? 1 : 0);
	}
	function Base32DecodeLength(encodedLength, encoded)
	{
		for (var i=encodedLength; --i >= 0; )
			if (encoded[i] == '=')
				--encodedLength;
			else
				break;
		return Math.trunc(encodedLength * 5 / 8);
	}

	return {
		length: Base32Length,
		urlLength: Base32UrlLength,	
		encode: function(input)
		{
			if (!("BYTES_PER_ELEMENT" in input))
				return false;
			const true_input = input;
			if (input.BYTES_PER_ELEMENT > 1)
				input = new Uint8Array((isLittleEndian ? swapByteOrder(input) : input).buffer);

			var inputSize = input.length;
			const output = new Uint8Array(Base32Length(inputSize));

			var i=0, j=0;
			// Always works in blocks of 5 bytes
			for (; inputSize > 4; inputSize -= 5)
			{
				output[j + 0] = base32Char[(input[i + 0] & 0xF8) >> 3];
				output[j + 1] = base32Char[(input[i + 0] & 0x07) << 2 | (input[i + 1] & 0xC0) >> 6];
				output[j + 2] = base32Char[(input[i + 1] & 0x3E) >> 1];
				output[j + 3] = base32Char[(input[i + 1] & 0x01) << 4 | (input[i + 2] & 0xF0) >> 4];
				output[j + 4] = base32Char[(input[i + 2] & 0x0F) << 1 | (input[i + 3] & 0x80) >> 7];
				output[j + 5] = base32Char[(input[i + 3] & 0x7C) >> 2];
				output[j + 6] = base32Char[(input[i + 3] & 0x03) << 3 | (input[i + 4] & 0xE0) >> 5];
				output[j + 7] = base32Char[(input[i + 4] & 0x1F) >> 0];

				i += 5;
				j += 8;
			}
			switch (inputSize)
			{
			case 1:
				output[j + 0] = base32Char[(input[i + 0] & 0xF8) >> 3];
				output[j + 1] = base32Char[(input[i + 0] & 0x07) << 2];
				output[j + 2] = 61;
				output[j + 3] = 61;
				output[j + 4] = 61;
				output[j + 5] = 61;
				output[j + 6] = 61;
				output[j + 7] = 61;
				break;
			case 2:
				output[j + 0] = base32Char[(input[i + 0] & 0xF8) >> 3];
				output[j + 1] = base32Char[(input[i + 0] & 0x07) << 2 | (input[i + 1] & 0xC0) >> 6];
				output[j + 2] = base32Char[(input[i + 1] & 0x3E) >> 1];
				output[j + 3] = base32Char[(input[i + 1] & 0x01) << 4];
				output[j + 4] = 61;
				output[j + 5] = 61;
				output[j + 6] = 61;
				output[j + 7] = 61;
				break;
			case 3:
				output[j + 0] = base32Char[(input[i + 0] & 0xF8) >> 3];
				output[j + 1] = base32Char[(input[i + 0] & 0x07) << 2 | (input[i + 1] & 0xC0) >> 6];
				output[j + 2] = base32Char[(input[i + 1] & 0x3E) >> 1];
				output[j + 3] = base32Char[(input[i + 1] & 0x01) << 4 | (input[i + 2] & 0xF0) >> 4];
				output[j + 4] = base32Char[(input[i + 2] & 0x0F) << 1];
				output[j + 5] = 61;
				output[j + 6] = 61;
				output[j + 7] = 61;
				break;
			case 4:
				output[j + 0] = base32Char[(input[i + 0] & 0xF8) >> 3];
				output[j + 1] = base32Char[(input[i + 0] & 0x07) << 2 | (input[i + 1] & 0xC0) >> 6];
				output[j + 2] = base32Char[(input[i + 1] & 0x3E) >> 1];
				output[j + 3] = base32Char[(input[i + 1] & 0x01) << 4 | (input[i + 2] & 0xF0) >> 4];
				output[j + 4] = base32Char[(input[i + 2] & 0x0F) << 1 | (input[i + 3] & 0x80) >> 7];
				output[j + 5] = base32Char[(input[i + 3] & 0x7C) >> 2];
				output[j + 6] = base32Char[(input[i + 3] & 0x03) << 3];
				output[j + 7] = 61;
				break;
			default:
				break;
			}

			if (isLittleEndian){
				swapByteOrder(true_input);
			}
			return Utf8.encode(output);
		},
		encodeUrl: function(input)
		{
			if (!("BYTES_PER_ELEMENT" in input))
				return false;
			const true_input = input;
			if (input.BYTES_PER_ELEMENT > 1)
				input = new Uint8Array((isLittleEndian ? swapByteOrder(input) : input).buffer);

			var inputSize = input.length;
			const output = new Uint8Array(Base32UrlLength(inputSize));

			var i=0, j=0;
			// Always works in blocks of 5 bytes
			for (; inputSize > 4; inputSize -= 5)
			{
				output[j + 0] = base32Char[(input[i + 0] & 0xF8) >> 3];
				output[j + 1] = base32Char[(input[i + 0] & 0x07) << 2 | (input[i + 1] & 0xC0) >> 6];
				output[j + 2] = base32Char[(input[i + 1] & 0x3E) >> 1];
				output[j + 3] = base32Char[(input[i + 1] & 0x01) << 4 | (input[i + 2] & 0xF0) >> 4];
				output[j + 4] = base32Char[(input[i + 2] & 0x0F) << 1 | (input[i + 3] & 0x80) >> 7];
				output[j + 5] = base32Char[(input[i + 3] & 0x7C) >> 2];
				output[j + 6] = base32Char[(input[i + 3] & 0x03) << 3 | (input[i + 4] & 0xE0) >> 5];
				output[j + 7] = base32Char[(input[i + 4] & 0x1F) >> 0];

				i += 5;
				j += 8;
			}
			switch (inputSize)
			{
			case 1:
				output[j + 0] = base32Char[(input[i + 0] & 0xF8) >> 3];
				output[j + 1] = base32Char[(input[i + 0] & 0x07) << 2];                
				break;
			case 2:
				output[j + 0] = base32Char[(input[i + 0] & 0xF8) >> 3];
				output[j + 1] = base32Char[(input[i + 0] & 0x07) << 2 | (input[i + 1] & 0xC0) >> 6];
				output[j + 2] = base32Char[(input[i + 1] & 0x3E) >> 1];
				output[j + 3] = base32Char[(input[i + 1] & 0x01) << 4];
				break;
			case 3:
				output[j + 0] = base32Char[(input[i + 0] & 0xF8) >> 3];
				output[j + 1] = base32Char[(input[i + 0] & 0x07) << 2 | (input[i + 1] & 0xC0) >> 6];
				output[j + 2] = base32Char[(input[i + 1] & 0x3E) >> 1];
				output[j + 3] = base32Char[(input[i + 1] & 0x01) << 4 | (input[i + 2] & 0xF0) >> 4];
				output[j + 4] = base32Char[(input[i + 2] & 0x0F) << 1];
				break;
			case 4:
				output[j + 0] = base32Char[(input[i + 0] & 0xF8) >> 3];
				output[j + 1] = base32Char[(input[i + 0] & 0x07) << 2 | (input[i + 1] & 0xC0) >> 6];
				output[j + 2] = base32Char[(input[i + 1] & 0x3E) >> 1];
				output[j + 3] = base32Char[(input[i + 1] & 0x01) << 4 | (input[i + 2] & 0xF0) >> 4];
				output[j + 4] = base32Char[(input[i + 2] & 0x0F) << 1 | (input[i + 3] & 0x80) >> 7];
				output[j + 5] = base32Char[(input[i + 3] & 0x7C) >> 2];
				output[j + 6] = base32Char[(input[i + 3] & 0x03) << 3];
				break;
			default:
				break;
			}

			if (isLittleEndian){
				swapByteOrder(true_input);
			}
			return Utf8.encode(output);
		},
		decode: function(input, typedArray)
		{
			var inputSize = input.length;
			const output = new Uint8Array(Base32DecodeLength(inputSize, input));
			
			inputSize = Base32UrlLength(output.length); // remove = padding from count
			input = Utf8.decode(input, true); // JS internal encode
			
			var i = 0,j = 0;            
			for (; inputSize > 7; inputSize -= 8)
			{
				output[j + 0] = base32Reverse[input[i + 0]] << 3 | (base32Reverse[input[i + 1]] & 0x1C) >> 2;
				output[j + 1] = (base32Reverse[input[i + 1]] & 0x03) << 6 | base32Reverse[input[i + 2]] << 1 | (base32Reverse[input[i + 3]] & 0x10) >> 4;
				output[j + 2] = (base32Reverse[input[i + 3]] & 0x0F) << 4 | (base32Reverse[input[i + 4]] & 0x1E) >> 1;
				output[j + 3] = (base32Reverse[input[i + 4]] & 0x01) << 7 | base32Reverse[input[i + 5]] << 2 | (base32Reverse[input[i + 6]] & 0x18) >> 3;
				output[j + 4] = (base32Reverse[input[i + 6]] & 0x07) << 5 | base32Reverse[input[i + 7]];
			 
				i += 8;
				j += 5;
			}
			switch (inputSize)
			{
			case 7:
				output[j + 3] = (base32Reverse[input[i + 4]] & 0x01) << 7 | base32Reverse[input[i + 5]] << 2 | (base32Reverse[input[i + 6]] & 0x18) >> 3;
			case 6:
			case 5:                
				output[j + 2] = (base32Reverse[input[i + 3]] & 0x0F) << 4 | (base32Reverse[input[i + 4]] & 0x1E) >> 1;
			case 4:
				output[j + 1] = (base32Reverse[input[i + 1]] & 0x03) << 6 | base32Reverse[input[i + 2]] << 1 | (base32Reverse[input[i + 3]] & 0x10) >> 4;
			case 3:
			case 2:
				output[j + 0] = base32Reverse[input[i + 0]] << 3 | (base32Reverse[input[i + 1]] & 0x1C) >> 2;
			default:
				break;
			}
			
			return typedArray ? (isLittleEndian ? swapByteOrder(new typedArray(output.buffer)) : new typedArray(output.buffer)) : output;
		}
	};
}());

const Hex = (function(){
	const hexChar = new Uint8Array([0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46 ]);
	const hexReverse = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 0, 0, 0, 0, 0, 0, 10, 11, 12, 13, 14, 15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 11, 12, 13, 14, 15]);
	
	return {
		length: function(byteLength){
			return byteLength * 2;
		},
		encode: function(input)
		{     
			if (!("BYTES_PER_ELEMENT" in input))
				return false;
			const true_input = input;
			if (input.BYTES_PER_ELEMENT > 1)
				input = new Uint8Array((isLittleEndian ? swapByteOrder(input) : input).buffer);
					   
			const inputSize = input.length;
			const output = new Uint8Array(inputSize * 2);

			for (var i = 0; i < inputSize; i++)
			{
				output[2 * i] = hexChar[(input[i] & 0xF0) >> 4];
				output[2 * i + 1] = hexChar[input[i] & 0x0F];
			}

			if (isLittleEndian){
				swapByteOrder(true_input);
			}
			return Utf8.encode(output);
		},
		decode: function(input, typedArray)
		{
			input = Utf8.decode(input, true); // JS internal encode
			
			const inputSize = input.length;
			if (inputSize & 1)
				throw "Invalid input string size for binary hex decoding";
			const output = new Uint8Array(Math.trunc(inputSize / 2));

			for (var i = 0; i < inputSize; i += 2)
			{
				output[i / 2] = hexReverse[input[i]] << 4 | hexReverse[input[i + 1]];
			}

			return typedArray ? (isLittleEndian ? swapByteOrder(new typedArray(output.buffer)) : new typedArray(output.buffer)) : output;
		}
	};
}());


const getJsonUnicode = ch => {
	if (!ch || !ch.length){
		return null;
	}
	const r = [...Utf16.decode(ch)].map(v=>'u' + Hex.encode(new Uint16Array([v])).toLowerCase());
	return r.length > 1 ? r : r[0];
};
const fromJsonUnicode = uc => {
	if (!uc || !uc.length){
		return null;
	}
	if (Array.isArray(uc)){
		return uc.map(u=>fromUnicode(u)).join('');
	}
	const s_idx = uc.toUpperCase().split('').findIndex(c=>{return ((c >= '0') & (c <= '9')) | ((c >= 'A') & (c <= 'F'));});
	if (s_idx == -1){
		return null;
	}
	return Utf16.encode(Hex.decode(uc.substr(s_idx).padStart(4, '0'), Uint16Array));
};

const getUnicode = ch => {
	if (!ch || !ch.length){
		return null;
	}
	const u8 = Utf8.decode(ch);
	const r = [];
	for (let i = 0; i < u8.length;){
		let byte_length = 1;
		if((u8[i] & 0xF8) == 0xF0){ 
			byte_length = 4;
		}
		else if((u8[i] & 0xF0) == 0xE0){
			byte_length = 3;
		}
		else if((u8[i] & 0xE0) == 0xC0){
			byte_length = 2;
		}
		r.push('U+' + Hex.encode(Utf32.decode(Utf8.encode(u8.subarray(i, i + byte_length)))).replaceAll('0',' ').trimStart().replaceAll(' ', '0').padStart(4, '0'));
		i += byte_length;	
	}
	return r.length > 1 ? r : r[0];
};
const fromUnicode = uc => {
	if (!uc || !uc.length){
		return null;
	}
	if (Array.isArray(uc)){
		return uc.map(u=>fromUnicode(u)).join('');
	}
	const s_idx = uc.toUpperCase().split('').findIndex(c=>{return ((c >= '0') & (c <= '9')) | ((c >= 'A') & (c <= 'F'));});
	if (s_idx == -1){
		return null;
	}
	return Utf32.encode(Hex.decode(uc.substr(s_idx).padStart(8, '0'), Uint32Array));
};


const CRC32B64 = function(r){return Base64.encodeUrl(new Uint32Array([CRC32(r)]));};
