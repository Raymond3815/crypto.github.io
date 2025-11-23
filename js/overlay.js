var currentOverlayBody = null;
function OverlayBody(zIndex, noCloseButton, position, backgroundColor, hideOnEscape, initiallyHidden, appendTo) {
	const _this = this;
	this.private = {
		fader: document.createElement("div"),
		keyupEventListener: null,
		removeOnEscape: hideOnEscape ? false : true,
		backgroundColor: backgroundColor ? backgroundColor : "var(--dark-transparent-color)",
		lastShow: new Date()
	};
	this.body = document.createElement('div');
	this.body.addEventListener("scroll", RunViewportScan, { passive: true });
	if (!initiallyHidden)
		currentOverlayBody = this.body;
	this.removeOverlayCallback = null;

	this.private.fader.style.transition = "background-color ease 0.3s";
	this.private.fader.style.position = position ? position : 'fixed';
	this.private.fader.style.left = '0px';
	this.private.fader.style.top = '0px';
	this.private.fader.style.width = '100%';
	this.private.fader.style.height = "100%";
	this.private.fader.style.textAlign = 'center';
	this.private.fader.style.verticalAlign = 'middle';
	this.private.fader.style.zIndex = zIndex;
	(appendTo || document.fullscreenElement || document.webkitFullscreenElement || document.body).appendChild(this.private.fader);
	if (initiallyHidden)
		this.private.fader.style.display = 'none';
	else
		window.setTimeout(function () { _this.ShowOverlay(); }, 1);

	this.body.style.position = 'absolute';
	this.body.style.overflow = 'auto';
	this.body.style.maxWidth = '90%';
	this.body.style.maxHeight = '90%';
	this.body.style.top = '50%';
	this.body.style.left = '50%';
	this.body.style.padding = '15px 35px 15px 35px';
	this.body.style.transform = 'translate(-50%,-50%)';
	this.body.style.backgroundColor = document.body.style.backgroundColor ? document.body.style.backgroundColor : 'var(--bg-color-20-transparent)';
	this.private.fader.appendChild(this.body);

	this.private.closeButton = document.createElement("div");
	this.private.closeButton.style.position = 'absolute';
	this.private.closeButton.style.borderRadius = '12px';
	this.private.closeButton.style.top = '5px';
	this.private.closeButton.style.right = '5px';
	this.private.closeButton.style.width = '24px';
	this.private.closeButton.style.height = '24px';
	this.private.closeButton.style.lineHeight = this.private.closeButton.style.height;
	this.private.closeButton.style.fontSize = '20px';
	this.private.closeButton.style.padding = '0px 0px 0px 0px';
	this.private.closeButton.className = 'normalButton';
	this.private.closeButton.innerText = 'X';

	this.private.closeButton.style.transition = 'ease color 0.5s';
	this.private.closeButton.onmouseleave = function () { this.style.color = ''; };
	this.private.closeButton.onmouseenter = function () { this.style.color = 'red'; };
	AddToolTip(this.private.closeButton, "Close overlay (esc)");

	if (!noCloseButton)
		this.body.appendChild(this.private.closeButton);

	this.private.closeButton.onclick = function () {
		_this.private.removeOnEscape ? _this.RemoveOverlay() : _this.HideOverlay();
	};

	this.private.keyupEventListener = function (evt) {
		if (evt.keyCode == 27 || evt.code == "Escape" || evt.key == "Escape")
			_this.private.removeOnEscape ? _this.RemoveOverlay() : _this.HideOverlay();
	};

	window.addEventListener("keyup", this.private.keyupEventListener);
	this.private.fader.onclick = function (evt) {
		if (evt.target == _this.private.fader && new Date() - _this.private.lastShow > 100)
			_this.private.removeOnEscape ? _this.RemoveOverlay() : _this.HideOverlay();
	};

}
OverlayBody.prototype.ShowOverlay = function () {
	if (!this.private.fader.parentNode)
		return;
	currentOverlayBody = this.body;
	this.private.lastShow = new Date();
	this.body.style.display = '';
	this.private.fader.style.display = '';
	const _this = this;
	window.setTimeout(function () {
		_this.private.fader.style.backgroundColor = _this.private.backgroundColor;
	}, 1); // JS in single-threaded so this will run after whatever was running
	window.setTimeout(RunViewportScan, 100);
};
OverlayBody.prototype.HideOverlay = function () {
	currentOverlayBody = null;
	this.body.style.display = 'none';
	this.private.fader.style.backgroundColor = '';
	const _this = this;
	window.setTimeout(function () {
		_this.private.fader.style.display = 'none';
	}, 300);
}
OverlayBody.prototype.RemoveOverlay = function () {
	currentOverlayBody = null;
	window.removeEventListener("keyup", this.private.keyupEventListener);
	RemoveElement(this.body);
	this.private.fader.style.backgroundColor = '';
	const _this = this;
	window.setTimeout(function () {
		if (_this.private.fader.parentNode)
			RemoveElement(_this.private.fader);
	}, 300);
	if (this.removeOverlayCallback)
		this.removeOverlayCallback();
};

function CloseAllOverlays() {
	window.dispatchEvent(new KeyboardEvent('keyup', { keyCode: 27 }));
};
