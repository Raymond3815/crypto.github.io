var lastMenuTrigger = 0;
function Menu(strictActivation) {
	//this._id = "menu-" + Math.trunc(Math.random() * 1e9);
	this.div = document.createElement('div');
	this.div.style.backgroundColor = 'var(--bg-color-20-transparent)';
	this.div.style.padding = '0px 0px 0px 0px';
	this.div.style.position = 'absolute';
	this.div.style.transition = 'all ease 0.1s';

	this.div.style.zIndex = 1000;

	this.subItems = [];

	this.lastTrigger = 0;

	const _this = this;
	var activated = false; // need to avoid event listener and oncontextmenu from conflicting

	this.Hide = function (evt, disregardEvt) {
		if (!disregardEvt && evt && evt.type) {
			if ((evt.type == "click" || evt.type == "contextmenu")) {
				// have now got mouse event to detect where event is triggered
				for (var i = 0; i < _this.subItems.length; i++) {
					if (_this.subItems[i].type == 'div' || _this.subItems[i].type == 'submenu') {
						var rect = _this.subItems[i].element.getBoundingClientRect();
						if (rect.left <= evt.clientX && rect.right >= evt.clientX && rect.top <= evt.clientY && rect.bottom >= evt.clientY) {
							return;
						}
					}
				}
			}
			if (evt.type == "mouseleave") {
				var rect = _this.div.getBoundingClientRect();
				//console.log({ "rect": rect, "evtX": evt.clientX, "evtY": evt.clientY});
				if (rect.left - 5 <= evt.clientX && rect.right + 5 >= evt.clientX && rect.top - 5 <= evt.clientY && rect.bottom + 5 >= evt.clientY) {
					return;
				}
			}
		}

		window.removeEventListener('click', _this.Hide);
		window.removeEventListener('blur', _this.Hide);
		window.removeEventListener('resize', _this.Hide);
		window.removeEventListener('scroll', _this.Hide);
		window.removeEventListener('contextmenu', _this.Hide);

		if (_this.div.parentNode && !activated) _this.div.parentNode.removeChild(_this.div);
		for (var i = 0; i < _this.subItems.length; i++) _this.subItems[i].element.style.backgroundColor = '';
	};
	this.Show = function (mouseEvent, positionReferenceDiv) {
		lastMenuTrigger = new Date();
		this.lastTrigger = new Date();

		activated = false;

		var appendTo = document.fullscreenElement || document.webkitFullscreenElement || document.body;
		appendTo.appendChild(_this.div);
		// Find suited position for menu margin 2px 0px 0px 2px
		if (!positionReferenceDiv) {
			if (mouseEvent.pageX + _this.div.clientWidth < document.body.clientWidth + window.scrollX)
				_this.div.style.left = Math.max(mouseEvent.pageX + 2, 0) + 'px';
			else
				_this.div.style.left = Math.max(0, mouseEvent.pageX - _this.div.clientWidth) + 'px';
			if (mouseEvent.pageY + _this.div.clientHeight < document.body.clientHeight + window.scrollY)
				_this.div.style.top = mouseEvent.pageY + 2 + 'px';
			else
				_this.div.style.top = mouseEvent.pageY - _this.div.clientHeight + 'px';
		}
		else {
			//QuickNotification("Not yet finished with submenu position and event handling", 'w');
			var positionRefRect = positionReferenceDiv.getBoundingClientRect(); // includes subtraction of scrollX and scrollY

			if (positionRefRect.right + _this.div.clientWidth < document.body.clientWidth)
				_this.div.style.left = Math.max(positionRefRect.right + window.scrollX - 0.1, 0) + 'px';
			else
				_this.div.style.left = Math.max(0, positionRefRect.left + window.scrollX + 0.1 - _this.div.clientWidth) + 'px';
			if (positionRefRect.top + _this.div.clientHeight < document.body.clientHeight)
				_this.div.style.top = positionRefRect.top + window.scrollY - 2 + 'px';
			else
				_this.div.style.top = positionRefRect.top + window.scrollY - 2 - _this.div.clientHeight + 'px';
			/*
						console.log({
							"boundRect": positionRefRect,
							"mw": menu.div.clientWidth, "mh": menu.div.clientHeight,
							'sX': window.scrollX,
							"sY": window.scrollY,
							"selfRect": menu.div.getBoundingClientRect()
						});
			*/
		}

		window.addEventListener('click', _this.Hide);
		window.addEventListener('blur', _this.Hide);
		window.addEventListener('resize', _this.Hide);
		window.addEventListener('scroll', _this.Hide);
		window.addEventListener('contextmenu', _this.Hide);
	};

	this.PreventNextActivation = function (preventThisOneOnly) {
		this.lastTrigger = new Date();
		if (preventThisOneOnly)
			return;
		lastMenuTrigger = new Date();
	}
	this.ActivationFunction = function (mouseEvent, positionReferenceDiv) {
		if ((new Date() - lastMenuTrigger) < 250)// || this != mouseEvent.target)
			return;
		lastMenuTrigger = new Date();

		if (strictActivation) {
			if (mouseEvent.target.oncontextmenu != _this.ActivationFunction) {
				let tar = mouseEvent.target.parentNode;
				while (tar.oncontextmenu != _this.ActivationFunction && !tar.oncontextmenu && tar.parentNode)
					tar = tar.parentNode;
				if (tar.oncontextmenu != _this.ActivationFunction)
					return;
			}
		}
		if (mouseEvent && mouseEvent.preventDefault)
			mouseEvent.preventDefault();
		if (activated || _this.div.parentNode) return;
		activated = true;
		window.setTimeout(_this.Show, 50, mouseEvent, positionReferenceDiv);
	}



}
Menu.prototype.privateCreateDivTemplate = function () {
	var mItem = document.createElement('div');
	mItem.style.padding = '5px 15px 5px 15px';
	mItem.style.margin = '2px 0px 2px 0px';

	mItem.style.transition = 'all ease 0.1s';
	mItem.onmouseenter = function () {
		mItem.style.backgroundColor = "var(--anti-bg-color-85-transparent)";
	};
	mItem.onmouseleave = function () {
		mItem.style.backgroundColor = "";
	};
	return mItem;
};
Menu.prototype.privateCreateListingTemplate = function (title) {
	var mItem = this.privateCreateDivTemplate();
	mItem.innerText = title;

	mItem.style.height = '30px';
	mItem.style.lineHeight = mItem.style.height;
	mItem.style.cursor = 'pointer';
	mItem.style.userSelect = 'none';
	mItem.style.textAlign = 'left';
	return mItem;
};
Menu.prototype.CreateButton = function (title, onclick) {
	this.subItems.push(
		{
			element: this.privateCreateListingTemplate(title),
			type: "button"
		}
	);
	const si = this.subItems[this.subItems.length - 1];
	si.element.onclick = onclick;
	this.div.appendChild(si.element);
	return si.element;
};
Menu.prototype.CreateSubmenu = function (title) {
	this.subItems.push({
		element: this.privateCreateListingTemplate(title),
		type: 'submenu',
		menu: new Menu()
	});
	var si = this.subItems[menu.subItems.length - 1];
	si.element.style.position = 'relative';
	si.element.style.paddingRight = '30px';

	var subMenuIndicator = document.createElement("canvas");
	si.element.appendChild(subMenuIndicator);
	subMenuIndicator.style.position = 'absolute';
	subMenuIndicator.style.right = '0px';
	subMenuIndicator.style.width = '15px';
	subMenuIndicator.style.height = '40px';
	subMenuIndicator.style.top = '0px';
	subMenuIndicator.width = parseInt(subMenuIndicator.style.width);
	subMenuIndicator.height = parseInt(subMenuIndicator.style.height);
	var smiCtx = subMenuIndicator.getContext("2d");
	smiCtx.beginPath();
	smiCtx.moveTo(4, subMenuIndicator.height * 0.3); // margin top
	smiCtx.lineTo(subMenuIndicator.width - 5, subMenuIndicator.height / 2);
	smiCtx.lineTo(4, subMenuIndicator.height * 0.7); // leave out margin
	smiCtx.stroke();



	var comEnter = si.element.onmouseenter;
	si.element.onmouseenter = function (e) {
		comEnter(e);
		si.menu.ActivationFunction(e, si.element);
	};
	var comLeave = si.element.onmouseleave;
	si.element.onmouseleave = function (e) {
		comLeave(e);
		si.menu.Hide(e);
	}
	this.div.appendChild(si.element);
	return si.menu;
};
Menu.prototype.CreateDiv = function () {
	this.subItems.push({
		element: this.privateCreateDiv(),
		type: 'div'
	});

	var si = this.subItems[menu.subItems.length - 1];

	this.div.appendChild(si.element);
	return si.element;
};
Menu.prototype.ClearMenu = function () {
	for (var i = this.subItems.length; i--;) this.div.removeChild(this.subItems[i].element);
	this.subItems = [];
};
Menu.prototype.RemoveMenuElement = function (htmlElement) {
	var index = -1;
	for (var i = 0; i < this.subItems.length; i++) {
		if (this.subItems[i].element == htmlElement) {
			index = i;
			break;
		}
	}
	if (index != -1) {
		this.div.removeChild(htmlElement);
		this.subItems.splice(index, 1);
	}
};