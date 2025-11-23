// general useful stuff
const isJsonObject = (function () {
	const json_constructor = ({}).constructor;
	return function (obj) {
		if (!obj || typeof (obj) != 'object') {
			return false;
		}

		return obj.constructor == json_constructor;
	}
})();

const epochTime = (...args) => Math.trunc(new Date(...args).getTime() / 1e3);

const isArray = obj => {
	if (typeof (obj) == 'object' && obj != null) {
		return (Array.isArray(obj) || ('BYTES_PER_ELEMENT' in obj));
	}
	return false;
};
const isEqual = (a, b) => {
	if (typeof (a) != typeof (b)) {
		return false;
	}
	if (isArray(a)) {
		if (!isArray(b)) {
			return false;
		}
		if (a.length != b.length) {
			return false;
		}
		for (let i = 0; i < a.length; ++i) {
			if (!isEqual(a[i], b[i])) {
				return false;
			}
		}
		return true;
	}
	if (isJsonObject(a)) {
		if (!isJsonObject(b)) {
			return false;
		}
		const a_k = Object.keys(a).sort();
		const b_k = Object.keys(b).sort();
		if (!isEqual(a_k, b_k)) {
			return false;
		}
		for (let k of a_k) {
			if (!isEqual(a[k], b[k])) {
				return false;
			}
		}
		return true;
	}
	return a == b;
};

const lowerBoundIndex = (obj, value, hint) => {
	if (!isArray(obj)) {
		throw TypeError("Object must be some form of array")
	}

	let count = obj.length, first = 0, it;
	if (hint && hint >= 0 && hint < count) {
		count -= hint;
		first = hint;
	}
	while (count > 0) {
		it = first;
		const step = Math.trunc(count / 2);
		it += step;
		if (obj[it] < value) {
			first = ++it;
			count -= step + 1;
		}
		else {
			count = step;
		}
	}
	return first;
};
const upperBoundIndex = (obj, value, hint) => {
	if (!isArray(obj)) {
		throw TypeError("Object must be some form of array")
	}

	let count = obj.length, first = 0, it;
	if (hint && hint >= 0 && hint < count) {
		count -= hint;
		first = hint;
	}
	while (count > 0) {
		it = first;
		const step = Math.trunc(count / 2);
		it += step;
		if (!(value < obj[it])) {
			first = ++it;
			count -= step + 1;
		}
		else {
			count = step;
		}
	}
	return first;
};
const binaryIndexOf = (obj, value) => {
	const lb_idx = lowerBoundIndex(obj, value);
	return lb_idx < obj.length && obj[lb_idx] == value ? lb_idx : -1;
};

const genericMergeObject = function (overwrite_on_conflict, target, ...sources) {
	if (!isJsonObject(target)) {
		throw TypeError("Invalid target type");
	}
	for (const source of sources) {
		if (!isJsonObject(source)) {
			throw TypeError("Invalid source type");
		}
		for (const key in source) {
			if (isJsonObject(source[key]) && isJsonObject(target[key])) {
				if (overwrite_on_conflict) {
					genericMergeObject(overwrite_on_conflict, target[key], source[key]);
				}
			}
			else {
				if (!(key in target) || overwrite_on_conflict) {
					target[key] = source[key];
				}
			}
		}
	}
	return target;
};
const mergeObject = function (target, ...sources) {

	return genericMergeObject(true, target, ...sources);
};


// Often used
const sleepFor = async (ms) => new Promise((s, e) => window.setTimeout(s, ms));

// General 
const InForeground = (function () {
	var iFG = true;

	window.addEventListener('focus', function () { iFG = true; }, { passive: true });
	window.addEventListener('blur', function () { iFG = false; }, { passive: true });

	return function () { return iFG; };
})();

function IsMobile() {
	return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function DateToLocalDateTimeString(date, accuracy, range) {
	const d = new Date(date);
	const month = d.getMonth() + 1;
	const day = d.getDate();
	const hour = d.getHours();
	const minute = d.getMinutes();
	const second = d.getSeconds();
	const ms = d.getMilliseconds();

	const result = d.getFullYear() + '-' + (month < 10 ? '0' + month : month) + '-' + (day < 10 ? '0' + day : day)
		+ ' ' + (hour < 10 ? '0' + hour : hour) + ':' + (minute < 10 ? '0' + minute : minute) + ':' + (second < 10 ? '0' + second : second)
		+ (ms > 0 ? String(ms / 1000).substr(1) : "");
	if (!accuracy)
		return result;

	if (accuracy < 500) {
		if (range) {
			if (range < 86400000) // 1 day
				return result.substr(11); // hh:mm:ss.ms
			else if (range < 31536000000) // 1 year
				return result.substr(5);
		}
		return result;
	}
	else if (accuracy < 30000) // half a minute --> second
	{
		if (range) {
			if (range < 86400000) // 1 day
				return result.substr(11, 8); // hh:mm:ss.ms
			else if (range < 31536000000) // 1 year
				return result.substr(5, 14);
		}
		return result.substr(0, 19);
	}
	else if (accuracy < 1800000) // half an hour--> second
	{
		if (range) {
			if (range < 86400000) // 1 day
				return result.substr(11, 5); // hh:mm:ss.ms
			else if (range < 31536000000) // 1 year
				return result.substr(5, 11);
		}
		return result.substr(0, 16);
	}
	else if (accuracy <= 3600000) // 1 hour
	{
		if (range) {
			if (range < 31536000000) // 1 year
				return result.substr(5, 8);
		}
		return result.substr(13);
	}
	else {
		return result.substr(0, 10); // YYYY-MM-DD
	}
}

function GetDefaultTextWidth(text) {
	return document.createElement("canvas").getContext('2d').measureText(text).width;
}

const DrawArrow = function () {
	const coordinates = [[50, 0], [0, 40], [30, 40], [30, 100], [70, 100], [70, 40], [100, 40]];
	return function (ctx, width, height, direction, offX, offY) // direction 0 = UP, 1 = LEFT, 2 = DOWN and 3 is RIGHT
	{
		const xIndex = direction % 2 == 0 ? 0 : 1;
		const yIndex = direction % 2 == 0 ? 1 : 0;
		const a = direction < 2 ? [width / 100, height / 100] : [-width / 100, -height / 100];
		const b = direction < 2 ? [0, 0] : [width, height];

		if (ctx) {
			if (!offX) offX = 0;
			if (!offY) offY = 0;

			ctx.beginPath();
			ctx.moveTo(offX + coordinates[0][xIndex] * a[0] + b[0], offY + coordinates[0][yIndex] * a[1] + b[1]);
			for (var i = 1, li = coordinates.length; i < li; i++)
				ctx.lineTo(offX + coordinates[i][xIndex] * a[0] + b[0], offY + coordinates[i][yIndex] * a[1] + b[1]);
			ctx.closePath();
		}
		return (coordinates[4][xIndex] - coordinates[3][xIndex]) * width / 100;
	};
}();

function scriptReport(verboseOnly) {
	const cT = new Date().getTime();
	const scriptEl = document.getElementsByTagName("script");
	const out = verboseOnly ? console.debug : console.log;
	out(scriptEl.length + " scripts specified by server");
	for (var i = 0; i < scriptEl.length; i++) {
		const src = scriptEl[i].src;
		var rep = "Script " + i;
		if (src.substring(0, window.location.origin.length) == window.location.origin) {
			if (typeof (Base64) != 'undefined' && src.length - src.indexOf("etag=") == 16) {
				const bytes = Base64.decode(src.substring(src.indexOf("etag=") + 5));
				const dA = (((bytes[0] << 26) | (bytes[1] << 18) | (bytes[2] << 10) | (bytes[3] << 2) | (bytes[4] >> 6)) * ((1 << 30) / 1e6) + (((bytes[4] & 0x3F) << 24) | (bytes[5] << 16) | (bytes[6] << 8) | bytes[7]) / 1e6);
				const dB = (((bytes[7] << 26) | (bytes[6] << 18) | (bytes[5] << 10) | (bytes[4] << 2) | (bytes[3] >> 6)) * ((1 << 30) / 1e6) + (((bytes[3] & 0x3F) << 24) | (bytes[2] << 16) | (bytes[1] << 8) | bytes[0]) / 1e6);
				// Pick which order makes the most sense
				const ct = new Date().getTime();
				const d = new Date(dB > 0 && dB < ct && (dA < 0 || dA > ct || (ct - dA) > (ct - dB)) ? dB : dA);
				rep += " last changed " + DateToLocalDateTimeString(d);
			}
			rep += " from " + src.substring(window.location.origin.length);
		}
		else
			rep += src.length ? " from " + src : " 'self'";
		out(rep);
	}
}

// Random noise generators
const FillCanvasWithWhiteNoise = function () {
	const timeoutT = 30e3;
	const bufferC = IsMobile() ? 20 : 100;
	const randomNoiseBuffer = {};
	const RandomNoiseCleanCallback = function () {
		//console.log(this);
		if (new Date() - this.lastUsed < timeoutT)
			return;
		window.clearInterval(this.interval);
		delete this;
	};
	return function (ctx, opacity, pureRandom) {
		const cw = ctx.canvas.width;
		const ch = ctx.canvas.height;

		const idata = ctx.createImageData(cw, ch);
		const buf32 = new Uint32Array(idata.data.buffer);
		buf32.fill((Math.trunc(opacity * 255) || 51) << 24);

		const ca = pureRandom ? buf32.length : Math.min(Math.max(3333, Math.ceil(Math.exp(Math.log(buf32.length) / 2.1))), buf32.length);

		var imageOutputted = false;

		const id = ca + "-" + cw + 'x' + ch;
		if (id in randomNoiseBuffer) {
			randomNoiseBuffer[id].lastUsed = new Date();
			ctx.putImageData(randomNoiseBuffer[id].buffer[Math.trunc(Math.random() * randomNoiseBuffer[id].buffer.length)], 0, 0);
			imageOutputted = true;
			if (randomNoiseBuffer[id].buffer.length >= bufferC)
				return;
		}
		else
			randomNoiseBuffer[id] = { buffer: [], pixelCount: cw * ch, pureRandomCount: ca, lastUsed: new Date(), interval: window.setInterval(function () { RandomNoiseCleanCallback.call(randomNoiseBuffer[id]); }, timeoutT) };

		var li = ca;
		for (var i = 0; i < li; i++)
			buf32[i] |= Math.trunc(Math.random() * 16777216);	// RGB

		if (!pureRandom) {
			li = buf32.length;
			while (li > i) {
				const tc = Math.max(Math.min(i, 100), Math.ceil(Math.random() * Math.min(i, li - i)));
				buf32.copyWithin(i, 0, tc);
				i += tc;
			}

		}

		randomNoiseBuffer[id].buffer.push(idata);
		if (!imageOutputted)
			ctx.putImageData(idata, 0, 0);
		//imageOutputted = true;
	};
}();
function GenWhiteNoiseImageUrl(width, height, opacity, pureRandom) {
	const c = document.createElement("canvas");
	c.width = width;
	c.height = height;

	const ctx = c.getContext('2d');
	FillCanvasWithWhiteNoise(ctx, opacity, pureRandom);
	return c.toDataURL("image/webp");
}


// Element functions
const enterViewportEventType = "enterViewportEvent";
const detectEnterViewportClassname = "enterViewportClassname";
InViewport = function () {
	var margin = Math.max(window.innerHeight, window.innerWidth) / 10;
	window.addEventListener('resize', function () {
		margin = Math.max(window.innerHeight, window.innerWidth) / 10;
	});

	return function (element) {
		if (!element || element.clientWidth * element.clientHeight == 0 || IsFullscreen(element, true))
			return false;

		const rect = element.getBoundingClientRect();
		return (rect.top - margin < element.scrollTop + window.innerHeight) & (rect.bottom + margin > element.scrollTop) & (rect.left - margin < element.scrollLeft + window.innerWidth) & (rect.right + margin > element.scrollLeft);
	};
}();
const RunViewportScan = function () {
	var handling = false;
	return function (evt) {
		if (handling)
			return;
		handling = true;

		if (window.document && window.document.visibilityState == 'hidden') {
			handling = false;
			return;
		}

		const el = new Array(...document.getElementsByClassName(detectEnterViewportClassname));
		const li = el.length;
		const e = new Event(enterViewportEventType, { time: new Date() });


		while (true) {
			let rem_idx = [];
			let invisible_count = 0;
			for (var i = 0; i < li; i++) {
				if (InViewport(el[i])) {
					const idx = i;
					el[i].addEventListener(enterViewportEventType, () => rem_idx.push(idx), { passive: true, once: true });
					el[i].dispatchEvent(e); // synchronous (complete after handling events)
				}
				else {
					++invisible_count;
				}
			}

			rem_idx.reverse().forEach(idx => el.splice(idx, 1));
			if (el.length <= invisible_count) {
				break;
			}
		}
		handling = false;

	};
}();
window.addEventListener("scroll", RunViewportScan, { passive: true });
window.addEventListener("resize", RunViewportScan, { passive: true });
window.addEventListener("load", () => { RunViewportScan(); window.setTimeout(RunViewportScan, 500); }, { passive: true });
window.setInterval(RunViewportScan, Math.trunc((5 + Math.random()) * 1e3));

function RemoveElement(element) {
	if (element && element.parentNode) {
		for (var i = element.childNodes.length - 1; i > -1; i--) RemoveElement(element.childNodes[i]);

		var clone = element.cloneNode(true)
		element.parentNode.replaceChild(clone, element);
		clone.parentNode.removeChild(clone);
		element = false;
	}
}

const CoupleRemoval = (function () {
	const elementContains = function (container, element) {
		if (!element)
			return false;
		if (container == element)
			return true;
		return elementContains(container, element.parentNode)
	};

	const watch_list = [];
	const observer = new MutationObserver(mut_arr => {
		if (watch_list.length == 0)
			return;
		// for loop is faster than function calling on forEach
		const lk = mut_arr.length;
		for (let k = 0; k < lk; ++k) {
			const mut_removed = mut_arr[k].removedNodes; // reference
			const lj = mut_removed.length;
			for (let j = 0; j < lj; ++j) {
				const removed_element = mut_removed[j];
				if (typeof (removed_element) != 'object' || !('parentNode' in removed_element))
					continue;

				for (let i = 0; i < watch_list.length; ++i) {
					const to_watch = watch_list[i]; // reference

					if (elementContains(removed_element, to_watch[0])) {
						RemoveElement(to_watch[1]);
						watch_list.splice(i, 1);
						--i;
					}
					else if (elementContains(removed_element, to_watch[1])) {
						if (to_watch[2])
							RemoveElement(to_watch[0]);
						watch_list.splice(i, 1);
						--i;
					}
				}
			}
		}
	});
	observer.observe(document, { subtree: true, childList: true });
	return function (track_element, to_remove, bidirectional) {
		watch_list.push([track_element, to_remove, bidirectional ? true : false]);
	};
})();

const AddToolTip = (function () {
	const transition_time = 500;
	const max_visible_time = 10e3;

	const createTooltipSpan = function (element, text_or_element, mouse_position) {
		const bnd = element.getBoundingClientRect();
		if (bnd.left == bnd.right || bnd.top == bnd.bottom)
			return;

		const s = document.createElement("span");
		s.style.position = 'absolute';
		if (typeof (text_or_element) == 'object' && 'parentNode' in text_or_element)
			s.appendChild(text_or_element);
		else {
			s.innerText = text_or_element;
			s.style.fontSize = '90%';
			s.style.fontStyle = 'italic';
			s.style.color = "var(--anti-bg-color)";
		}

		s.style.left = '-100%';
		s.style.top = '-100%';
		s.style.padding = '5px';
		s.style.backgroundColor = "var(--bg-color-20-transparent)";
		s.style.border = "1px solid var(--anti-bg-color-20-transparent)";

		s.style.opacity = 0;
		s.style.transition = "ease opacity " + transition_time / 1e3 + "s";
		s.style.zIndex = 10000;

		s.onmouseenter = () => RemoveElement(s);

		(document.fullscreenElement || document.webkitFullscreenElement || document.body).appendChild(s);
		CoupleRemoval(element, s);

		window.setTimeout(function () {
			s.style.opacity = 1;

			const mid = (bnd.left + bnd.right) / 2;
			if (mid - s.clientWidth / 2 < 0)
				s.style.left = (bnd.left + window.scrollX) + 'px';
			else if (mid + s.clientWidth / 2 > window.innerWidth)
				s.style.left = (bnd.right - s.clientWidth + window.scrollX) + 'px';
			else
				s.style.left = (mid - s.clientWidth / 2 + window.scrollX) + 'px';

			if (bnd.top - s.clientHeight - 5 < 0)
				s.style.top = (bnd.bottom + 5 + window.scrollY) + 'px';
			else
				s.style.top = (bnd.top - s.clientHeight - 5 + window.scrollY) + 'px';

			if (mouse_position) {
				const distance_to_mouse = Math.hypot((mouse_position[0] + window.scrollX) - (parseInt(s.style.left) + s.clientWidth / 2), (mouse_position[1] + window.scrollY) - (parseInt(s.style.top) + s.clientHeight / 2));

				if (distance_to_mouse > 100) {
					if (mouse_position[0] - s.clientWidth / 2 < 0)
						s.style.left = (mouse_position[0] + window.scrollX + 5) + 'px';
					else if (mouse_position[0] + s.clientWidth / 2 > window.innerWidth)
						s.style.left = (mouse_position[0] + window.scrollX - 5 - s.clientWidth) + 'px';
					else
						s.style.left = (mouse_position[0] + window.scrollX - s.clientWidth / 2) + 'px';

					if (mouse_position[1] - s.clientHeight - 10 < 0)
						s.style.top = (mouse_position[1] + window.scrollY + 30) + 'px';
					else
						s.style.top = (mouse_position[1] + window.scrollY - 10 - s.clientHeight) + 'px';
				}
			}
		}, 1);

		window.setTimeout(() => RemoveElement(s), max_visible_time);
		return s;
	};


	return function (element, tooltip_text_or_element, custom_timeout_time, conditional_display_callback) {
		var tt = null;
		var to = 0;
		var ie = false;
		const mouse_client = [0, 0];
		const removeFunc = function () {
			ie = false;
			window.clearTimeout(to);
			if (!tt) {
				to = 0;
				return;
			}
			tt.style.opacity = 0;
			to = window.setTimeout(() => {
				RemoveElement(tt);
				tt = null;
			}, transition_time);

		};

		element.addEventListener('mousemove', function (evt) {
			ie = true;
			if (tt)
				return;
			mouse_client[0] = evt.clientX;
			mouse_client[1] = evt.clientY;
			window.clearTimeout(to);
			to = window.setTimeout(() => {
				if (ie && (typeof (conditional_display_callback) != 'function' || conditional_display_callback())) {
					tt = createTooltipSpan(element, tooltip_text_or_element, mouse_client);
				}
			}, typeof (custom_timeout_time) == 'number' ? custom_timeout_time : 1e3);
		}, { passive: true });
		element.addEventListener('mouseleave', removeFunc, { passive: true });
	};
})();


function IsFullscreen(element, requireElementCheck) {
	const possibleElement = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
	if (possibleElement)
		return !requireElementCheck || element == possibleElement;

	if (!element)
		return false;
	if (!(element.innerWidth == screen.width && element.innerHeight == screen.height) && !(element.outerWidth == screen.width && element.outerHeight == screen.height) && !document.webkitIsFullScreen)
		return false;
	return true;
}
// Only work on user gesture
function ExitFullscreen(element) {
	if (document.exitFullScreen) document.exitFullScreen();
	else if (document.exitFullScreen) document.exitFullScreen();
	else if (document.webkitIsFullScreen) document.webkitExitFullscreen();
	else if (document.mozExitFullScreen) document.mozExitFullScreen();
	else if (document.oExitFullScreen) document.oExitFullScreen();
	else if (document.msExitFullScreen) document.msExitFullScreen();
	else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
}
function SetFullscreen(element) {
	if (element.requestFullscreen) {
		element.requestFullscreen({ navigationUI: "hide" });
	} else if (element.mozRequestFullScreen) {
		element.mozRequestFullScreen();
	} else if (element.webkitRequestFullscreen) {
		element.webkitRequestFullscreen();
	}
}



const promptForBoolean = async function (msg, state_true, state_false, default_true, answer_timeout) {
	const overlay = new OverlayBody(100, true);
	const body = overlay.body;

	const message = document.createElement("div");
	message.style.marginBottom = '20px';
	message.innerHTML = msg;
	body.appendChild(message);

	const state_t_b = document.createElement('div');
	state_t_b.classList.add("normalButton");
	state_t_b.classList.add("button");
	state_t_b.style.display = 'inline-block';
	state_t_b.style.padding = '10px';
	state_t_b.style.margin = '5px';
	state_t_b.style.width = '100px';
	const state_f_b = state_t_b.cloneNode(true);
	body.appendChild(state_t_b);
	body.appendChild(state_f_b);

	state_t_b.innerHTML = state_true;
	state_f_b.innerHTML = state_false;
	const default_state = default_true ? state_true : state_false;
	const default_state_b = default_true ? state_t_b : state_f_b;

	overlay.removeOverlayCallback = function () {
		default_state_b.onclick();
	};

	if (answer_timeout) {
		const answer_by = new Date().getTime() + answer_timeout;
		const answer_timeout_updater = () => {
			const remaining_time = answer_by - new Date().getTime();
			if (remaining_time > 0 && default_state_b.parentElement) {
				default_state_b.innerHTML = default_state + " (" + Math.trunc(remaining_time / 1000) + "s)";
				window.setTimeout(answer_timeout_updater, 500);
			}
		};
		answer_timeout_updater();
	}

	return await new Promise((s, e) => {
		const timeout_handle = !answer_timeout ? 0 : window.setTimeout(() => default_state_b.onclick(), answer_timeout);

		state_t_b.onclick = () => {
			window.clearTimeout(timeout_handle);
			s(true);
			overlay.removeOverlayCallback = null;
			overlay.RemoveOverlay();
		};
		state_f_b.onclick = () => {
			window.clearTimeout(timeout_handle);
			s(false);
			overlay.removeOverlayCallback = null;
			overlay.RemoveOverlay();
		};
	});

};

const promptForFile = async function (allow_multiple, accept_mimes) {
	const i_file = document.createElement('input');
	i_file.type = 'file';
	if (isArray(accept_mimes)) {
		accept_mimes = accept_mimes.join(', ');
	}
	if (accept_mimes) {
		i_file.setAttribute('accept', accept_mimes);
	}
	if (allow_multiple) {
		i_file.setAttribute('multiple', '1');
	}


	const files = await new Promise((s, e) => {
		i_file.onclick = () => {
			i_file.onclick = null;

			window.addEventListener('focus', async () => {
				await sleepFor(1e3);
				if (i_file.onchange) {
					i_file.onchange = null;
					s(i_file.files);
				}
			}, { passive: true, once: true });
		}
		i_file.onchange = () => {
			i_file.onchange = null;
			s(i_file.files);
		};
		i_file.click();
	});

	if (!files.length) {
		return null;
	}
	if (allow_multiple) {
		return files;
	}
	return files[0];
};

// efficient on numbers and boolean (or with zstandard)
function compressJSONTable(json, use_zstandard, encrypt) {
	if (encrypt) {
		return new Promise(async (s, e) => {
			const k = await RetrieveEncryptionKey();
			if (!k) {
				s(null);
				return;
			}
			const comp = compressJSONTable(json, use_zstandard, false);
			comp.data = await EncryptMessage(k, Base64.decode(comp.data));
			comp.encrypted = true;
			s(comp);
		});
	}

	const head = json.header;
	const row_length = head.length;
	const data_length = json.data.length;
	const data_types = [];

	const js_col_data = [];
	const js_str_length = [];
	let data_bytes = 0;

	// 1, 2, 4, 8 bytes
	signed_min = [1 << 7, 1 << 15, Math.abs(1 << 31), 0];

	// 1, 2, 4, 8, 16, 32, 64, 128
	// 0, 1, 2, 3, 4,   5,  6,   7
	const shift_upper = 4;

	// determine types
	if (json.data.length) {
		// unsigned = 0, signed, float, bool, (null, object, array, string)
		for (var j = 0; j < row_length; ++j) {
			// first non-null
			var first_not_null = -1;
			for (var i = 0; i < data_length; ++i) {
				if (json.data[i][j] !== null) {
					first_not_null = i;
					break;
				}
			}
			let dtype = 0;
			if (first_not_null == -1) {
				first_not_null = 0;
			}
			switch (typeof (json.data[first_not_null][j])) {
				case 'number':
					{
						// signed = 0, unsigned, float
						// check: min, max, is_float
						var min = json.data[first_not_null][j];
						var max = min;
						var is_float = Math.trunc(min) != min;
						for (var i = first_not_null + 1; i < data_length; ++i) {
							const v = json.data[i][j]; // copy
							is_float |= (Math.trunc(v) != v);
							if (v < min) {
								min = v;
							}
							else if (v > max) {
								max = v;
							}
						}
						dtype = is_float ? 2 : (min < 0 ? 1 : 0);
						switch (dtype) {
							case 0:
								dtype <<= shift_upper;
								if (max < (1 << 8)) {
									dtype |= 1;
								}
								else if (max < (1 << 16)) {
									dtype |= 2;
								}
								else if (max < Math.abs(1 << 31) * 2) {
									dtype |= 4;
								}
								else {
									dtype = (2 << shift_upper) | 8;
								}
								break;
							case 1:
								dtype <<= shift_upper;
								max = Math.max(max, Math.abs(min));
								if (max < (1 << 7)) {
									dtype |= 1;
								}
								else if (max < (1 << 15)) {
									dtype |= 2;
								}
								else if (max < Math.abs(1 << 31)) {
									dtype |= 4;
								}
								else {
									dtype = (2 << shift_upper) | 8;
								}
								break;
							default:
								dtype = (2 << shift_upper) | 8;
								break;
						}
						break;
					}
				case 'boolean':
					// bool (bitset)
					dtype = 3 << shift_upper;
					break;
				case 'string':
					dtype = 4 << shift_upper;
					break;
				default:
					if (json.data[first_not_null][j] == null) {
						dtype = 5 << shift_upper;
					}
					else {
						// stringify
						dtype = (4 << shift_upper) | 1;
					}
					break;
			}
			data_types.push(dtype);

			let store_type = null;
			let c_data = -1;
			switch (dtype >> shift_upper) {
				case 0: // unsigned
					switch (dtype & ((1 << shift_upper) - 1)) {
						case 1: store_type = Uint8Array; break;
						case 2: store_type = Uint16Array; break;
						case 4: store_type = Uint32Array; break;
						default: throw TypeError("invalid state");
					}
					break;
				case 1: // signed
					switch (dtype & ((1 << shift_upper) - 1)) {
						case 1: store_type = Int8Array; break;
						case 2: store_type = Int16Array; break;
						case 4: store_type = Int32Array; break;
						default: throw TypeError("invalid state");
					}
					break;
				case 2: // float
					switch (dtype & ((1 << shift_upper) - 1)) {
						case 4: store_type = Float32Array; break;
						case 8: store_type = Float64Array; break;
						default: throw TypeError("invalid state");
					}
					break;
				case 3: // bool (bitset)
					{
						store_type = Uint8Array;
						c_data = new store_type(Math.ceil(data_length / 8));
						c_data.fill(0);
						let p = 0;
						for (var i = 0; i < data_length; ++i) {
							const m = i % 8;
							c_data[p] |= json.data[i][j] ? (1 << m) : 0;
							if (m == 7) {
								++p;
							}
						}
						break;
					}
				case 4: // string
					{
						store_type = Uint8Array;
						c_data = [];
						for (var i = 0; i < data_length; ++i) {
							c_data.push(json.data[i][j]);
						}
						c_data = Utf8.decode(JSON.stringify(c_data));
						js_str_length.push(c_data.length);
						break;
					}
				case 5:
					store_type = Uint8Array;
					c_data = new store_type(0);
					break;
				default:
					throw TypeError("invalid state");
			}
			if (c_data == -1) {
				c_data = new store_type(data_length);
				for (var i = 0; i < data_length; ++i) {
					c_data[i] = json.data[i][j];
				}
			}
			js_col_data.push(c_data);
			data_bytes += c_data.length * c_data.BYTES_PER_ELEMENT;
		}

		data_bytes = new Uint8Array(data_bytes);
		let p = 0;
		for (var j = 0; j < row_length; ++j) {
			const u8_view = new Uint8Array(js_col_data[j].buffer);
			for (var i = 0; i < u8_view.length; ++i) {
				data_bytes[p] = u8_view[i];
				++p;
			}
		}

		// compress data
		if (use_zstandard) {
			data_bytes = ZStandard.compress(data_bytes);
		}
	}

	return { head: head, dtype: data_types, slength: js_str_length, dlength: data_length, data: Base64.encodeUrl(data_bytes), encrypted: false, used_zstandard: use_zstandard ? true : false };
}
function decompressJSONTable(json) {
	if (json.encrypted) {
		return new Promise(async (s, e) => {
			const k = await RetrieveEncryptionKey();
			if (!k) {
				s(null);
				return;
			}
			json.data = Base64.encodeUrl(await DecryptMessage(k, json.data));
			json.encrypted = false;
			s(decompressJSONTable(json));
		});
	}

	const shift_upper = 4;
	const lower = (1 << shift_upper) - 1;
	const upper = -1 ^ lower;

	const row_length = json.head.length;
	let data_bytes = json.used_zstandard ? ZStandard.decompress(Base64.decode(json.data)) : Base64.decode(json.data);

	// split into dtype
	let p = 0;
	let si = 0;
	const data = new Array(json.dlength);
	for (let i = 0; i < json.dlength; ++i) {
		data[i] = new Array(row_length);
	}
	for (let j = 0; j < row_length; ++j) {
		let col_data = -1;
		let store_type = null;
		switch (json.dtype[j] >> shift_upper) {
			case 0:
				switch (json.dtype[j] & lower) {
					case 1: store_type = Uint8Array; break;
					case 2: store_type = Uint16Array; break;
					case 4: store_type = Uint32Array; break;
					default: throw TypeError("invalid state");
				}
				// col_data = new store_type(json.dlength);				
				break;
			case 1:
				switch (json.dtype[j] & lower) {
					case 1: store_type = Int8Array; break;
					case 2: store_type = Int16Array; break;
					case 4: store_type = Int32Array; break;
					default: throw TypeError("invalid state");
				}
				// col_data = new store_type(json.dlength);
				break;
			case 2:
				switch (json.dtype[j] & lower) {
					case 4: store_type = Float32Array; break;
					case 8: store_type = Float64Array; break;
					default: throw TypeError("invalid state");
				}
				// col_data = new store_type(json.dlength);
				break;
			case 3:
				{
					store_type = Uint8Array;
					const col_bytes_length = Math.ceil(json.dlength / 8);
					col_data = new store_type(data_bytes.buffer, p, p + col_bytes_length);
					p += col_bytes_length;
					let k = 0;
					for (let i = 0; i < json.dlength; ++i) {
						const m = i % 8;
						data[i][j] = (col_data[k] & (1 << m)) ? true : false;
						if (m == 7) {
							++k;
						}
					}
					break;
				}
			case 4:
				store_type = Uint8Array;
				const col_bytes_length = json.slength[si];
				++si;
				col_data = new store_type(data_bytes.subarray(p, p + col_bytes_length)); // copy for fixed size
				p += col_bytes_length;
				col_data = JSON.parse(Utf8.encode(col_data));
				for (let i = 0; i < json.dlength; ++i) {
					data[i][j] = col_data[i];
				}
				break;
			case 5:
				store_type = Uint8Array;
				col_data = new store_type(0);
				for (let i = 0; i < json.dlength; ++i) {
					data[i][j] = null;
				}
				break;
			default:
				throw TypeError("invalid state");
		}
		if (col_data == -1) {
			const col_bytes_length = store_type.BYTES_PER_ELEMENT * json.dlength;
			col_data = new Uint8Array(data_bytes.subarray(p, p + col_bytes_length));
			col_data = new store_type(col_data.buffer);
			p += col_bytes_length;
			for (let i = 0; i < json.dlength; ++i) {
				data[i][j] = col_data[i];
			}
		}
	}

	return { header: json.head, data: data };
}

function unpackJSONTable(json) {
	if (!json || ('header' in json) == false || ('data' in json) == false || !json.header || !json.data || json.data.length == 0) {
		return [];
	}


	const r = [];
	for (let i = 0; i < json.data.length; ++i) {
		const sr = {};
		for (let j = 0; j < json.header.length; ++j) {
			sr[json.header[j]] = json.data[i][j];
		}
		r.push(sr);
	}
	return r;
}
function packJSONTable(json, specific_keys, converters) {
	if (isJsonObject(json)) {
		json = Object.keys(json).map(k => Object.assign(json[k], { index: k }));
	}
	if (!json.length) {
		return { header: [], data: [] }
	}
	const keys = specific_keys ? specific_keys : Object.keys(json[0]);
	if (!converters)
		converters = {};

	const data = []
	for (let i = 0; i < json.length; ++i) {
		const row_obj = json[i];
		const row = [];
		for (let j = 0; j < keys.length; ++j) {
			const k = keys[j];
			row.push((k in converters ? converters[k](row_obj[k]) : row_obj[k]));
		}
		data.push(row);
	}
	return { header: keys, data: data };
}
