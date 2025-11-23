function Canvas2DChart(parentDiv)
{
	const _this = this;	

	const chartDiv = document.createElement('div');
	chartDiv.style.height = '100%';
	chartDiv.style.width = '100%';
	chartDiv.style.position = 'relative';	
	parentDiv.appendChild(chartDiv);

	const canvas = document.createElement("canvas"); // Actual canvas to draw onto
	canvas.style.left = '0px';
	canvas.style.width = '100%';
	canvas.style.height = '100%';
	canvas.style.position = 'absolute';
	chartDiv.appendChild(canvas);

	this.private = {
		chartDiv: chartDiv,

		dataLength: 0,
		setLength: 0,
		sets:{},
		typeStructure: new Uint8Array(2), // used in drawing of chart and validating new data
		lastChange: new Date(),
		minNumber: [null, null],
		maxNumber: [null, null],		
		
		xlabel: null,
		ylabel: null,
		
		legend: null,
		explorer: 0,
		explorerCallback: [],

		majorTicks: [true, true],
		minorTicks: [false, false],

		viewLim: [[null, null], [null, null]],

		ctx: canvas.getContext('2d'),
		
		innerCanvas: canvas.cloneNode(),		
		lastDisplayPosition: new Uint16Array(2),
		
		chartType: 1, // default type
		binWidthScale: 0.8,
		movingAverageCount: 7,
		lastDraw:{
			min: new Float64Array(2),
			max: new Float64Array(2),
			range: new Float64Array(2),
			accuracy: new Float64Array(2),
			stepSize: new Float64Array(2),
			scalingFactor: new Float64Array(2),
			preferedPixelSpacing: new Uint16Array(2),

			drawRect: new Uint16Array(4) // relates to actual plot space left, top, width, height
		},

		themeColor:{}
	};
	const SetActiveTheme = function(){
		switch(GetDocumentTheme())
		{
			case 'night':
			case 'dark':
				_this.SetNightTheme();
				break;
			default:
				_this.SetNormalTheme();
				break;
		}
	};
	SetActiveTheme();

	this.private.innerCtx = this.private.innerCanvas.getContext('2d');
	this.mouseOver = false;

	chartDiv.appendChild(this.private.innerCanvas);
	this.private.ctx.imageSmoothingEnabled = true;

	// Chart interaction	
	this.private.innerCanvas.oncontextmenu = function(evt)
	{
		QuickNotification("Menu has not been implemented yet");
		evt.preventDefault();
		console.log(_this);
	};

	// Clear interactions
	this.private.lastDisplayPosition[0] = -1;
	this.private.lastDisplayPosition[1] = -1;

	this.private.innerCanvas.addEventListener('mouseleave', function(evt)
	{
		_this.mouseOver = false;
		_this.private.lastDisplayPosition[0] = -1;
		_this.private.lastDisplayPosition[1] = -1;
		_this.private.innerCtx.clearRect(0, 0, _this.private.innerCanvas.width, _this.private.innerCanvas.height);
	}, {passive: true});
	this.private.innerCanvas.addEventListener('mouseenter', function(){
		_this.mouseOver = true;
	}, {passive: true});

	
	this.private.innerCanvas.addEventListener('mousedown', function(){
		if (_this.private.explorer && !this.style.cursor)
			this.style.cursor = 'grab';
	}, {passive: true});
	this.private.innerCanvas.addEventListener('mousemove', function(evt){
		const domRect = this.getBoundingClientRect();
		_this.PanOrDisplayInteraction(
			evt.clientX - domRect.left,
			evt.clientY - domRect.top,
			evt.buttons, evt.movementX, evt.movementY,
			4
		);
	}, {passive: true});
	this.private.innerCanvas.addEventListener('wheel', function(evt){
		const domRect = this.getBoundingClientRect();
		if (_this.ZoomInteraction(
			evt.clientX - domRect.left,
			evt.clientY - domRect.top,
			evt.deltaY / 4
		))
			evt.preventDefault();
		if (evt.deltaMode != 0)
			console.warn("Strange unit for deltaY on mouse event");
	}, {passive: false});


	const touchTracker = {};
	this.private.innerCanvas.addEventListener("touchstart", function(evt){
		const domRect = this.getBoundingClientRect();
		for (var i=0, li = evt.touches.length; i < li; i++)
		{
			const x = evt.touches[i].clientX - domRect.left;
			const y = evt.touches[i].clientY - domRect.top;
			touchTracker[evt.touches[i].identifier] = {
				xp:x, yp:y,
				x0:x,y0:y,t0:evt.timeStamp,
				x:x,y:y,t:evt.timeStamp
			};
			_this.PanOrDisplayInteraction(x,y, false, 0, 0, 8);
		}
	}, {passive: true});
	this.private.innerCanvas.addEventListener("touchend", function(evt){
		for (var i = 0, li = evt.changedTouches.length; i < li; i++)
		{
			delete touchTracker[evt.changedTouches[i].identifier];
		}
	}, {passive: true});

	this.private.innerCanvas.addEventListener("touchmove", function(evt){
		const ids = Object.keys(touchTracker);
		const numberOfTouches = ids.length;
		if (numberOfTouches > 2)
			return;
		
		const domRect = this.getBoundingClientRect();
		for (var i = 0, li = evt.changedTouches.length; i < li; i++)
		{
			const touch = touchTracker[evt.changedTouches[i].identifier];
			touch.xp = touch.x;
			touch.yp = touch.y;
			touch.x = evt.changedTouches[i].clientX - domRect.left;
			touch.y = evt.changedTouches[i].clientY - domRect.top;
			touch.t = evt.timeStamp;

			if (numberOfTouches == 1)
			{
				if (_this.PanOrDisplayInteraction(
					touch.x, touch.y, 
					touch.t - touch.t0 > 50,
					touch.x - touch.xp, touch.y - touch.yp,
					8
				))
					evt.preventDefault();
			}
		}

		if (numberOfTouches == 2)
		{
			const pinchDistP = Math.sqrt(Math.pow(touchTracker[ids[0]].xp - touchTracker[ids[1]].xp, 2) + Math.pow(touchTracker[ids[0]].yp - touchTracker[ids[1]].yp, 2));
			const pinchDist = Math.sqrt(Math.pow(touchTracker[ids[0]].x - touchTracker[ids[1]].x, 2) + Math.pow(touchTracker[ids[0]].y - touchTracker[ids[1]].y, 2));
			
			const x = (touchTracker[ids[0]].x0 + touchTracker[ids[1]].x0)/2;
			const y = (touchTracker[ids[0]].y0 + touchTracker[ids[1]].y0)/2;
			if (_this.ZoomInteraction(x,y, (pinchDistP - pinchDist) * 2 ))
				evt.preventDefault();
			return;
		}

	}, {passive: false});

	const ResizeFunc = function(){
		if (parentDiv && parentDiv.parentNode)
		{
			_this.DrawChart();
			_this.private.innerCtx.clearRect(0, 0, _this.private.innerCanvas.width, _this.private.innerCanvas.height);
		}
		else window.removeEventListener('resize', ResizeFunc, {passive: true});
	};
	window.addEventListener('resize', ResizeFunc, {passive: true});

	const themeCallback = function(theme){
		if (!parentDiv || !parentDiv.parentNode)
		{
			RemoveThemeEventListener(themeCallback);
			return;
		}
		SetActiveTheme();
		_this.DrawChart();		
	};
	AddThemeEventListener(themeCallback);


}
// Enum type
Canvas2DChart.prototype.NUMBER = 0;
Canvas2DChart.prototype.STRING = 1;
Canvas2DChart.prototype.DATETIME = 2;

// Enum chart type (bitset)
Canvas2DChart.prototype.LINE_CHART = 1;
Canvas2DChart.prototype.LINE_CHART_NO_POINT = 2
Canvas2DChart.prototype.DOT_CHART = 4;
Canvas2DChart.prototype.COLUMN_CHART = 8;
Canvas2DChart.prototype.BAR_CHART = 16;
Canvas2DChart.prototype.COLUMN_WL_CHART = 32 + 8; // column chart with moving average line (can handle sparse data)
Canvas2DChart.prototype.WL_LINE = 64; // moving average requires non-sparse data
Canvas2DChart.prototype.PIE_CHART = 128;

// Enum direction (bitset)
Canvas2DChart.prototype.XDIRECTION = 1;
Canvas2DChart.prototype.YDIRECTION = 2;
Canvas2DChart.prototype.XYDIRECTION = 3;

Canvas2DChart.prototype.DEFAULT_COLORING = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];
Canvas2DChart.prototype.DEFAULT_SIZE = 1;
Canvas2DChart.prototype.PIE_CHART_MARGIN = 10; // px
Canvas2DChart.prototype.PIE_CHART_WIDTH = 45; // px
Canvas2DChart.prototype.PIE_CHART_LEGEND_MAX_WIDTH = 80; // px

Canvas2DChart.prototype.CreateSet = function(label)
{
	if (this.private.sets[label])
	{
		console.warn("Current set already is set within this data table");
		return false;
	}
	this.private.sets[label] = {
		numberValue:[],
		actualValue:[],
		length:0,
		
		ctxCoordinates:[], // Only created on draws
		color: this.DEFAULT_COLORING[this.private.setLength % this.DEFAULT_COLORING.length],
		size: this.DEFAULT_SIZE,
		style: [],
		hidden: false
	};
	this.private.setLength ++;
	return true;
};

Canvas2DChart.prototype.AppendData = function(setLabel, values, index)
{
	const set = this.private.sets[setLabel]; // reference
	if (!set)
	{
		console.warn("Invalid set label");
		return false;
	}
	
	if (!this.private.dataLength)
	{
		for (var i = 0; i < 2; i++)
		{
			switch (typeof(values[i])) {
				case 'number':
					this.private.typeStructure[i] = this.NUMBER;
					break;
				case 'string':
					this.private.typeStructure[i] = this.STRING;
					break;
				case 'object':
					this.private.typeStructure[i] = this.DATETIME;
					break;
				default:
					console.warn("Unsupported data type");
					return false;
			}
		}
	}
	
	var numValues = new Float64Array(2);
	for (var i = 0; i < 2; i++)
	{
		switch (typeof(values[i])) {
			case 'number':
				if (this.private.typeStructure[i] != this.NUMBER)
				{
					console.warn("Invalid structure, doesn't align with other rows in data table");
					return false;
				}
				numValues[i] = values[i];						
				break;
			case 'string': // discrete
				if (this.private.typeStructure[i] != this.STRING)
				{
					console.warn("Invalid structure, doesn't align with other rows in data table");
					return false;
				}
				numValues[i] = this.private.sets[setLabel].length;
				break;
			case 'object': // datetime
				if (this.private.typeStructure[i] != this.DATETIME)
				{
					console.warn("Invalid structure, doesn't align with other rows in data table");
					return false;
				}
				numValues[i] = values[i].getTime();
				break;
			default:
				console.warn("Invalid type of value supplied");
				return false;
		}
	}

	if (index == null || index == this.private.sets[setLabel].length)
	{
		this.private.sets[setLabel].actualValue.push(values);
		this.private.sets[setLabel].numberValue.push(numValues);
	}
	else
	{
		this.private.sets[setLabel].actualValue.splice(index, 0, values);
		this.private.sets[setLabel].numberValue.splice(index, 0, numValues);
	}
	this.private.sets[setLabel].length++;
	this.private.dataLength++;

	for (var i = 0; i < 2; i++)
	{
		if (this.private.minNumber[i] == null || this.private.minNumber[i] > numValues[i]) this.private.minNumber[i] = numValues[i];
		if (this.private.maxNumber[i] == null || this.private.maxNumber[i] < numValues[i]) this.private.maxNumber[i] = numValues[i];
	}

	this.private.lastChange = new Date();
	return true;
};
Canvas2DChart.prototype.AppendDataArray = function(setLabel, valuesArr, atBegin)
{
	if (!this.private.sets[setLabel])
	{
		console.warn("Invalid set label");
		return false;
	}
	if (valuesArr.length == 0)
		return true;
	
	if (!this.private.dataLength)
	{
		if (valuesArr[0].length != 2)
		{
			console.warn("Not a 2D data entry");
			return false;
		}
		this.private.typeStructure = new Uint8Array(2);
		for (var i = 0; i < 2; i++)
		{
			switch(typeof(valuesArr[0][i]))
			{
				case 'number':
					this.private.typeStructure[i] = this.NUMBER;
					break;
				case 'string':
					this.private.typeStructure[i] = this.STRING;
					break;
				case 'object':
					this.private.typeStructure[i] = this.DATETIME;
					break;
				default:
					console.warn("Invalid type of value supplied");
					return false;
			}
		}
	}


	var actualValue = [];
	var numberValue = [];
	for (var j = 0, lj = valuesArr.length; j < lj; j++)
	{
		if (valuesArr[j].length != 2)
		{
			console.warn("Not a 2D data entry");
			return false;
		}


		actualValue.push(valuesArr[j]);
		numberValue.push(new Float64Array(2));

		for (var i = 0; i < 2; i++)
		{
			switch(typeof(valuesArr[j][i]))
			{
				case 'number':
					if (this.private.typeStructure[i] != this.NUMBER)
					{
						console.warn("Invalid data type ", j, i);
						return false;
					}
					numberValue[j][i] = valuesArr[j][i];
					break;
				case 'string':
					if (this.private.typeStructure[i] != this.STRING)
					{
						console.warn("Invalid data type ", j, i);
						return false;
					}
					numberValue[j][i] = j;
					break;
				case 'object':
					if (this.private.typeStructure[i] != this.DATETIME)
					{
						console.warn("Invalid data type ", j, i);
						return false;
					}
					numberValue[j][i] = valuesArr[j][i].getTime();
					break;
				default:
					console.warn("Invalid type of value supplied", j , i);
					return false;
			}

			if (this.private.minNumber[i] == null || this.private.minNumber[i] > numberValue[j][i]) this.private.minNumber[i] = numberValue[j][i];
			if (this.private.maxNumber[i] == null || this.private.maxNumber[i] < numberValue[j][i]) this.private.maxNumber[i] = numberValue[j][i];
		}
	}

	if (atBegin)
	{
		this.private.sets[setLabel].numberValue = numberValue.concat(this.private.sets[setLabel].numberValue);
		this.private.sets[setLabel].actualValue = actualValue.concat(this.private.sets[setLabel].actualValue);
	}
	else
	{
		this.private.sets[setLabel].numberValue = this.private.sets[setLabel].numberValue.concat(numberValue);
		this.private.sets[setLabel].actualValue = this.private.sets[setLabel].actualValue.concat(actualValue);
	}

	this.private.sets[setLabel].length += numberValue.length;
	this.private.dataLength += numberValue.length;

	this.private.lastChange = new Date();
	return true;
};

Canvas2DChart.prototype.RemoveSet = function(setLabel){
	if (this.private.sets[setLabel])
	{
		this.private.dataLength -= this.private.sets[setLabel].length;
		delete this.private.sets[setLabel];
	}
	else return true;
	
	this.private.minNumber = [null, null];
	this.private.maxNumber = [null, null];
	for (var iLabel  in this.private.sets)
	{
		const x = this.private.sets[iLabel].numberValue.map(function(v){ return v[0]; });
		const y = this.private.sets[iLabel].numberValue.map(function(v){ return v[1]; });
		const xMin = Math.min.apply(null, x);
		const yMin = Math.min.apply(null, y);
		const xMax = Math.max.apply(null, x);
		const yMax = Math.max.apply(null, y);

		if (this.private.minNumber[0] == null || this.private.minNumber[0] > xMin) this.private.minNumber[0] = xMin;
		if (this.private.minNumber[1] == null || this.private.minNumber[1] > yMin) this.private.minNumber[1] = yMin;
		if (this.private.maxNumber[0] == null || this.private.maxNumber[0] < xMax) this.private.maxNumber[0] = xMax;
		if (this.private.maxNumber[1] == null || this.private.maxNumber[1] < yMax) this.private.maxNumber[1] = yMax;
	}

	this.private.setLength--;
	this.private.lastChange = new Date();
	return true;
};
Canvas2DChart.prototype.RemoveData = function(setLabel, index, length)
{
	if (!this.private.sets[setLabel])
	{
		console.warn("No such set was defined in data table");
		return false;
	}

	if (!length) length=1;
	if (index < 1) index = this.private.sets[setLabel].length - index;

	if (index + length > this.private.sets[setLabel].length)
	{
		console.warn('Out of range, index provided is too large');
		return false;
	}

	this.private.sets[setLabel].numberValue.splice(index, length);
	this.private.sets[setLabel].actualValue.splice(index, length);
	
	this.private.sets[setLabel].length -= length;
	this.private.dataLength -= length;

	this.private.minNumber = [null, null];
	this.private.maxNumber = [null, null];
	if (this.private.sets[setLabel].length)
	{
		for (const iLabel  in this.private.sets)
		{
			const x = this.private.sets[iLabel].numberValue.map(function(v){ return v[0]; });
			const y = this.private.sets[iLabel].numberValue.map(function(v){ return v[1]; });

			const xMin = Math.min.apply(null, x);
			const yMin = Math.min.apply(null, y);
			const xMax = Math.max.apply(null, x);
			const yMax = Math.max.apply(null, y);

			if (this.private.minNumber[0] == null || this.private.minNumber[0] > xMin) this.private.minNumber[0] = xMin;
			if (this.private.minNumber[1] == null || this.private.minNumber[1] > yMin) this.private.minNumber[1] = yMin;
			if (this.private.maxNumber[0] == null || this.private.maxNumber[0] < xMax) this.private.maxNumber[0] = xMax;
			if (this.private.maxNumber[1] == null || this.private.maxNumber[1] < yMax) this.private.maxNumber[1] = yMax;
		}
	}

	this.private.lastChange = new Date();
	return true;
};

Canvas2DChart.prototype.SetColor = function(setLabel, color)
{
	if (!this.private.sets[setLabel])
		return false;
	
	this.private.sets[setLabel].color = color;
	return true;
};
Canvas2DChart.prototype.SetSize = function(setLabel, size)
{
	if (!this.private.sets[setLabel])
		return false;
	
	this.private.sets[setLabel].size = size;
	return true;
};
Canvas2DChart.prototype.SetBinWidthScale = function(newScale)
{
	this.private.binWidthScale = newScale ? newScale : 0.85;
};
Canvas2DChart.prototype.SetStyle = function(setLabel, style)
{
	if (!this.private.sets[setLabel])
		return false;
	
	this.private.sets[setLabel].style = style;
	return true;
};
Canvas2DChart.prototype.Hide = function(setLabel)
{
	if (!this.private.sets[setLabel])
		return false;
	
	this.private.sets[setLabel].hidden = true;
	return true;
};
Canvas2DChart.prototype.Unhide = function(setLabel)
{
	if (!this.private.sets[setLabel])
		return false;
	
	this.private.sets[setLabel].hidden = false;
	return true;
};

Canvas2DChart.prototype.SetLabel = function(x, y)
{
	this.private.xlabel = x;
	this.private.ylabel = y;
};

Canvas2DChart.prototype.ShowLegend = function(onTop)
{
	this.private.legend = onTop ? true : false;
};

Canvas2DChart.prototype.EnableExploration = function(directionType)
{
	this.private.explorer |= directionType;
};
Canvas2DChart.prototype.DisableExploration = function(directionType)
{
	this.private.explorer &= ~directionType;
};
Canvas2DChart.prototype.AddExplorerListener = function(callback)
{
	this.private.explorerCallback.push(callback);
};
Canvas2DChart.prototype.RemoveExplorerListener = function(callback)
{
	for (var i=0, li = this.private.explorerCallback.length; i < li; i++)
	{
		if (this.private.explorerCallback[i] == callback)
		{
			this.private.explorerCallback.splice(i, 1);
			break;
		}
	}	
};

Canvas2DChart.prototype.SetMajorTicks = function(ticksOrBoolX, ticksOrBoolY)
{
	this.private.majorTicks[0] = ticksOrBoolX;
	this.private.majorTicks[1] = ticksOrBoolY;
};
Canvas2DChart.prototype.SetMinorTicks = function(ticksOrBoolX, ticksOrBoolY)
{
	this.private.minorTicks[0] = ticksOrBoolX;
	this.private.minorTicks[1] = ticksOrBoolY;
};

Canvas2DChart.prototype.SetXLim = function(min, max) // can be null for auto
{
	this.private.viewLim[0][0] = min;
	this.private.viewLim[0][1] = max;
};
Canvas2DChart.prototype.SetYLim = function(min, max) // can be null for auto
{
	this.private.viewLim[1][0] = min;
	this.private.viewLim[1][1] = max;
};

Canvas2DChart.prototype.SetChartType = function(chartType){
	this.private.chartType = chartType;
};
Canvas2DChart.prototype.SetMovingAverageCount = function(count){
	this.private.movingAverageCount = count ? count : 1;
};

// Interaction handlers
Canvas2DChart.prototype._DrawDisplayBox = function(x, y, maxPopupCallRadiusSq, title, toShow){
	this.private.innerCtx.clearRect(0, 0, this.private.innerCanvas.width, this.private.innerCanvas.height);
	if (!toShow.length)
	{
		this.private.innerCanvas.style.cursor='';
		return true;			
	}

	// Box properties
	const boxWidth = 100;
	const boxHeight = 25 + toShow.length * 15;

	const shiftX = 10;
	const shiftY = 10;

	const toRight = x + boxWidth + shiftX <= this.private.innerCanvas.width ? 1 : -1;
	const toBottom = y - boxHeight - shiftY < 0 ? 1 : -1;

	const tc = this.private.themeColor;

	// Draw box
	this.private.innerCtx.beginPath();
	this.private.innerCtx.moveTo(x,y);

	this.private.innerCtx.lineTo(x + toRight * shiftX , y + toBottom * (shiftY + 2)) ; 
	this.private.innerCtx.lineTo(x + toRight * shiftX, y + toBottom * (shiftY + boxHeight));
	this.private.innerCtx.lineTo(x + toRight * (shiftX + boxWidth), y + toBottom * (shiftY + boxHeight));
	this.private.innerCtx.lineTo(x + toRight * (shiftX + boxWidth), y + toBottom * shiftY);
	this.private.innerCtx.lineTo(x + toRight * (shiftX + 2) , y + toBottom * shiftY);

	this.private.innerCtx.closePath();
	this.private.innerCtx.strokeStyle = tc.interactionWindowBorder;
	this.private.innerCtx.lineWidth = 1;
	this.private.innerCtx.fillStyle = tc.interactionWindowBackgroud;
	this.private.innerCtx.stroke();
	this.private.innerCtx.fill();

	// Draw pointer position
	this.private.innerCanvas.style.cursor='none';
	const pointerRadius = Math.sqrt(maxPopupCallRadiusSq);
	for (var i = 0, li = toShow.length; i < li; i++)
	{
		const angle = [i * Math.PI * 2 / li, (i+1) * Math.PI * 2 / li];
		

		this.private.innerCtx.beginPath();  
		this.private.innerCtx.moveTo(x,y);
		this.private.innerCtx.lineTo(x + pointerRadius*Math.cos(angle[0]),  y + pointerRadius*Math.sin(angle[0]));  
		this.private.innerCtx.arc(x, y, pointerRadius, angle[0], angle[1]);
		this.private.innerCtx.closePath();
		
		this.private.innerCtx.fillStyle = toShow[i][2];
		this.private.innerCtx.fill();
	}

	// Fill box
	const top = y + (toBottom > 0 ? shiftY : -shiftY - boxHeight);
	const left = x + (toRight > 0 ? shiftX : -shiftX - boxWidth);

	this.private.innerCtx.fillStyle = tc.interactionWindowText;
	this.private.innerCtx.font = 'bold 12px Roboto';
	this.private.innerCtx.textAlign = 'left';
	this.private.innerCtx.textBaseline = "top";
	this.private.innerCtx.fillText(title, left + 5, top + 5, boxWidth - 10);

	for (var i = 0, li = toShow.length; i < li; i++)
	{
		this.private.innerCtx.fillStyle = toShow[i][2];
		this.private.innerCtx.font = 'bold 12px Roboto';
		this.private.innerCtx.textAlign = 'left';
		this.private.innerCtx.fillText(toShow[i][0], left + 5, 20 + top + 15 * i, 50);

		this.private.innerCtx.fillStyle = tc.interactionWindowText;
		this.private.innerCtx.font = '12px Roboto';
		this.private.innerCtx.textAlign = 'right';

		this.private.innerCtx.fillText(toShow[i][1], left + boxWidth - 3, 20 + top + 15 * i, 50);	
	}

};
Canvas2DChart.prototype._DisplayInteractionPieChart = function(x, y, maxRadiusPointSelect){
	if (!maxRadiusPointSelect)
		maxRadiusPointSelect = 6;
	const maxPopupCallRadiusSq = Math.pow(maxRadiusPointSelect, 2); // px2
	if (Math.pow(x - this.private.lastDisplayPosition[0], 2) +  Math.pow(y - this.private.lastDisplayPosition[1], 2) < maxPopupCallRadiusSq / 16)
		return false;
	this.private.lastDisplayPosition[0] = x;
	this.private.lastDisplayPosition[1] = y;

	const toShow = [];
	var label = null;
	// Identify closest data point of each set if they are smaller than maxRadius
	for (const iLabel in this.private.sets)
	{
		const ctxCoordinates = this.private.sets[iLabel].ctxCoordinates; // ref		
		for (var i=0, li = ctxCoordinates.length; i < li; i++)
		{
			const dx = x - ctxCoordinates[i][0][0];
			const dy = y - ctxCoordinates[i][0][1];
			const dist = Math.hypot(dx, dy);
			const angle = dy >= 0 ? Math.atan2(dy, dx) : (2 * Math.PI + Math.atan2(dy, dx));			
			const angleDist =  maxRadiusPointSelect / ctxCoordinates[i][1];
			
			if (Math.abs(dist - ctxCoordinates[i][1] + this.PIE_CHART_WIDTH / 2) < this.PIE_CHART_WIDTH / 2 + maxRadiusPointSelect &&
				((ctxCoordinates[i][2] - angleDist) <= angle && angle <= (ctxCoordinates[i][3] + angleDist) ||
				(ctxCoordinates[i][2] - angleDist) <= angle - Math.PI * 2 && angle - Math.PI * 2 <= (ctxCoordinates[i][3] + angleDist))
				)
			{
				label = iLabel;
				toShow.push([ctxCoordinates[i][4], String(Math.round(10000 * (ctxCoordinates[i][3] - ctxCoordinates[i][2]) / (Math.PI * 2)) / 100) + "%", ctxCoordinates[i][5]]);		
			}
		}
	}
	this._DrawDisplayBox(x, y, maxPopupCallRadiusSq, label, toShow);

};
Canvas2DChart.prototype.PanOrDisplayInteraction = function(x,y, mouseButtonPushed, movementX, movementY, maxRadiusPointSelect)
{
	if (this.private.chartType & this.PIE_CHART)
		return this._DisplayInteractionPieChart(x,y, maxRadiusPointSelect);

	// Display interaction
	if (!mouseButtonPushed || !this.private.explorer)
	{
		const maxPopupCallRadiusSq = maxRadiusPointSelect ? Math.pow(maxRadiusPointSelect, 2) : 36; // px2
		if (Math.pow(x - this.private.lastDisplayPosition[0], 2) +  Math.pow(y - this.private.lastDisplayPosition[1], 2) < maxPopupCallRadiusSq / 16)
			return false;
		this.private.lastDisplayPosition[0] = x;
		this.private.lastDisplayPosition[1] = y;

		const toShow = [];
		// Identify closest data point of each set if they are smaller than maxRadius
		for (const iLabel in this.private.sets)
		{
			const ctxCoordinates = this.private.sets[iLabel].ctxCoordinates; // ref
			var minDistanceSq = maxPopupCallRadiusSq;
			var minDistanceSqIndex = -1;
			for (var i=0, li = ctxCoordinates.length; i < li; i++)
			{
				const distSq = Math.pow(ctxCoordinates[i][0] - x, 2) + Math.pow(ctxCoordinates[i][1] - y, 2);
				if (distSq < minDistanceSq)
				{
					minDistanceSq = distSq;
					minDistanceSqIndex = i;
				}
			}
			if (minDistanceSqIndex != -1)
				toShow.push([iLabel, ctxCoordinates[minDistanceSqIndex][2], this.private.sets[iLabel].color]);
			
		}

		const pointerRadius = Math.sqrt(maxPopupCallRadiusSq);
		var xValue = (x - this.private.lastDraw.drawRect[0]) / this.private.lastDraw.scalingFactor[0] + this.private.lastDraw.min[0]; //this.private.sets[toShow[0][0]].actualValue[toShow[0][1]][0];
		switch(this.private.typeStructure[0])
		{
			case this.NUMBER:
				// Get accuracy right within plot region
				const accuracyN = Math.pow(10, Math.max(0,Math.floor(1 - Math.log10(pointerRadius* 0.5 * this.private.lastDraw.accuracy[0]))));
				xValue = Math.round(xValue * accuracyN) / accuracyN;
				break;
			case this.DATETIME:
				xValue = DateToLocalDateTimeString(xValue, this.private.lastDraw.accuracy[0] * 0.5 * pointerRadius, this.private.lastDraw.range[0]);
				break;
			default:
				break;
		}
			
		for (var i = 0, li = toShow.length; i < li; i++)
		{
			switch(this.private.typeStructure[1])
			{
				case this.NUMBER:
					// Get accuracy right within plot region
					const accuracyN = Math.pow(10, Math.max(0,1-Math.floor(Math.log10((this.private.lastDraw.max[1] - this.private.lastDraw.min[1]) / this.private.innerCanvas.width))));
					toShow[i][1] = String(Math.round((toShow[i][1] )*accuracyN) / accuracyN);					
					break;
				case this.DATETIME:
					const range = this.private.lastDraw.max[1] - this.private.lastDraw.min[1];
					const accuracy = range / this.private.innerCanvas.width;
					toShow[i][1] = DateToLocalDateTimeString(toShow[i][1], accuracy, range);					
					break;
				default:						
					break;
			}
		}
		this._DrawDisplayBox(x,y,maxPopupCallRadiusSq, xValue, toShow);

		return true;
	}

	// Panning of window
	this.private.innerCtx.clearRect(0, 0, this.private.innerCanvas.width, this.private.innerCanvas.height);
	this.private.lastDisplayPosition[0] = -1; // UINT16
	this.private.lastDisplayPosition[1] = -1;

	if (!this.private.explorer)
		return true;
	
	if (movementX && this.private.explorer & this.XDIRECTION)
	{
		const relMovement = movementX / this.private.innerCanvas.width;
		const range = this.private.lastDraw.range[0];

		this.private.viewLim[0][0] = this.private.lastDraw.min[0] - range * relMovement;
		this.private.viewLim[0][1] = this.private.lastDraw.max[0] - range * relMovement;
		
		if (this.private.chartType & this.COLUMN_CHART)
		{
			this.private.viewLim[0][0] += this.private.lastDraw.binSize * 0.5;
			this.private.viewLim[0][1] -= this.private.lastDraw.binSize * 0.5;
		}
	}
	if (movementY && this.private.explorer & this.YDIRECTION)
	{
		const relMovement = -movementY / this.private.innerCanvas.height;
		const range = this.private.lastDraw.range[1];		
		this.private.viewLim[1][0] = this.private.lastDraw.min[1] - range*relMovement;
		this.private.viewLim[1][1] = this.private.lastDraw.max[1] - range*relMovement;

		if (this.private.chartType & this.BAR_CHART)
		{
			this.private.viewLim[1][0] += this.private.lastDraw.binSize * 0.5;
			this.private.viewLim[1][1] -= this.private.lastDraw.binSize * 0.5;
		}
	}
	for (var i=0, li = this.private.explorerCallback.length; i < li; i++)
	{
		if (!this.private.explorerCallback[i](this.private.viewLim[0][0], this.private.viewLim[0][1], this.private.viewLim[1][0], this.private.viewLim[1][1]))
			return true;
	}	
	this.DrawChart();

	return true;
};
Canvas2DChart.prototype.ZoomInteraction = function(x,y, deltaY)
{
	if (!this.private.explorer || (this.private.chartType & this.PIE_CHART))
		return false;
	const relWheel = [deltaY / this.private.lastDraw.drawRect[2], deltaY / this.private.lastDraw.drawRect[3]];
	const range = [this.private.lastDraw.max[0] - this.private.lastDraw.min[0], this.private.lastDraw.max[1] - this.private.lastDraw.min[1]];
	const change = [relWheel[0] * range[0], relWheel[1] * range[1]];
	const relAnchor = [
		(x -this.private.lastDraw.drawRect[0]) / this.private.lastDraw.drawRect[2],
		(y -this.private.lastDraw.drawRect[1]) / this.private.lastDraw.drawRect[3]
	];

	//console.log(relWheel, change);


	if (relAnchor[0]*relAnchor[1] < 0) return true; // not in plot
	if (this.private.explorer & this.XDIRECTION)
	{
		this.private.viewLim[0][0] = this.private.lastDraw.min[0] - change[0] * relAnchor[0];
		this.private.viewLim[0][1] = this.private.lastDraw.max[0] + change[0] * (1-relAnchor[0]);
		
		
		if (this.private.chartType & this.COLUMN_CHART)
		{
			this.private.viewLim[0][0] += this.private.lastDraw.binSize * 0.5;
			this.private.viewLim[0][1] -= this.private.lastDraw.binSize * 0.5;
		}
		if (this.private.viewLim[0][0] > this.private.viewLim[0][1])
		{
			this.private.viewLim[0][0] = null;
			this.private.viewLim[0][1] = null;
		}

	}
	if (this.private.explorer & this.YDIRECTION)
	{
		this.private.viewLim[1][0] = this.private.lastDraw.min[1] - change[1] * relAnchor[1];
		this.private.viewLim[1][1] = this.private.lastDraw.max[1] + change[1] * (1-relAnchor[1]);

		if (this.private.chartType & this.BAR_CHART)
		{
			this.private.viewLim[1][0] += this.private.lastDraw.binSize * 0.5;
			this.private.viewLim[1][1] -= this.private.lastDraw.binSize * 0.5;
		}
		if (this.private.viewLim[1][0] > this.private.viewLim[1][1])
		{
			this.private.viewLim[1][0] = null;
			this.private.viewLim[1][1] = null;
		}
	}
	for (var i=0, li = this.private.explorerCallback.length; i < li; i++)
	{
		if (!this.private.explorerCallback[i](this.private.viewLim[0][0], this.private.viewLim[0][1], this.private.viewLim[1][0], this.private.viewLim[1][1]))
			return true;
	}
	this.DrawChart();
	this.PanOrDisplayInteraction(x,y, false, 0, 0);
	return true;
};

Canvas2DChart.prototype._TestPieChartRadius = function(pieCount, radius, w, h){
	const pieMaxColums = Math.trunc(w / (2 * (radius + this.PIE_CHART_MARGIN)));
	const pieRows = Math.ceil(pieCount / pieMaxColums);
	const pieColums = Math.ceil(pieCount / pieRows); // is grid columns, can be less in final row	
	return ( Math.trunc((w - 2 * pieColums * (this.PIE_CHART_MARGIN + radius)) / 2) >= 0) & (Math.trunc((h - 2 * pieRows * (this.PIE_CHART_MARGIN + radius)) / 2) >= 0);
};
Canvas2DChart.prototype._GetPieChartRadius = function(pieCount){
	const currentDraw = this.private.lastDraw; // reference
	const drawRect = currentDraw.drawRect; // reference

	const w = drawRect[2] - drawRect[0];
	const h = drawRect[3] - drawRect[1];

	const maxRadius = Math.trunc((Math.min(w, h) - 2 * this.PIE_CHART_MARGIN) / 2);	
	if (this._TestPieChartRadius(pieCount, maxRadius, w, h))
		return maxRadius;	
		
	if (!this._TestPieChartRadius(pieCount, 0, w, h))
		return 0;

	let radius = [0, maxRadius]; // bisect
	let iter = 0;
	const tol = this.PIE_CHART_MARGIN + 1;
	while (radius[1] - radius[0] > tol)
	{
		const mid = (radius[0] + radius[1]) / 2;
		radius[this._TestPieChartRadius(pieCount, mid, w, h) ? 0 : 1] = mid;				
		++iter;
	}
	return Math.trunc(radius[0]);
};
Canvas2DChart.prototype._DrawPieChart = function(){
	//console.log(this);
	if (this.private.typeStructure[1] != this.NUMBER){
		console.warn("Can't draw pie chart since there is no way to sum values");
		QuickNotification("Failed to draw pie chart due to invalid y-axis type", 'w');
		return false;
	}

	// assured there is some data	
	const ctx = this.private.ctx; // reference
	const ctxDim = [ctx.canvas.width, ctx.canvas.height];

	const currentDraw = this.private.lastDraw; // reference
	const drawRect = currentDraw.drawRect; // reference
	drawRect[0] = 0;
	drawRect[1] = 0;
	drawRect[2] = ctxDim[0];
	drawRect[3] = ctxDim[1];


	// Run down list 
	const label = Object.keys(this.private.sets);
	const pieCount = label.reduce((a,b)=>a + (this.private.sets[b].hidden == false), 0);

	// Compute grid of pie charts
	const radius = this._GetPieChartRadius(pieCount);
	if (!radius){
		console.warn("Negative margin in pie chart grid");
		QuickNotification("Unable to draw pie chart due to computation error", 'w');
		return false;
	}
	
	const pieMaxColums = Math.trunc((drawRect[2] - drawRect[0]) / (2 * (radius + this.PIE_CHART_MARGIN)));
	const pieRows = Math.ceil(pieCount / pieMaxColums);
	const pieColums = Math.ceil(pieCount / pieRows); // is grid columns, can be less in final row	

	const gridMargin = [Math.trunc((drawRect[2] - drawRect[0] - 2 * pieColums * (this.PIE_CHART_MARGIN + radius)) / 2), Math.trunc((drawRect[3] - drawRect[1] - 2 * pieRows * (this.PIE_CHART_MARGIN + radius)) / 2)];
		
	for (let i = 0; i < label.length; i++)
	{
		const set = this.private.sets[label[i]]; // reference
		set.ctxCoordinates.length = 0;
		if (set.hidden)
			continue;

		const pieRow = Math.trunc(i / pieColums);
		const pieColumn = Math.trunc(i % pieColums);
		
		const center = [gridMargin[0] + (2 * pieColumn + 1) * (this.PIE_CHART_MARGIN + radius), gridMargin[1] + (2 * pieRow + 1) * (this.PIE_CHART_MARGIN + radius)];
		
		const valueSum = set.numberValue.reduce((a,b)=>a+b[1], 0);

		ctx.fillStyle = this.private.themeColor.label;
		ctx.textAlign = 'center';
		if (0.99 < valueSum  || valueSum > 1.01)
		{
			ctx.font = '12px Roboto';
			ctx.textBaseline = "top";		
			ctx.fillText("Sum: " + String(valueSum), center[0], center[1], 2*(radius - this.PIE_CHART_WIDTH));
			ctx.textBaseline = "bottom";		
		}
		else
			ctx.textBaseline = "middle";

		ctx.font = '18px Roboto';
		ctx.fillText(label[i], center[0], center[1], 2*(radius - this.PIE_CHART_WIDTH));

		

		let offsetAngle = 0;
		for (let j = 0; j < set.length; ++j){
			const endAngle = offsetAngle + 2 * Math.PI * set.numberValue[j][1] / valueSum;			

			ctx.fillStyle = this.DEFAULT_COLORING[(j + (j % this.DEFAULT_COLORING.length == ((j + 1) % set.length) % this.DEFAULT_COLORING.length)) % this.DEFAULT_COLORING.length];				
			ctx.beginPath();
			ctx.arc(center[0], center[1], radius, offsetAngle, endAngle, false);	
			ctx.lineTo(center[0] + Math.cos(endAngle) * (radius - this.PIE_CHART_WIDTH), center[1] + Math.sin(endAngle) * (radius - this.PIE_CHART_WIDTH));
			ctx.arc(center[0], center[1], radius - this.PIE_CHART_WIDTH, endAngle, offsetAngle, true);
			ctx.fill();
			
			set.ctxCoordinates.push([center, radius, offsetAngle, endAngle, set.actualValue[j][0], ctx.fillStyle]);			
			if (!IsMobile() && (endAngle - offsetAngle) * (radius - this.PIE_CHART_WIDTH) > GetDefaultTextWidth(set.actualValue[j][0]) * 2 && this.private.legend !== null)
			{
				const midAngle = (endAngle + offsetAngle) / 2;
				ctx.font = "12px Roboto";
				ctx.textAlign = (midAngle - Math.PI / 2) <= Math.PI && midAngle >= Math.PI / 2 ? "left" : "right";
				ctx.textBaseline = midAngle <= Math.PI ? "bottom" : "top";
				ctx.fillText( String(set.actualValue[j][0]), center[0] + Math.cos(midAngle) * (radius - this.PIE_CHART_WIDTH - 5), center[1] + Math.sin(midAngle) * (radius - this.PIE_CHART_WIDTH - 5), Math.min(radius / 2, this.PIE_CHART_LEGEND_MAX_WIDTH));
			}

			offsetAngle = endAngle;
		}

	}


	return true;
};
Canvas2DChart.prototype.DrawChart = function(){
	const ctx = this.private.ctx; // reference
	// Has to be of same dimension otherwise need a scaling factor in interaction
	ctx.canvas.width = ctx.canvas.clientWidth;
	ctx.canvas.height = ctx.canvas.clientHeight;
	
	// Has to be of same dimension otherwise need a scaling factor in interaction
	this.private.innerCanvas.width = ctx.canvas.clientWidth;
	this.private.innerCanvas.height = ctx.canvas.clientHeight;
	
	const ctxDim = [ctx.canvas.width, ctx.canvas.height];

	ctx.clearRect(0, 0, ctxDim[0], ctxDim[1]);
	if (!this.private.dataLength)
	{
		ctx.fillStyle = this.private.themeColor.label; 
		ctx.font = '18px Roboto bold';
		ctx.textAlign = 'center';
		ctx.textBaseline = "middle";
		ctx.fillText("No data to plot", ctxDim[0] / 2, ctxDim[1] / 2, ctxDim[0]);
		return true;
	}

	if (this.private.chartType & this.PIE_CHART)
	{
		return this._DrawPieChart();
	}

	// Chart space
	const currentDraw = this.private.lastDraw; // reference
	const drawRect = currentDraw.drawRect; // reference
	drawRect[0] = this.private.ylabel != null ? 45 : 30;
	drawRect[1] = 5 + (this.private.legend == true ? 20 : 0);
	
	drawRect[2] = ctxDim[0] - drawRect[0] - (this.private.legend == false)*120 - 5;
	drawRect[3] = ctxDim[1] - drawRect[1] - 15 - (this.private.xlabel != null) * 15;
	
	// Run down list find scaling, min, max and ideal ticks choice
	const label = Object.keys(this.private.sets);
	const startIndex = new Uint32Array(label.length);
	const endIndex = new Uint32Array(label.length);
	
	
	// Independant variable
	currentDraw.min[0] = this.private.viewLim[0][0] == null ? this.private.minNumber[0] : Math.max(this.private.viewLim[0][0], this.private.minNumber[0]);
	currentDraw.max[0] = this.private.viewLim[0][1] == null ? this.private.maxNumber[0] : Math.min(this.private.viewLim[0][1], this.private.maxNumber[0]);
	if (this.private.chartType & this.COLUMN_CHART)
	{
		currentDraw.min[0] -= this.private.sets[label[0]].size * 0.5;
		currentDraw.max[0] += this.private.sets[label[0]].size * 0.5;
	}
	if (this.private.chartType & this.BAR_CHART)
	{
		currentDraw.min[1] -= this.private.sets[label[0]].size * 0.5;
		currentDraw.max[1] += this.private.sets[label[0]].size * 0.5;
	}

	// Dependant variable and will alter boundries to that of indpendant corrisponding data
	currentDraw.min[1] = this.private.maxNumber[1]; // delibarate other way around
	currentDraw.max[1] = this.private.minNumber[1];
	
	var dataPointCount = 0;
	for (var i = 0, li = label.length; i < li; i++)
	{
		const set = this.private.sets[label[i]];
		if (set.hidden)
			continue;
		var j = 0;		
		for (;j<set.length;j++)
		{
			if (set.numberValue[j][0] >= currentDraw.min[0])
			{
				startIndex[i] = j;
				break;
			}
		}
		
		for (;j<set.length;j++)
		{
			if (set.numberValue[j][0] > currentDraw.max[0])
				break;

			if (set.numberValue[j][1] < currentDraw.min[1])
				currentDraw.min[1] = set.numberValue[j][1];
			else if (set.numberValue[j][1] > currentDraw.max[1])
				currentDraw.max[1] = set.numberValue[j][1];
		}
		endIndex[i] = j;		
		dataPointCount += endIndex[i] - startIndex[i];		
	}
	if (dataPointCount == 0)
	{
		ctx.fillStyle = this.private.themeColor.label; 
		ctx.font = '18px Roboto bold';
		ctx.textAlign = 'center';
		ctx.textBaseline = "middle";
		ctx.fillText("No data points left to plot in view window", ctxDim[0] / 2, ctxDim[1] / 2, ctxDim[0]);
		return true;
	}
	
	if (!(this.private.chartType & this.BAR_CHART))
	{
		if (this.private.viewLim[1][0] == null)
			currentDraw.min[1] *= currentDraw.min[1] > 0 ? (currentDraw.min[1] <= 5 ? 0 :0.9) : 1.1;
		if (this.private.viewLim[1][1] == null)
			currentDraw.max[1] *= 1.1;
	}

	if (this.private.viewLim[1][0] != null)
		currentDraw.min[1] =  this.private.viewLim[1][0]; // delibarate other way around
	if (this.private.viewLim[1][1] != null)
		currentDraw.max[1] = this.private.viewLim[1][1];
 
	const tc = this.private.themeColor; // reference

	const tickText = [[],[]];
	ctx.lineWidth = 1;
	for (var i=0; i < 2; i++)
	{
		currentDraw.range[i] = currentDraw.max[i] - currentDraw.min[i];
		currentDraw.accuracy[i] = currentDraw.range[i] / ctxDim[i];
		
		// String based spacing is prefered (can not get string when first set has not data values, then goes to 80px)
		currentDraw.preferedPixelSpacing[i] = this.private.typeStructure[i] == this.DATETIME ? (DateToLocalDateTimeString(new Date(), currentDraw.accuracy[i], currentDraw.range[i]).length + 2) * 12 : this.private.sets[label[0]].length ? (String(this.private.sets[label[0]].actualValue[0][i]).length + 4) * 12 : 80;
		
		// Non refined is ideal steps in terms of spacing
		const nonRefinedStepSize = Math.max(currentDraw.preferedPixelSpacing[i],80) * currentDraw.range[i] / (i == 0 ? ctx.canvas.clientWidth : ctx.canvas.clientHeight); // every 50px roughly
		// Exponential change on related to what value to use for splitting jumps neatly
		const exponentialChangeOn = this.private.typeStructure[i] == this.DATETIME ? ((currentDraw.range[i] > 86400000 * 10) ?  86400000 : ((currentDraw.range[i] > 3600000 * 10) ? 3600000 : ((currentDraw.range[i] > 60000 * 10) ? 60000 : ((currentDraw.range[i] > 1000 * 10) ? 1000 : 5)))) : 5;
		// Uses exponential change to get close to best spacing
		currentDraw.stepSize[i] = (nonRefinedStepSize - nonRefinedStepSize % Math.pow(exponentialChangeOn, Math.floor(Math.log(nonRefinedStepSize) / Math.log(exponentialChangeOn))));
		// Starting point for computed ticks
		const accCP = Math.pow(10, 1-Math.floor(Math.log10(currentDraw.accuracy[i]))); // a read friendly version of 1/accuracy 
		const start = Math.round(Math.ceil(currentDraw.min[i] / currentDraw.stepSize[i]) * currentDraw.stepSize[i] * accCP) / accCP;

		currentDraw.scalingFactor[i] = drawRect[2 + i] / currentDraw.range[i];

		
		
		// Draw major and minor ticks
		if (this.private.majorTicks[i])
		{
			ctx.strokeStyle = tc.majorAxis;
			if (this.private.majorTicks[i] == true)
			{
				// Use computed
				var current = start < currentDraw.min[i] ? start + currentDraw.stepSize[i] : start;
				for (;current < currentDraw.max[i]; current += currentDraw.stepSize[i])
				{
					var currentP = [
						i == 0 ? (current - currentDraw.min[i]) * currentDraw.scalingFactor[i] + drawRect[i] : drawRect[0],
						i == 1 ? drawRect[1] + drawRect[3] - (current - currentDraw.min[i]) * currentDraw.scalingFactor[i] : drawRect[1]
					];

					ctx.beginPath();
					ctx.moveTo(currentP[0], currentP[1]);
					ctx.lineTo(i == 0 ? currentP[0] : drawRect[0] + drawRect[2], i == 1 ? currentP[1] : drawRect[1] + drawRect[3]);
					ctx.stroke();
					tickText[i].push([currentP[i], this.private.typeStructure[i] == this.NUMBER ? Math.round(current * accCP) / accCP : (this.private.typeStructure[i] == this.DATETIME ? DateToLocalDateTimeString(current, currentDraw.accuracy[i], currentDraw.range[i]) : "")]);	
				}
			}
			else
			{
				// Use predefined number values
				for (j = 0, lj = this.private.majorTicks[i].length; j < lj ; j++)
				{
					const current = this.private.majorTicks[i][j];

					var currentP = [
						i == 0 ? (current - currentDraw.min[i]) * currentDraw.scalingFactor[i] + drawRect[i] : drawRect[0],
						i == 1 ? drawRect[1] + drawRect[3] - (current - currentDraw.min[i]) * currentDraw.scalingFactor[i] : drawRect[1]
					];

					ctx.beginPath();
					ctx.moveTo(currentP[0], currentP[1]);
					ctx.lineTo(i == 0 ? currentP[0] : drawRect[0] + drawRect[2], i == 1 ? currentP[1] : drawRect[1] + drawRect[3]);
					ctx.stroke();
					tickText[i].push([currentP[i], this.private.typeStructure[i] == this.NUMBER ? current : (this.private.typeStructure[i] == this.DATETIME ? DateToLocalDateTimeString(current, currentDraw.accuracy[i], currentDraw.range[i]) : "")]);	
					
				}
			}
		}
		if (this.private.minorTicks[i])
		{
			ctx.strokeStyle = tc.minorAxis;
			if (this.private.minorTicks[i] == true)
			{
				// Use computed
				var current = (start + currentDraw.stepSize[i] / 2) < currentDraw.min[i] ? (start + currentDraw.stepSize[i] * 1.5): (start + currentDraw.stepSize[i] * 0.5);
				for (;current < currentDraw.max[i]; current += currentDraw.stepSize[i])
				{
					var currentP = [
						i == 0 ? (current - currentDraw.min[i]) * currentDraw.scalingFactor[i] + drawRect[i] : drawRect[0],
						i == 1 ? drawRect[1] + drawRect[3] - (current - currentDraw.min[i]) * currentDraw.scalingFactor[i] : drawRect[1]
					];

					ctx.beginPath();
					ctx.moveTo(currentP[0], currentP[1]);
					ctx.lineTo(i == 0 ? currentP[0] : drawRect[0] + drawRect[2], i == 1 ? currentP[1] : drawRect[1] + drawRect[3]);
					ctx.stroke();					
				}
			}
			else
			{
				// Use predefined number values
				for (j = 0, lj = this.private.minorTicks[i].length; j < lj ; j++)
				{
					const current = this.private.minorTicks[i][j];
					
					var currentP = [
						i == 0 ? (current - currentDraw.min[i]) * currentDraw.scalingFactor[i] + drawRect[i] : drawRect[0],
						i == 1 ? drawRect[1] + drawRect[3] - (current - currentDraw.min[i]) * currentDraw.scalingFactor[i] : drawRect[1]
					];

					ctx.beginPath();
					ctx.moveTo(currentP[0], currentP[1]);
					ctx.lineTo(i == 0 ? currentP[0] : drawRect[0] + drawRect[2], i == 1 ? currentP[1] : drawRect[1] + drawRect[3]);
					ctx.stroke();					
				}
			}
		}
	}

	// Draw main axis
	ctx.lineWidth = 1.5;
	ctx.strokeStyle = tc.mainAxis;
	if (currentDraw.min[0] <= 0 && currentDraw.max[0] >= 0)
	{
		ctx.beginPath();
		ctx.moveTo(-currentDraw.min[0]*currentDraw.scalingFactor[0] + drawRect[0], drawRect[1]);
		ctx.lineTo(-currentDraw.min[0]*currentDraw.scalingFactor[0] + drawRect[0], drawRect[1] + drawRect[3]);
		ctx.stroke();
	}
	if (currentDraw.min[1] <= 0 && currentDraw.max[1] >= 0)
	{
		ctx.beginPath();
		ctx.moveTo(drawRect[0], drawRect[1] + drawRect[3] + currentDraw.min[1]*currentDraw.scalingFactor[1]);
		ctx.lineTo(drawRect[0] + drawRect[2], drawRect[1] + drawRect[3] + currentDraw.min[1]*currentDraw.scalingFactor[1]);
		ctx.stroke();
	}

	// Draw actual chart data
	var currentP = new Int16Array(2);		
	if (this.private.chartType & this.LINE_CHART_NO_POINT)
	{
		for (var j = 0, lj = label.length; j < lj; j++)		
		{
			const set = this.private.sets[label[j]];
			set.ctxCoordinates.length = 0;		
			if (set.length == 0 || set.hidden)
				continue;
			// CTX properties
			ctx.strokeStyle = set.color;
			ctx.setLineDash(set.style);
			ctx.lineWidth = set.size;
		
			ctx.beginPath();
			// First point
			var i = Math.max(0, startIndex[j] - 1);
			
			currentP[0] = (set.numberValue[i][0] - currentDraw.min[0])*currentDraw.scalingFactor[0] + drawRect[0];
			currentP[1] = drawRect[1] + drawRect[3] - (set.numberValue[i][1] - currentDraw.min[1])*currentDraw.scalingFactor[1];
			ctx.moveTo(currentP[0], currentP[1]);

			for (i++, li = Math.min(endIndex[j] + 1, set.length); i < li; i++)
			{
				currentP[0] = (set.numberValue[i][0] - currentDraw.min[0])*currentDraw.scalingFactor[0] + drawRect[0];
				currentP[1] = drawRect[1] + drawRect[3] - (set.numberValue[i][1] - currentDraw.min[1])*currentDraw.scalingFactor[1];
				ctx.lineTo(currentP[0], currentP[1]);				
				set.ctxCoordinates.push([currentP[0], currentP[1], set.actualValue[i][1]]);
			}
			ctx.stroke();
		}
	}
	if (this.private.chartType & this.LINE_CHART)
	{
		for (var j = 0, lj = label.length; j < lj; j++)		
		{
			const set = this.private.sets[label[j]];
			set.ctxCoordinates.length = 0;		
			if (set.length == 0 || set.hidden)
				continue;
			// CTX properties
			ctx.strokeStyle = set.color;
			ctx.setLineDash(set.style);
			ctx.lineWidth = set.size;
		
			ctx.beginPath();
			// First point
			var i = Math.max(0, startIndex[j] - 1);
			
			currentP[0] = (set.numberValue[i][0] - currentDraw.min[0])*currentDraw.scalingFactor[0] + drawRect[0];
			currentP[1] = drawRect[1] + drawRect[3] - (set.numberValue[i][1] - currentDraw.min[1])*currentDraw.scalingFactor[1];

			ctx.arc(currentP[0], currentP[1], set.size, 0, Math.PI*2);
			ctx.moveTo(currentP[0], currentP[1]);

			for (i++, li = Math.min(endIndex[j] + 1, set.length); i < li; i++)
			{
				currentP[0] = (set.numberValue[i][0] - currentDraw.min[0])*currentDraw.scalingFactor[0] + drawRect[0];
				currentP[1] = drawRect[1] + drawRect[3] - (set.numberValue[i][1] - currentDraw.min[1])*currentDraw.scalingFactor[1];
				ctx.lineTo(currentP[0], currentP[1]);
				ctx.arc(currentP[0], currentP[1], set.size * 1.5, 0, Math.PI*2);
				ctx.moveTo(currentP[0], currentP[1]);
				set.ctxCoordinates.push([currentP[0], currentP[1], set.actualValue[i][1]]);
			}
			ctx.stroke();
		}
	}
	if (this.private.chartType & this.COLUMN_CHART)
	{
		currentDraw.binSize = this.private.sets[label[0]].size;
		const drawSize = Math.max(5, currentDraw.binSize * currentDraw.scalingFactor[0] * this.private.binWidthScale);		
		const zeroYP = Math.trunc(drawRect[1] + drawRect[3] + currentDraw.min[1]*currentDraw.scalingFactor[1]);
		for (var j = 0, lj = label.length; j < lj; j++)
		{
			const set = this.private.sets[label[j]];
			set.ctxCoordinates.length = 0;
			if (set.length == 0 || set.hidden)
				continue;
			if (set.size != currentDraw.binSize)
			{
				console.warn("Assumption made to draw " + label[j] + " due to incorrect usage of size parameter (column needs matching sizes)", 'w');
				set.size = currentDraw.binSize;
			}
			ctx.fillStyle = set.color;			
			for (var i = startIndex[j]; i < endIndex[j]; i++)
			{
				currentP[0] = (set.numberValue[i][0] - currentDraw.min[0])*currentDraw.scalingFactor[0] + drawRect[0];
				currentP[1] = drawRect[1] + drawRect[3] - (set.numberValue[i][1] - currentDraw.min[1])*currentDraw.scalingFactor[1];
				// In bin coordinates

				ctx.fillRect( currentP[0] + drawSize * (j/this.private.setLength -0.5) , currentP[1], drawSize / this.private.setLength, zeroYP - currentP[1]);
			}
		}		
	}
	else if (this.private.chartType & this.BAR_CHART)
	{
		currentDraw.binSize = this.private.sets[label[0]].size;
		const drawSize = Math.max(5, currentDraw.binSize * currentDraw.scalingFactor[1] * this.private.binWidthScale);		
		const zeroXP = Math.trunc(drawRect[0] - currentDraw.min[0]*currentDraw.scalingFactor[0]);
		for (var j = 0, lj = label.length; j < lj; j++)
		{
			const set = this.private.sets[label[j]];
			set.ctxCoordinates.length = 0;
			if (set.length == 0 || set.hidden)
				continue;
			if (set.size != currentDraw.binSize)
				console.warn("Assumption made to draw " + label[j] + " due to incorrect usage of size parameter (column needs matching sizes)", 'w');
			
			for (var i = startIndex[j]; i < endIndex[j]; i++)
			{
				currentP[0] = (set.numberValue[i][0] - currentDraw.min[0])*currentDraw.scalingFactor[0] + drawRect[0];
				currentP[1] = drawRect[1] + drawRect[3] - (set.numberValue[i][1] - currentDraw.min[1])*currentDraw.scalingFactor[1];
				// In bin coordinates
				ctx.fillStyle = set.color;
				ctx.fillRect(zeroXP, currentP[1] + drawSize * (j/this.private.setLength - 0.5), currentP[0] - zeroXP, drawSize / this.private.setLength);
				// In normal coordinates
				ctx.fillStyle = "black";
				ctx.beginPath();
				ctx.arc(currentP[0], currentP[1], 4, 0, Math.PI * 2);
				ctx.fill();

				set.ctxCoordinates.push([currentP[0], currentP[1], i]);
				
			}
		}
	}
	if (this.private.chartType & this.DOT_CHART)
	{
		for (var j = 0, lj = label.length; j < lj; j++)
		{
			const set = this.private.sets[label[j]];
			set.ctxCoordinates.length = 0;
			if (set.length == 0 || set.hidden)
				continue;
			ctx.fillStyle = set.color;
			for (var i = startIndex[j]; i < endIndex[j]; i++)
			{
				currentP[0] = (set.numberValue[i][0] - currentDraw.min[0])*currentDraw.scalingFactor[0] + drawRect[0];
				currentP[1] = drawRect[1] + drawRect[3] - (set.numberValue[i][1] - currentDraw.min[1])*currentDraw.scalingFactor[1];
				
				ctx.beginPath();
				ctx.arc(currentP[0], currentP[1], 4, 0, Math.PI * 2);
				ctx.fill();
				set.ctxCoordinates.push([currentP[0], currentP[1], set.actualValue[i][1]]);
			}
		}
	}
	if (this.private.chartType & this.WL_LINE){
		for (var j = 0, lj = label.length; j < lj; j++)
		{
			const set = this.private.sets[label[j]];			
			if (set.length == 0 || set.hidden)
				continue;
			
			const si = Math.max(startIndex[j] - this.private.movingAverageCount, 0);
			var i = si;
			var li = Math.max(startIndex[j] - 1, 0);
			
			var val = 0;
			// Warming up before data begins
			for (; i < li; i++)
				val += set.numberValue[i][1];
			if (val) 
				val /= (li - si);
			
			// Average of first values pre-full filled
			ctx.strokeStyle = set.color;
			ctx.fillStyle = set.color;
			ctx.lineWidth = 1;
			ctx.setLineDash(set.style);
			
			li = Math.min(si + this.private.movingAverageCount, set.length);
			var ri = i;
			currentP[0] = (set.numberValue[ri][0] - currentDraw.min[0])*currentDraw.scalingFactor[0] + drawRect[0];
			currentP[1] = drawRect[1] + drawRect[3] - (val - currentDraw.min[1])*currentDraw.scalingFactor[1];
			ctx.beginPath();
			ctx.moveTo(currentP[0], currentP[1]);
			for (; i < li; i++)
			{
				val *= (i-si);
				val += set.numberValue[i][1];
				val /= (i-si + 1);

				currentP[0] = (set.numberValue[ri++][0] - currentDraw.min[0])*currentDraw.scalingFactor[0] + drawRect[0];
				currentP[1] = drawRect[1] + drawRect[3] - (val - currentDraw.min[1])*currentDraw.scalingFactor[1];
				ctx.lineTo(currentP[0], currentP[1]);
				ctx.fillRect(currentP[0] - 2, currentP[1] - 2, 4, 4);
				//ctx.arc(currentP[0], currentP[1],1.5, 0, Math.PI*2);
				ctx.moveTo(currentP[0], currentP[1]);
				set.ctxCoordinates.push([currentP[0], currentP[1], val]);
			}

			// Fully developed moving average
			li = Math.min(endIndex[j] + 1, set.length)
			for (; i < li; i++)
			{
				val -= set.numberValue[i - this.private.movingAverageCount][1] / this.private.movingAverageCount;
				val += set.numberValue[i][1] / this.private.movingAverageCount;
				
				currentP[0] = (set.numberValue[ri++][0] - currentDraw.min[0])*currentDraw.scalingFactor[0] + drawRect[0];
				currentP[1] = drawRect[1] + drawRect[3] - (val - currentDraw.min[1])*currentDraw.scalingFactor[1];
				ctx.lineTo(currentP[0], currentP[1]);
				ctx.fillRect(currentP[0] - 2, currentP[1] - 2, 4, 4);
				//ctx.arc(currentP[0], currentP[1],1.5, 0, Math.PI*2);
				ctx.moveTo(currentP[0], currentP[1]);
				set.ctxCoordinates.push([currentP[0], currentP[1], val]);
			}

			ctx.stroke();
		}
	}
	if (this.private.chartType & this.COLUMN_WL_CHART)
	{
		const mar = currentDraw.binSize * this.private.movingAverageCount;

		for (var j = 0, lj = label.length; j < lj; j++)
		{
			const set = this.private.sets[label[j]];			
			if (set.length == 0 || set.hidden)
				continue;
			
			// val = current moving average
			// fd = first data point in window			
			// fpow = first point out of window
			// lpow = last point out of window
			// cp  = current point (x value)
			// i = index in dataset
			// li = lagging index in dataset for subtraction in moving average
			// ii = initial forward index in dataset 
			// fmpv = first moving point in average count value (x)
			// mar = moving average range
			
			
			var i = startIndex[j];
			var val = 0;

			const fd = set.numberValue[i][0]; // anchor point to get boundries with known bin size
			const fpow = fd - Math.ceil((fd - currentDraw.min[0]) / currentDraw.binSize) * currentDraw.binSize;
			const lpow = fd + Math.ceil((currentDraw.max[0] - fd) / currentDraw.binSize) * currentDraw.binSize;

			const fmpv = fpow - mar;
			

			// Get index (i) closest to fpow
			for (; i > -1; i--)
			{
				if (set.numberValue[i][0] <= fpow)
					break;
			}			
			const ii = i + 1;			
			
			// Get index (i) closest to fmpv while adding to val for first moving average value (y)
			for (; i > -1; i--)
			{
				if (set.numberValue[i][0] <= fmpv)
					break;
				val += set.numberValue[i][1];
			}
			val /= this.private.movingAverageCount;
			var li = i + 1;
			
			ctx.strokeStyle = set.color;
			ctx.fillStyle = set.color;
			ctx.lineWidth = 1;
			ctx.setLineDash(set.style);
						
			// Move to first point to get line right from outside window to first point in window
			var cp = fpow;
			ctx.beginPath();
			currentP[0] = drawRect[0] + (cp - currentDraw.min[0])* currentDraw.scalingFactor[0];
			currentP[1] = drawRect[1] + drawRect[3] - (val - currentDraw.min[1]) * currentDraw.scalingFactor[1];
			ctx.moveTo(currentP[0], currentP[1]);
			
			// Fill all points up till last point out of window
			for (i = ii;cp <= lpow; cp+= currentDraw.binSize) // cp is first point out of window and i is closest to that point
			{
				// Add new value to moving average
				//console.log(DateToLocalDateTimeString(cp), cp - set.numberValue[i][0]);
				if (i < set.length && set.numberValue[i][0] <= cp)
				{
					// Value in dataset is correct
					val += set.numberValue[i++][1] / this.private.movingAverageCount;
				}
				// else add 0

				// Remove old value from moving average
				if (li < set.length && set.numberValue[li][0] <= cp - mar)
				{
					// Value was taken once into account can now go
					val -= set.numberValue[li++][1] / this.private.movingAverageCount;
				}
				// else remove 0

				currentP[0] = drawRect[0] + (cp - currentDraw.min[0])* currentDraw.scalingFactor[0];
				currentP[1] = drawRect[1] + drawRect[3] - (val - currentDraw.min[1]) * currentDraw.scalingFactor[1];
				ctx.lineTo(currentP[0], currentP[1]);
				ctx.fillRect(currentP[0] - 2, currentP[1] - 2, 4, 4);
				//ctx.arc(currentP[0], currentP[1],1.5, 0, Math.PI*2);
				ctx.moveTo(currentP[0], currentP[1]);
				set.ctxCoordinates.push([currentP[0], currentP[1], val]);
				
				
				//if (cp == fpow + currentDraw.binSize * 8)
				//	break;
			}

			ctx.stroke();
		}
		
	}
	

	// Clear non plot area
	ctx.clearRect(0,0, drawRect[0], ctxDim[1]);
	ctx.clearRect(drawRect[0] + drawRect[2],0, ctxDim[0] - drawRect[0] - drawRect[2], ctxDim[1]);
	ctx.clearRect(drawRect[0],0, drawRect[2], drawRect[1]);
	ctx.clearRect(drawRect[0],drawRect[1] + drawRect[3], drawRect[2], ctxDim[1] - drawRect[1] - drawRect[3]);
	
	// Tick labels
	ctx.fillStyle = tc.label;
	ctx.font = '12px Roboto';
	
	ctx.textAlign = 'center'	
	ctx.textBaseline = "top";
	for (var i=0, li = tickText[0].length; i < li; i++)
		ctx.fillText(tickText[0][i][1], tickText[0][i][0], drawRect[1] + drawRect[3] + 3, 80);
		
	if (currentDraw.preferedPixelSpacing[1] - 40 > 60) // Text is rotated
	{
		ctx.rotate(-Math.PI / 2);
		ctx.textBaseline = "bottom";
		for (var i=0, li = tickText[1].length; i < li; i++)
			ctx.fillText(tickText[1][i][1], -tickText[1][i][0], drawRect[0] - 3, currentDraw.preferedPixelSpacing[1] * 0.8);
		ctx.rotate(Math.PI / 2);
	}
	else // Text in normal plane
	{
		ctx.textAlign = 'right'	
		ctx.textBaseline = "middle";
		for (var i=0, li = tickText[1].length; i < li; i++)
			ctx.fillText(tickText[1][i][1], drawRect[0]-3, tickText[1][i][0], 25);
	}

	// Axis labels	
	ctx.textAlign = 'center'	
	ctx.textBaseline = "bottom";
	if (this.private.xlabel != null)
		ctx.fillText(String(this.private.xlabel), drawRect[0] + drawRect[2] / 2, ctxDim[1] - 2, drawRect[2]);
	ctx.textBaseline = "top";
	if (this.private.ylabel != null)
	{
		ctx.rotate(-Math.PI / 2);
		ctx.fillText(String(this.private.ylabel), -drawRect[1] - drawRect[3] / 2,2, drawRect[3]);
		ctx.rotate(Math.PI / 2);
	}


	// Legend
	ctx.textAlign = 'left'
	ctx.textBaseline = "middle";
	ctx.lineWidth = 1;
	if (this.private.legend == true) // on top
	{
		const l = drawRect[2] / (label.length + 1);
		for (var i = 0, li = label.length; i < li; i++)	
		{
			const set = this.private.sets[label[i]];
			// CTX properties
			ctx.strokeStyle = set.color;			
			ctx.setLineDash(set.style);

			const left = drawRect[0] + l*(i + 0.5); 

			ctx.beginPath();
			ctx.moveTo(left, 10);
			ctx.lineTo(left + 10, 10);
			ctx.arc(left + 10, 10, 1.5, 0, Math.PI*2);
			ctx.moveTo(left + 10, 10);
			ctx.lineTo(left + 20, 10);
			ctx.stroke();

			ctx.fillText(String(label[i]), left + 22, 10, l - 24);
		}
	}
	else if (this.private.legend == false)
	{
		const left = drawRect[0] + drawRect[2] + 2;
		const l = drawRect[3] / (label.length + 1);
		for (var i = 0, li = label.length; i < li; i++)	
		{
			const set = this.private.sets[label[i]];
			// CTX properties
			ctx.strokeStyle = set.color;			
			ctx.setLineDash(set.style);

			const center = drawRect[1] + 2 + l * (i + 1);

			ctx.beginPath();
			ctx.moveTo(left, center);
			ctx.lineTo(left + 10, center);
			ctx.arc(left + 10, center, 1.5, 0, Math.PI*2);
			ctx.moveTo(left + 10, center);
			ctx.lineTo(left + 20, center);
			ctx.stroke();

			ctx.fillText(String(label[i]), left + 22, center, 120 - 26);
		}
	}

	return true;
};


// Themes
Canvas2DChart.prototype.SetNormalTheme = function() {
	const tc = this.private.themeColor; // reference
	
	// Interaction
	tc.windowBorder = "rgba(0,0,0,0.4)";
	tc.interactionWindowBackgroud = "white";
	tc.interactionWindowText = "black";

	// Drawing
	tc.label = "black";
	tc.mainAxis = "black";
	tc.majorAxis =  "rgba(0,0,0,0.6)";
	tc.minorAxis = "rgba(128,128,128,0.6)";



};
Canvas2DChart.prototype.SetNightTheme = function() {
	const tc = this.private.themeColor; // reference
	
	// Interaction
	tc.interactionWindowBorder = "rgba(255,255,255,0.6)";
	tc.interactionWindowBackgroud = "black";
	tc.interactionWindowText = "white";

	// Drawing
	tc.label = "white";
	tc.mainAxis = "white";
	tc.majorAxis =  "rgba(255,255,255,0.6)";
	tc.minorAxis = "rgba(128,128,128,0.6)";




};


// Fast 2D chart constructs

// dataProccessingFunction(dataArray, atBegin)
Canvas2DChart.prototype.SetupDynamicDataAcquisition = function(baseRequestUrl, forwardRetrievalInterval, dataProccessingFunction, defaultViewRange, maxViewRange)
{
	var requestType = true; // true is forward, false is back
	var frTO = 0; // forward request timeout

	var fromExt = this.private.maxNumber[0] + 1; // JS epoch (devide by 1000 to get to UNIX EPOCH) (1ms resolution)
	var tillExt = this.private.minNumber[0];

	baseRequestUrl +=  baseRequestUrl.indexOf('?') == -1 ? '?' : '&';

	const chartLoader = document.createElement("DIV");
	chartLoader.className = "loader";
	chartLoader.style.display = 'none';
	this.private.chartDiv.appendChild(chartLoader);

	const _this = this;
	const xhrR = new XMLHttpRequest();
	const FRC = function(){
		frTO = 0;
		if (xhrR.readyState == 0 || xhrR.readyState == 4)
		{
			requestType = true;
			xhrR.open("GET", baseRequestUrl + "from=" + (fromExt / 1000));
			xhrR.send();
		}
	 };

	 xhrR.responseType = 'json';
	 xhrR.onerror = function(){
		 QuickNotification("Failed to gather data required for charts" + (requestType ? " will try again in 10 seconds" : " try later again"), 'w');
		 if (requestType)
		 {
			 window.setTimeout(function(){
				xhrR.open("GET", baseRequestUrl + "from=" + (fromExt / 1000));
				xhrR.send();
			 }, 1e3);
		 }
		 else
		 {
			chartLoader.style.display = 'none';
		 }
	 };
	 xhrR.onload = function(){
		if (xhrR.status != 200)
		{
			QuickNotification("Failed to collect data from server will try later again (server-side)", 'e');
			window.setTimeout(function(){
				xhrR.open("GET", baseRequestUrl + "from=" + (fromExt / 1000) + (requestType ? "" : "&till=" +  (tillExt / 1000)));
				xhrR.send();
			}, 5e3);
			return;
		}
		if (!xhrR.response.data.length)
		{
			if (requestType)
			{
				if (frTO == 0) frTO = window.setTimeout(FRC, forwardRetrievalInterval);
			}
			else
			{
				QuickNotification("No data beyond this point will be requested (time gap is too large)");
				chartLoader.style.display = 'none';
				tillExt = -1;
			}
			return;
		}

		dataProccessingFunction(xhrR.response.data, !requestType);
		
		if (requestType)
		{
			fromExt = _this.private.maxNumber[0] + 1;
			if (!_this.mouseOver)
			{
				_this.private.viewLim[0][1] = xhrR.response.data[xhrR.response.data.length - 1][xIndex];
				_this.private.viewLim[0][0] = _this.private.viewLim[0][1] - defaultViewRange;
				_this.DrawChart();
			}			
		}
		else
		{
			tillExt = _this.private.minNumber[0];
			_this.DrawChart();
		}
		
		if (frTO == 0 && forwardRetrievalInterval)
			frTO = window.setTimeout(FRC, forwardRetrievalInterval);	
		chartLoader.style.display = 'none';
	 };
	 
	 this.AddExplorerListener(function(xm, xM, ym, yM){ 
		const rrange = xM - xm; // requested range
		if (rrange > maxViewRange)
			return false;
		if (xm - rrange < tillExt)
		{
			if (xhrR.readyState == 0 || xhrR.readyState == 4)
			{
				requestType = false;
				xhrR.open("GET", baseRequestUrl + "from=" + ((tillExt - maxViewRange) / 1000) + "&till=" + (tillExt / 1000));
				xhrR.send();
			}
			if (xm <= _this.private.minNumber[0])
			{
				chartLoader.style.display = '';
				return false;
			}
		}
		return true;
	 });

	this.EnableExploration(this.XDIRECTION);
};
