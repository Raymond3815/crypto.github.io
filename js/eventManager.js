
// Event management
const BaseEventListing = (function () {
	var lock_id_seq = 0;
	return function (use_bitset_events) {
		++lock_id_seq;
		Object.defineProperty(this, '_lock_id', { value: lock_id_seq, writable: false });
		Object.defineProperty(this, '_use_bitset_event_rule', { value: (use_bitset_events ? true : false), writable: false });
		this._events_disabled = false;
	};
})();

(function () {
	const obj_locks = new Map(); // _lock_id: count of lock being locked on access attempt
	const obj_ev_listeners = new Map(); // _lock_id: array of listeners

	BaseEventListing.prototype.lockResource = async function (no_async) {
		if (no_async) {
			return this.lockResourceSync();
		}

		// console.trace("lock");
		while (obj_locks.has(this._lock_id)) {
			const count = obj_locks.get(this._lock_id);
			obj_locks.set(this._lock_id, count + 1);
			if (count < 10e2) { // 10s
				await new Promise((s, e) => window.setTimeout(() => s(), 10));
			}
			else {
				console.warn("Broke lock on _lock_id:", this._lock_id, this);
				console.trace();
				obj_locks.set(this._lock_id, 0);
				return false;
			}
		}
		obj_locks.set(this._lock_id, 0);
		return true;
	};
	BaseEventListing.prototype.lockResourceSync = function () {
		// console.trace("lock");
		while (obj_locks.has(this._lock_id)) {
			const count = obj_locks.get(this._lock_id);
			obj_locks.set(this._lock_id, count + 1);
			if (count < 10e2) { // 10s
				const st = new Date().getTime();
				while (new Date().getTime() - st < 10);
			}
			else {
				console.warn("Broke lock on _lock_id:", this._lock_id, this);
				console.trace();
				obj_locks.set(this._lock_id, 0);
				return false;
			}
		}
		obj_locks.set(this._lock_id, 0);
		return true;
	};
	BaseEventListing.prototype.releaseResource = function () {
		// console.trace("release");
		obj_locks.delete(this._lock_id);
	};
	BaseEventListing.prototype.lockAndReleaseResource = async function (no_async) {
		const r = no_async ? this.lockResourceSync() : await this.lockResource();
		this.releaseResource();
		return r;
	};
	BaseEventListing.prototype.lockAndReleaseResourceSync = function () {
		const r = this.lockResourceSync();
		this.releaseResource();
		return r;
	};
	BaseEventListing.prototype.isLocked = function () {
		return obj_locks.has(this._lock_id);
	};

	Object.defineProperty(BaseEventListing.prototype, 'EVENT_UNKNOWN', { get: () => 0, set: () => { throw TypeError("can't override this"); } });
	Object.defineProperty(BaseEventListing.prototype, 'EVENT_ANY', { get: () => -1, set: () => { throw TypeError("can't override this"); } });

	Object.defineProperty(BaseEventListing.prototype, 'EVENT_SCOPE_NONE', { get: () => 0, set: () => { throw TypeError("can't override this"); } });
	Object.defineProperty(BaseEventListing.prototype, 'EVENT_SCOPE_ALL', { get: () => -1, set: () => { throw TypeError("can't override this"); } });


	let listener_seq = 0;
	BaseEventListing.prototype.addEventListener = function (type, callback, once, always_trigger, scope) {
		if (typeof (callback) != 'function') {
			throw TypeError("invalid callback type, isn't function");
		}
		once = once ? true : false;
		always_trigger = always_trigger ? true : false;
		scope = typeof (scope) == 'number' ? scope : this.EVENT_SCOPE_NONE;

		if (!obj_ev_listeners.has(this._lock_id)) {
			obj_ev_listeners.set(this._lock_id, []);
		}
		const listeners = obj_ev_listeners.get(this._lock_id);

		if (this._use_bitset_event_rule) {
			const li = listeners.length;
			for (var i = 0; i < li; ++i) {
				const listener = listeners[i]; // reference
				if (listener.callback == callback && listener.once == once && listener.always_trigger == always_trigger && listener.scope == scope) {
					listener.type |= type;
					return;
				}
			}
		}

		listeners.push({
			type: type, callback: callback, once: once, always_trigger: always_trigger,
			scope: scope, id: ++listener_seq
		});
		return;
	};
	BaseEventListing.prototype.removeEventListener = function (callback, type) // type can be false-type
	{
		const listeners = obj_ev_listeners.get(this._lock_id);
		if (!listeners) {
			return 0;
		}

		var remove_count = 0;
		for (let i = listeners.length; --i > -1;) {
			const listener = listeners[i];
			if (listener.callback == callback && (!type || this.triggersListener(type, listener.type))) {
				if (this._use_bitset_event_rule && type && listener.type & (~type)) {
					listener.type &= ~type;
				}
				else {
					listeners.splice(i, 1);
				}
				++remove_count;
			}
		}

		if (listeners.length == 0) {
			obj_ev_listeners.delete(this._lock_id);
		}
		return remove_count;
	};

	BaseEventListing.prototype.triggersScope = function (scope, listener_scope) {
		if (this._use_bitset_event_rule) {
			return (scope & listener_scope) != 0;
		}
		return listener_scope != this.EVENT_SCOPE_NONE && listener_scope > scope;
	};
	BaseEventListing.prototype.removeEventScope = function (scope) {
		if (typeof (scope) != 'number') {
			scope = this.EVENT_SCOPE_ALL;
		}
		if (scope == this.EVENT_SCOPE_NONE) {
			throw TypeError("can't remove events without scope");
		}

		const listeners = obj_ev_listeners.get(this._lock_id);
		if (!listeners) {
			return 0;
		}

		let remove_count = 0;
		for (let i = listeners.length; --i >= 0;) {
			const listener = listeners[i];
			if (triggersScope(scope, listener.scope)) {
				listeners.splice(i, 1);
				++remove_count;
			}
		}
		if (listeners.length == 0) {
			obj_ev_listeners.delete(this._lock_id);
		}
		return remove_count;
	};

	BaseEventListing.prototype.triggersListener = function (type, listener_type) {
		if (this._use_bitset_event_rule) {
			return (listener_type & type) == type;
		}
		return listener_type == type || listener_type == this.EVENT_ANY;
	};
	BaseEventListing.prototype.dispatchEvent = function (type, ...args) {
		if (!obj_ev_listeners.has(this._lock_id)) {
			return;
		}
		// since removal is an option during dispatching		
		const listeners = new Array(...obj_ev_listeners.get(this._lock_id)); // copy 

		for (var i = 0; i < listeners.length; ++i) {
			const listener = listeners[i]; // reference
			if (!this.triggersListener(type, listener.type))
				continue;
			if (this._events_disabled && !listener.always_trigger)
				continue;
			try {
				listener.callback.call(this, type, ...args);
			} catch (e) {
				console.trace(e);
			}
			if (listener.once) {
				this.removeEventListener(listener.callback);
			}
		}
	};

	BaseEventListing.prototype.disableEvents = function (timeout) {
		this._events_disabled = true;
		if (timeout) {
			window.setTimeout(() => this._events_disabled = false, timeout);
		}
	};
	BaseEventListing.prototype.enableEvents = function () {
		this._events_disabled = false;
	};

	BaseEventListing.prototype.countEventListeners = function(){
		const listeners = obj_ev_listeners.get(this._lock_id);
		if (!listeners) {
			return 0;
		}		
		return listeners.length;				
	};

	BaseEventListing.prototype.spliceEventListeners = function (idx, delete_count){
		const listeners = obj_ev_listeners.get(this._lock_id);
		if (!listeners) {
			return 0;
		}
		return listeners.splice(idx, delete_count).length;
	};

	BaseEventListing.prototype.clearEventListeners = function(){
		return this.spliceEventListeners(0, this.countEventListeners());
	};

})();

const inheritFromObjectPrototype = function (obj, prefix) {
	const keys = Object.keys(obj.prototype);
	for (let i = 0; i < keys.length; ++i) {
		if (keys[i].substr(0, prefix.length) == prefix) {
			this.__proto__[keys[i]] = obj.prototype[keys[i]];
		}
	}
};
function inheritBaseEventListening(obj) { // needs to be complimented by calling constructor
	inheritFromObjectPrototype(obj, "EVENT_");

	obj.prototype = Object.create(BaseEventListing.prototype);
	obj.prototype.constructor = obj;
}


// WebAssembly and additional core events
(function () {
	const WindowEventManager = function () {
		// inherit
		BaseEventListing.call(this, true);

		const obj = this;
		window.onbeforeunload = function () {
			var prevent_unload = false;
			const evt = { type: 'beforeunload', preventDefault: () => { prevent_unload = true } };
			obj.dispatchEvent(obj.EVENT_BEFORE_UNLOAD, evt);
			if (prevent_unload) {
				return "string";
			}
		};
		window.onunload = function () { obj.dispatchEvent(obj.EVENT_UNLOAD); };
		window.addEventListener('load', function () { obj.dispatchEvent(obj.EVENT_WINDOW_LOADED); }, { once: true });
		document.onfullscreenchange = function () {
			if (document.fullscreenElement) {
				obj.dispatchEvent(obj.EVENT_ENTER_FULLSCREEN, document.fullscreenElement);
			}
			else {
				obj.dispatchEvent(obj.EVENT_LEAVE_FULLSCREEN, null);
			}
		};

		window.addEventListener('resize', () => obj.dispatchEvent(obj.EVENT_RESIZE), { passive: true });

		this.module_is_loaded = false;
		this.addEventListener(this.EVENT_MODULE_LOADED, () => { Object.defineProperty(this, 'module_is_loaded', { get: () => true }); }, true);
		this.window_is_loaded = false;
		this.addEventListener(this.EVENT_WINDOW_LOADED, () => { Object.defineProperty(this, 'window_is_loaded', { get: () => true }); }, true);

		if (navigator.serviceWorker){
			navigator.serviceWorker.addEventListener("message",(evt)=>{obj.dispatchEvent(obj.EVENT_SW_MESSAGE, evt.data); });
		}

	};
	inheritBaseEventListening(WindowEventManager);
	WindowEventManager.prototype.EVENT_BEFORE_UNLOAD = 1 << 0;
	WindowEventManager.prototype.EVENT_UNLOAD = 1 << 1;
	WindowEventManager.prototype.EVENT_MODULE_LOADED = 1 << 2;
	WindowEventManager.prototype.EVENT_WINDOW_LOADED = 1 << 3;
	WindowEventManager.prototype.EVENT_ENTER_FULLSCREEN = 1 << 4;
	WindowEventManager.prototype.EVENT_LEAVE_FULLSCREEN = 1 << 5;
	WindowEventManager.prototype.EVENT_RESIZE = 1 << 6;
	WindowEventManager.prototype.EVENT_SW_MESSAGE = 1 << 7;



	WindowEventManager.prototype.windowLoadedAwaitable = async function () {
		if (this.window_is_loaded) {
			return true;
		}
		await new Promise((s, e) => this.addEventListener(this.EVENT_WINDOW_LOADED, s, true, true));
		return true;
	};
	WindowEventManager.prototype.callWhenWindowLoaded = async function (callback, ...args) {
		await this.windowLoadedAwaitable();
		return callback(...args);
	};

	WindowEventManager.prototype.moduleLoadedAwaitable = async function () {
		if (this.module_is_loaded) {
			return true;
		}
		await new Promise((s, e) => this.addEventListener(this.EVENT_MODULE_LOADED, s, true, true));
		return true;
	};
	WindowEventManager.prototype.callWhenModuleLoaded = async function (callback, ...args) {
		await this.moduleLoadedAwaitable();
		return callback(...args);
	};



	Object.defineProperty(window, 'window_event_manager', { value: new WindowEventManager(), writable: false });
	Object.defineProperty(window, 'Module', {
		writable: false, value: {
			onRuntimeInitialized: function () {
				window_event_manager.dispatchEvent(window_event_manager.EVENT_MODULE_LOADED);
			}
		}
	});



	window_event_manager.addEventListener(window_event_manager.EVENT_WINDOW_LOADED, () => {
		// resize all icons on mobile
		if (IsMobile()) {
			const banner = document.getElementById('pageBanner');
			const icon_bar = banner.children[1];
			const new_height = Math.trunc(parseInt(icon_bar.clientHeight) * 1.3);
			banner.style.height = (parseInt(banner.clientHeight) + Math.trunc(icon_bar.clientHeight * 0.3)) + 'px';
			icon_bar.style.height = new_height + 'px';
			for (let c of icon_bar.children) {
				c.style.height = new_height + 'px';
			}

			const bannerUserIcon = document.getElementById('bannerUserIcon');
			bannerUserIcon.firstChild.setAttribute('height', new_height);
			bannerUserIcon.firstChild.setAttribute('width', new_height);

		}
	});

})();
