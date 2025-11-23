// Whole-script strict mode syntax
// 'use strict';


function NotificationMessage(message)
{
    this.messageDiv = document.createElement('div');
    this.height = 40; // px
	this.width = 80; //%
	this.color = "white";
	this.backgroundColor = 'rgba(50,50,50,0.9)'
	this.removeOnHover = true;

	this.messageDiv.style.position = 'fixed';
	this.messageDiv.style.left = "50%";
	this.messageDiv.style.textAlign="center";
	this.messageDiv.style.padding = "5px 10px 7px 10px";
	this.messageDiv.style.zIndex = 100;

	this.messageDiv.innerHTML = message;

    this.displayTime = 10000;
    this.displayAfterHover = 1000;
}
NotificationMessage.prototype.Execute = function()
{
    this.messageDiv.className = "notification_div";
	this.messageDiv.style.height = this.height + "px";
	this.messageDiv.style.width = this.width + "%";
	this.messageDiv.style.lineHeight = this.messageDiv.style.height;
	this.messageDiv.style.marginLeft = -this.width/2 + "%";

	this.messageDiv.style.color = this.color;
	this.messageDiv.style.backgroundColor = this.backgroundColor;

	var others = document.getElementsByClassName(this.messageDiv.className);
	var heightOffset = 50; //px
	for (var i=0; i < others.length; i++)
	{
		heightOffset += parseInt(others[i].style.height) + parseInt(others[i].style.paddingBottom) + parseInt(others[i].style.paddingTop) + 15;
	}

	this.messageDiv.style.top = "-100%";
	this.messageDiv.style.transition = "1.5s ease";

    const appendTo = document.fullscreenElement || document.webkitFullscreenElement || document.body;
    if (!appendTo)
    {
        const _this = this;
        window.setTimeout(function(){_this.Execute();}, 10);
    }
    appendTo.appendChild(this.messageDiv);


    const _this = this;

	setTimeout(function(){_this.messageDiv.style.top = heightOffset + 'px';},10);

    var t1 = setTimeout(function () { _this.messageDiv.style.opacity = "0"; }, _this.displayTime);
    var t2 = setTimeout(function () { if (_this.messageDiv.parentNode) appendTo.removeChild(_this.messageDiv); }, (_this.displayTime + 1500));

	if (this.removeOnHover)
	{
		function EarlyRemoval()
        {
            _this.messageDiv.onmouseover = null;
			clearTimeout(t1);clearTimeout(t2);
            t1 = setTimeout(function () { _this.messageDiv.style.opacity = "0"; }, _this.displayAfterHover);
            t2 = setTimeout(function () { if (_this.messageDiv.parentNode) appendTo.removeChild(_this.messageDiv); }, (_this.displayAfterHover + 1500));

        }
        this.messageDiv.onmouseover = EarlyRemoval;

	}
};

function QuickNotification(message, type) {
    if (type && typeof (type) == "string") type = type.toLowerCase();
    
    var not = new NotificationMessage(message);
    
    switch (type) {
        case "error":
        case "erro":
        case "e":
            not.backgroundColor = "rgba(255,30,30,0.9)";
            not.color = 'white';
            break;
        case "warn":
        case "warning":
        case "w":
            not.backgroundColor = "rgba(255,165,0,0.9)";
            not.color = "white";
            break;
        default:
            break;
    }

    window.setTimeout(()=>{not.Execute();}, 1);
    return not;
}
