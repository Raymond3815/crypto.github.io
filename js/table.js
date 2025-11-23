function CreateTable(container, tableName, headerColumns)
{
	if (tableName)
	{
		const tableNameH = document.createElement("h1");
		tableNameH.innerText = tableName
		container.appendChild(tableNameH);
	}
	const tableH = document.createElement("table");
	tableH.style.width = "100%";
	container.appendChild(tableH);

	if (headerColumns && headerColumns.length)
	{
		const headerH = document.createElement("tr");
		headerH.className = "header";
		for (const i in headerColumns)
		{
			const colH = document.createElement("td");
			colH.innerText = headerColumns[i];
			headerH.appendChild(colH);
		}
		tableH.appendChild(headerH);
	}
	return tableH;
}
function GenerateTable(container, tableName, requestPath, columns, refreshInterval, dataInsertionCallback, dataSortingCallback, sinceSupport, hideOnEmpty)
{
	if (typeof(sinceSupport) == "undefined")
		sinceSupport = 0;
	// HTML
	const tableH = CreateTable(container, tableName, columns);

	// Javascript
	const xhr = new XMLHttpRequest();
	var lastSuccesfulResponse = sinceSupport;
	var data = [];
	xhr.responseType = 'json';
	xhr.onerror = function(){
		QuickNotification("Failed to generate table " + tableName + ", retrying in 10 seconds", 'w');
			window.setTimeout(function(){
				xhr.open("GET", requestPath + ((requestPath.indexOf('?') != -1) ? '&since=' : "?since=") + lastSuccesfulResponse);
				xhr.send();
			}, 10000);
			return;
	};

	xhr.onload = function(){
		if (parseInt(xhr.status / 200) != 1)
		{
			QuickNotification("Failed to generate table " + tableName + ", retrying in 10 seconds", 'e');
			window.setTimeout(function(){
				xhr.open("GET", requestPath + ((requestPath.indexOf('?') != -1) ? '&since=' : "?since=") + lastSuccesfulResponse);
				xhr.send();
			}, 10000);
			return;
		}
		lastSuccesfulResponse = (new Date(xhr.getResponseHeader("date"))).getTime() / 1000;

		if (!sinceSupport)
			data = [];
		if (!dataInsertionCallback)
		{
			if (isJsonObject(xhr.response) && 'data' in xhr.response)
			{
				for (const i in xhr.response.data)
					data.push(xhr.response.data[i]);
			}
			else
			{
				for (const i in xhr.response)
					data.push(xhr.response[i]);
			}
		}
		else
			dataInsertionCallback(xhr.response, data); // passed by reference
		if (dataSortingCallback)
			data.sort(dataSortingCallback);

		// Clearout table
		while (tableH.children.length > 1)
			tableH.removeChild(tableH.children[1]);

		for (const i in data)
		{
			const row = document.createElement("tr");
			row.style.width = "100%";
			if (columns && columns.length){
				if (data[i].length > columns.length)
					row.style.color = data[i][columns.length];
				for (const j in columns)
				{
					const col = document.createElement("td");
					col.innerText = data[i][j];
					row.appendChild(col);
				}
			}
			else{
				for (const it of data[i]){
					const col = document.createElement("td");
					col.innerText = it;
					row.appendChild(col);
				}
			}
			tableH.appendChild(row);
		}
		if (refreshInterval)
		{
			window.setTimeout(function(){
				xhr.open("GET", requestPath + ((requestPath.indexOf('?') != -1) ? '&since=' : "?since=") + lastSuccesfulResponse);
				xhr.send();
			}, refreshInterval);
		}
	};

	xhr.open("GET", requestPath + ((requestPath.indexOf('?') != -1) ? '&since=' : "?since=") + sinceSupport);
	xhr.send();

	return tableH;
}

function HtmlEfficientTableUpdate(table, alterationMatrix, indexColumn, skipHeader)
{
	const newElements = [];
	if (alterationMatrix.length == 0)
	{
		while(table.children.length > 1)
			table.removeChild(table.children[1]);
		return newElements;
	}	

	const li = alterationMatrix.length;	
	const oldTableLength = table.children.length;
	const newTableLength = li + (skipHeader ? 1 : 0);
	
	const al = alterationMatrix[0].length;
	for (var i = oldTableLength; i < newTableLength; i++)
	{
		// Simple insert i at back		
		table.appendChild(document.createElement("tr"));
		var nnR = table.children[i];
		for (var f=0; f < al; f++)
		{
			nnR.appendChild(document.createElement("td"));
		}
		
		newElements.push(nnR);				
	}	

	for (i = oldTableLength - newTableLength; i > 0; i--)
	{
		table.removeChild(table.lastChild);
	}

	// Alter all information
	const ic = indexColumn ? indexColumn : 0;
	var j = skipHeader ? 1 : 0;	
	for (i = 0; i < li; i++)
	{
		const r = table.children[j];
		r.dataset.id = alterationMatrix[i][ic];
		for (var f = 0; f < al; f++)
		{
			r.children[f].innerHTML = alterationMatrix[i][f];
		}
		
		j++;
	}


	return newElements;
}
function HtmlEfficientFixedTableUpdate(table, alterationMatrix, alterColumn, skipHeader)
{
	const li = alterationMatrix.length;
	if (!li)
		return;
	if (!alterColumn)
		alterColumn = [...alterationMatrix[0].keys()];
	
	const ac = alterColumn.length;

	var i = 0, j = skipHeader ? 1 : 0, f;	
	for (; i < li; i++)
	{
		for (f=0; f < ac; f++)
		{
			table.children[j].children[alterColumn[f]].innerText = alterationMatrix[i][f];
		}
		j++;
	}
}