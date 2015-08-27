var Burlap = {};

if (!Array.isArray) {
  Array.isArray = function(arg) {
    return Object.prototype.toString.call(arg) === '[object Array]';
  };
}

Burlap.isArray = Array.isArray;
Burlap.isNumber = function(value) {return typeof value === 'number';};
Burlap.isString = function(value) {return typeof value === 'string';}
Burlap.isObject = function(value) {return value !== null && typeof value === 'object'};
Burlap.isFunction = function(value) {return typeof value === 'function';};
Burlap.isUndefined = function(x) {return typeof(x)==="undefined"};
Burlap.isUndefinedOrNull = function(x) {return typeof(x)==="undefined" || x===null};
Burlap.anyMissing = function() {
	for(var i=0; i<arguments.length; i++) {
		if ( Burlap.isArray(arguments[i]) ) {
			var r = Burlap.anyMissing.apply(null, arguments[i]);
			if ( r ) {
				return true;
			}
		} else {
			if ( Burlap.isUndefinedOrNull(arguments[i]) ) {
				return true;
			}
		}
	}
	return false;
}

//for FireFox
if(CanvasRenderingContext2D && !CanvasRenderingContext2D.prototype.setLineDash) {
CanvasRenderingContext2D.prototype.setLineDash = function (x) {
  this.mozDash = x;
  }
}

Burlap.getProp = function(expr, obj, otherwise, fill) {
	var path;
	if ( Burlap.isString(expr) ) {
		path = expr.split(".");
	} else if ( Burlap.isNumber(expr) ) {
		path = [expr];
	} else {
		throw "Invalid first parameter type (must be number/string)";
	}
	if ( !Burlap.isObject(obj) ) {
		throw "Second paramenter must be object"
	}
	var node = obj;
	for(var i=0; i<path.length; i++) {
		if ( Burlap.isUndefined(node[path[i]]) ) {
			if ( fill ) {
				if ( Burlap.isObject(node) && !Burlap.isArray(node) ) {
					if ( i<path.length-1 ) {
						node = node[path[i]] = {};
					} else {
						node = node[path[i]] = otherwise;
					}
				} else {
					throw("Cannot fill property for non-object");
				}
			} else {
				return otherwise;
			}
		} else {
			node = node[path[i]]
		}
	}
	return node;
}
Burlap.getAccessor = function(expr, obj, cols) {
	//trivially wrap an array
	if ( Burlap.isArray(expr) ) {
		return {len:expr.length, get:function(i) {return(expr[i])}}
	}
	if ( Burlap.isNumber(expr) ) {
		expr = "[" + Math.floor(expr) + "]"
	}
	//replace "{name}" with "[index]" by looking up name in cols
	expr = expr.replace(/{([^}]+)}/g, function(x, p1) {
		var idx = -1;
		if ( Burlap.isArray(cols) ) {
			idx = cols.indexOf(p1);
		} else if ( Burlap.IsObject(cols) ) {
			idx =  cols[p1];
		}
		if ( !Burlap.isUndefinedOrNull(idx) && idx>-1) {
			return "[" + idx + "]"
		} else {
			throw "Cannot find index for col '" + p1 + "' in expression '" + expr + "'";
		}
	})
	if ( expr.indexOf("[]") == -1 )  {
		if ( Burlap.isArray(obj) ) {
			expr = "[]" + expr;
		} else {
			expr = expr + "[]"
		}
	}
	//find array length
	if ( expr.charAt(0) != "[" ) {
		expr = "." + expr
	}
	var arrpath = expr.substr(0,expr.indexOf("[]"));
	eval("var arr = obj" + arrpath);
	if ( Burlap.isUndefinedOrNull(arr) || !Burlap.isArray(arr)) {
		throw ("Cannot find array at " + expr)
	}
	var len = arr.length;
	//create accessor function
	expr = expr.replace("[]", "[_i_]")
	eval("var g = function(_i_) {return(obj" + expr + ")}")
	return {len:len, get:g};
}

Burlap.mergeRange = function(a,b) {
	var r = [null,null];
	if ( Burlap.isUndefinedOrNull(a) ) {
		a = [null, null];
	}
	if ( Burlap.isUndefinedOrNull(b) ) {
		b = [null, null];
	}
	if ( b[0]===null || (a[0] !=null && a[0]<b[0] )) {
		r[0]=a[0];
	} else {
		r[0]=b[0];
	}
	if ( b[1]===null || (a[1] !=null && a[1]>b[1]) ) {
		r[1] = a[1];
	} else {
		r[1] = b[1];
	}
	return r;
}
Burlap.patchRange = function(a,b) {
	var r;
	if ( Burlap.isUndefinedOrNull(a) ) {
		a = [null, null];
	}
	if ( Burlap.isUndefinedOrNull(b) ) {
		b = [null, null];
	}
	r = a.slice(0);
	if ( r[0]==null ) {
		r[0] = b[0];
	}
	if ( r[1]==null ) {
		r[1] = b[1];
	}
	return r
}

Burlap.Burlap = function() {
	var views = [];
	var currentViewIndex = -1;
	var syncXAxisGroup = true;
	var syncYAxisGroup = true;

	//views
	function addView(x) {
		//TODO: these should not be hard-coded
		if ( syncXAxisGroup  || syncYAxisGroup ) {
			if ( currentViewIndex >-1 ) {
				var cv = getCurrentView();
				if ( syncXAxisGroup && cv.xgroup ) {
					Burlap.getProp("xgroup", x, cv.xgroup, true);
				}
				if ( syncYAxisGroup && cv.ygroup ) {
					Burlap.getProp("ygroup", x, cv.ygroup, true);
				}
			} else {
				x.xgroup=1;
				x.ygroup=1;
			}
		}
		x.shaper = x.shaper || {};
		views.push( x );
		currentViewIndex = views.length-1;
	}
	function getCurrentView() {
		if (currentViewIndex<0) {
			addView( {name:"default"} );
		}
		return getView(currentViewIndex);
	}
	function findView(view) {
		if ( Burlap.isString(view) ) {
			for ( var i=0; i<views.length; i++ ) {
				if ( views[i].name && views[i].name==view ) {
					return i;
				}
			}
			return -1;
		} else if ( Burlap.isNumber(view) ) {
			if ( view>-1 && view<views.length) {
				return view;
			} else {
				return -1;
			}
		} else {
			return -1;
		}
	}
	function getView(i) {
		return views[i];
	}
	this.addView = function(x) {
		if (Burlap.isString(x)) {
			addView({name:name});
		} else {
			addView(x);
		}
		return this;
	}
	this.setView = function(view) {
		var i = findView(view);
		if ( i>-1 ) {
			currentViewIndex = i;
		} else {
			throw "Cound not find view: " + view;
		}
		return this;
	}
	this.setAxisGroupX = function(group) {
		var cv = getCurrentView();
		cv.xgroup = group;
	}
	this.setAxisGroupY = function(group) {
		var cv = getCurrentView();
		cv.ygroup = group;
	}
	this.setAxisGroup = function(a) {
		var cv = getCurrentView();
		cv.xgroup = Burlap.getProp("x",a,cv.xgroup || 0);
		cv.ygroup = Burlap.getProp("y",a,cv.ygroup || 0);
	}
	this.shouldSyncAxis = function(a,b) {
		if ( Burlap.isUndefinedOrNull(a) ) {
			throw "Invalid parameter";
		}
		if ( Burlap.isUndefinedOrNull(b) ) {
			b = a;
		}
		syncXAxisGroup = a;
		syncYAxisGroup = b;
	}

	//data ranges
	this.setDataRange = function(a,b,c,d) {
		setRange("data",a,b,c,d);
		return this;
	}
	this.setDataXRange = function(a,b) {
		setAxisRange("data","x",a,b);
		return this;
	}
	this.setDataYRange = function(a,b) {
		setAxisRange("data","y",a,b);
		return this;
	}
	this.setDisplayRange = function(a,b,c,d) {
		setRange("display",a,b,c,d);
		return this;
	}
	this.setDisplayXRange = function(a,b) {
		setAxisRange("display","x",a,b);
		return this;
	}
	this.setDisplayYRange = function(a,b,c,d) {
		setAxisRange("display","y",a,b);
		return this;
	}

	function setAxisRange(domain, axis, a,b) {
		var cv = getCurrentView();
		if(Burlap.isArray(a)) {
			b = a[1];
			a = a[0];
		} else if (Burlap.isUndefined(a) || Burlap.isUndefined(b)) {
			throw("Invalid parameters");
		}
		var axisRange = Burlap.getProp(domain + "Range."+axis,cv,[null,null],true);
		if (a != null) {
			axisRange[0] = a;
		} 
		if (b != null) {
			axisRange[1] = b;
		}
	}
	function setRange(domain, a,b,c,d) {
		if ( Burlap.isArray(a) && Burlap.isArray(b) ) {
			d=b[1];
			c=b[0];
			b=a[1];
			a=a[0];
		} else if ( Burlap.isUndefined(a) || Burlap.isUndefined(b)  ||
			Burlap.isUndefined(c) || Burlap.isUndefined(d) ) {

			throw("Invalid parameters")

		}
		setAxisRange(domain,"x",a,b);
		setAxisRange(domain,"y",c,d);
	}
	function getAxisRange(domain, axis, view) {
		view = (Burlap.isUndefined(view)) ? currentViewIndex : view;
		var start=null, stop=null;
		var axisRange = Burlap.getProp(domain+"Range."+axis,getView(view),[null,null]);
		start = axisRange[0];
		stop = axisRange[1];
		return [start, stop];
	}

	function project(x,from,to) {
		var d = (x-from[0])/(from[1]-from[0]);
		return d*(to[1]-to[0]) + to[0];
	}

	function getDataTranslator(direction, view) {
		view = view || currentViewIndex;
		var dataRanges = calculateDataRanges();	
		var displayRanges = calculateDisplayRanges();

		var from, to;
		if (direction == "datatodisplay") {
			from = dataRanges[view]; 
			to = displayRanges[view];
		} else if (direction == "displaytodata") {
			from = displayRanges[view];
			to = dataRanges[view];
		} else {
			throw "Invalid direction: " + direction;
		}
		var tr = getTranslator(from.x, to.x, from.y, to.y);	
		return tr;
	}

	function getTranslator(fromX, toX, fromY, toY) {
		return function(a,b) {
			if ( Burlap.isUndefined(a) ) {
				throw("Missing parameters");
			}
			if ( Burlap.isArray(a) ) {
				b=a[1];
				a=a[0];
			}
			if ( Burlap.isUndefinedOrNull(b) ) {
				return project(a, fromX, toX);
			} else if ( a==null ) {
				return project(b, fromY, toY);
			} else {
				return [project(a, fromX, toX), project(b,fromY,toY)];
			}
		}
	}

	this.dataToDisplay = function(a,b) {
		var tr = getDataTranslator("datatodisplay");
		return tr(a,b);
	}
	this.displayToData = function(a,b) {
		var tr = getDataTranslator("displaytodata");
		return tr(a,b);
	}

	//shapers
	this.setShaper = function(shaper) {
		var cv = getCurrentView();
		cv.shaper = shaper;
		return this;
	}

	//formatters
	this.addFormatter = function(formatter) {
		var cv = getCurrentView();
		var fmts = cv.formatters = cv.formatters || [];
		fmts.push(formatter);
		return this;
	}

	//render
	function calculateDataRanges() {
		var view, cv, shaper;
		var canGrowX=false, canGrowY=true;
		var xGroups={}, yGroups={};
		var combineX = (canGrowX) ? Burlap.mergeRange : Burlap.patchRange;
		var combineY = (canGrowY) ? Burlap.mergeRange : Burlap.patchRange;
		var ranges = [];
		//first, calculate data ranges for each view
		for(view=0; view<views.length; view++) {
			cv = getView(view)
			shaper = cv.shaper;
			if (shaper) {
				var xr = getAxisRange("data","x",view)
				var yr = getAxisRange("data","y",view)
				if (shaper.datarange) {
					var wx = (canGrowX) ? [null,null] : xr;
					var wy = (canGrowY) ? [null,null] : yr;
					var dr = shaper.datarange(wx,wy);
					xr = combineX(xr, dr.x);
					yr = combineY(yr, dr.y);
				}
				ranges.push({x: xr, y:yr});
				if (cv.xgroup) {
					var gxr = Burlap.getProp(cv.xgroup, xGroups, null, true);
					xGroups[cv.xgroup] = combineX(gxr, xr);
				}
				if (cv.ygroup) {
					var gyr = Burlap.getProp(cv.ygroup, yGroups, null, true);
					yGroups[cv.ygroup] = combineY(gyr, yr);
				}
			} else {
				ranges.push(null);
			}
		}
		//now re-set shared axis
		for(view=0; view<views.length; view++) {
			cv = getView(view);
			if (cv.shaper) {
				if (cv.xgroup) {
					ranges[view].x = xGroups[cv.xgroup];
				}
				if (cv.ygroup) {
					ranges[view].y = yGroups[cv.ygroup];
				}
				if ( Burlap.anyMissing(ranges[view].x, ranges[view].y) ) {
					throw "Unable to calculate data range for view " + cv.name || view;
				}
			}
		}
		return ranges;
	}
	function calculateDisplayRanges(xbounds, ybounds) {
		var view, cv;
		var ranges = [];
		for(view=0; view<views.length; view++) {
			cv = getView(view);
			if (cv.shaper) {
				var xr = getAxisRange("display","x",view);
				var yr = getAxisRange("display","y",view);
				xr = Burlap.patchRange(xr,xbounds);
				yr = Burlap.patchRange(yr,ybounds);
				if ( Burlap.anyMissing(xr, yr) ) {
					throw "Unable to calculate display range for view " + cv.name || view;
				}
				ranges.push({x:xr, y:yr})
			} else {
				ranges.push(null);
			}

		}
		return ranges;
	}


	this.render = function(ctx) {
		var cv, shaper;
		//calculate ranges; 
		var dataRanges = calculateDataRanges();	
		var ctxbounds = ctx.getBounds();
		var displayRanges = calculateDisplayRanges(ctxbounds.x, ctxbounds.y);	
		//draw data
		for(var view=0; view<views.length; view++) {
			cv = getView(view)
			shaper = cv.shaper;
			if (shaper && shaper.call) {
				var tr = getTranslator(dataRanges[view].x, displayRanges[view].x,
					dataRanges[view].y, displayRanges[view].y);	
				var fmts = cv.formatters || [];
				for(var i=0; i<fmts.length; i++) {
					if( Burlap.isFunction(fmts[i]) ) {
						fmts[i] = {format: fmts[i]}
					} else if ( Burlap.isObject(fmts[i]) && fmts[i].link) {
						fmts[i].link(shaper.data, shaper.headers);
					}
				}
				for(var i=0; i<shaper.iterations; i++) {
					var pt = shaper.call(i, shaper.data, tr);
					for(var j=0; j<fmts.length; j++) {
						pt = fmts[j].format(pt, i, shaper.data, shaper.headers);
					}
					ctx.render(pt);
				}
			}
		}
	}

	this.dump = function() {
		return views;
	}

}

Burlap.ShapePaths = {
	"circle": function(x,y,size) {
		return {type: "arc", start:0, stop:2*Math.PI, x:x, y:y, r:size}
	},
	"square": function(x,y,size) {
		return {type: "path", closed: true, 
			x: [x-size, x+size, x+size, x-size],
			y: [y-size, y-size, y+size, y+size]
		}
	},
	"diamond": function(x,y,size) {
		var d = Math.sqrt(2)*size;
		return {type: "path", closed: true, 
			x: [x-d, x, x+d, x],
			y: [y, y-d, y, y+d]
		}
	},
	"tridown": function(x,y,size) {
		var d = size/Math.sqrt(3)*2;
		return {type: "path", closed: true, 
			x: [x-d, x+d, x],
			y: [y-size, y-size, y+size]
		}
	},
	"triup": function(x,y,size) {
		var d = size/Math.sqrt(3)*2;
		return {type: "path", closed: true, 
			x: [x-d, x+d, x],
			y: [y+size, y+size, y-size]
		}
	}, 
	"cross": function(x,y,size) {
		var a = 3/Math.sqrt(5);
		var d1 = size*a;
		var d2 = size*a/3;
		return {type: "path", closed: true, 
			x: [x-d2, x+d2, x+d2, x+d1, x+d1, x+d2, x+d2, x-d2, x-d2, x-d1, x-d1, x-d2],
			y: [y-d1, y-d1, y-d2, y-d2, y+d2, y+d2, y+d1, y+d1, y+d2, y+d2, y-d2, y-d2]
		}
	}
}

Burlap.PDF = function() {
	this.pdf = new jsPDF("p","pt","letter");
	this.defaultSize = 4;
	var _this = this;

	this.getBounds = function() {
		return {x:[25, 175], y: [175, 25]};
	}

	var getLines = function(path) {
		var xs = path.x;
		var ys = path.y;
		var lines = [[0,0]];
		for(var i=1; i<xs.length; i++) {
			lines.push([xs[i]-xs[i-1], ys[i]-ys[i-1]])
		}
		if (path.closed) {
			lines.push([xs[0]-xs[xs.length-1], ys[0]-ys[ys.length-1]])
		};
		return {x:xs[0], y:ys[0], lines:lines};
	}

	this.renderPath = function(path) {
		var lines = getLines(path);
		this.pdf.lines(lines.lines, lines.x, lines.y, [1,1],"DF")
	}

	this.renderArc = function(path, filled) {
		this.pdf.circle(path.x, path.y, path.r || this.defaultSize, "DF")
	}

	this.renderShape = function(shape, filled) {
		var paths = Burlap.ShapePaths[shape.shape](shape.x, shape.y, shape.size||this.defaultSize);
		if(!Burlap.isArray(paths) ) {
			paths = [paths];
		}
		for(var i=0; i<paths.length; i++) {
			if (paths[i].type=="arc") {
				this.renderArc(paths[i], filled)
			} else if (paths[i].type=="path") {
				this.renderPath(paths[i], filled)
			}
		}
	}

	this.render = function(instr) {
		if (!Burlap.isArray(instr)) {
			instr = [instr];
		}
		for(var i =0; i<instr.length; i++) {
			var pt = instr[i];
			var filled = false;
			if(pt.fillColor) {
				//this.pdf.setFillColor(pt.fillColor);
				var col = colorToRGB(pt.fillColor);
				this.pdf.setFillColor(col[0],col[1],col[2]);
				filled = true;
			}
			if(pt.shape) {
				this.renderShape(pt, filled);
			} else {
				this.renderArc(pt, filled);
			}
		}
	}

	this.toscreen = function() {
		
		window.open(this.pdf.output("datauristring"));
	}
}

Burlap.Canvas = function(cv) {
	this.canvas = cv;
	this.context = cv.getContext('2d');

	this.getBounds = function() {
		return {x:[0, this.canvas.width], y: [this.canvas.height, 0]};
	}

	this.renderPath = function(ctx, path) {
		ctx.moveTo(path.x[0], path.y[0]);
		for(var i=1; i<path.x.length; i++) {
			ctx.lineTo(path.x[i], path.y[i]);
		}
	}

	this.renderArc = function(ctx, path) {
		ctx.arc(path.x, path.y, path.r || 5, path.start || 0, path.end || 2*Math.PI)
	}

	this.renderShape = function(ctx, shape) {
		var paths = Burlap.ShapePaths[shape.shape](shape.x, shape.y, shape.size||5);
		if(!Burlap.isArray(paths) ) {
			paths = [paths];
		}
		ctx.beginPath();
		for(var i=0; i<paths.length; i++) {
			if (paths[i].type=="arc") {
				this.renderArc(ctx, paths[i])
			} else if (paths[i].type=="path") {
				this.renderPath(ctx, paths[i])
			}
		}
		ctx.closePath();
	}

	this.render = function(instr) {
		if (!Burlap.isArray(instr)) {
			instr = [instr];
		}
		for(var i =0; i<instr.length; i++) {
			var pt = instr[i];
			if(pt.shape) {
				this.renderShape(this.context, pt);
			} else {
				this.context.beginPath();
				this.renderArc(this.context, pt);
				this.context.closePath();
			}
			if(pt.fillColor) {
				this.context.fillStyle = pt.fillColor;
				this.context.fill();
			}
			this.context.stroke();
		}
	}
}

Burlap.StaticFormatter = function(obj) {
	return function(pt) {
		for(key in obj) {
			if ( obj.hasOwnProperty(key) ) {
				pt[key] = obj[key];
			}
		}
		return pt;
	}
}

Burlap.NumericFormatter = function(datacol, ptproperty, databreaks, pointvalues, pointnullvalue) {
	if (databreaks.length != pointvalues.length-1) {
		throw "Length of values must be one more than length of breaks";
	}

	pointnullvalue = pointnullvalue || null;

	//breaks: [a,b,c]
	//groups: (-inf,a], (a,b], (b,c], (c,inf)
	var lookup = function(x) {
		if ( Burlap.isUndefinedOrNull(x) ) {
			return pointnullvalue;
		}
		var i=0;
		while( i<databreaks.length && x > databreaks[i]) {
			i++
		}
		return pointvalues[i];
	}

	var acc;

	return {
		link: function(data,headers) {
			acc = Burlap.getAccessor(datacol, data,headers);
		},
		format: function(pt,i) {
			if(acc) {
				var val = lookup(acc.get(i));
				if (val != null) {
					pt[ptproperty] = val;
				}
			}
			return pt;
		}
	}
}

Burlap.CategoricalFormatter = function(datacol, ptproperty, datavalues, pointvalues, pointothervalue, pointnullvalue) {
	if (datavalues.length != pointvalues.length) {
		throw "Length of values does not match length of categories";
	}

	pointnullvalue = pointnullvalue || null;
	pointothervalue = pointothervalue || null;

	var lookup = function(x) {
		if ( Burlap.isUndefinedOrNull(x) ) {
			return pointnullvalue;
		}
		for(var i=0; i<datavalues.length; i++ ) {
			if (x==datavalues[i]) {
				return pointvalues[i];
			}
		}
		return pointothervalue;
	}

	var acc;
	var decorate;
	if ( Burlap.isArray(ptproperty) ) {
		if (pointothervalue) {
			if( !Burlap.isArray(pointothervalue) || pointothervalue.length != ptproperty.length ) {
				throw "Number of properties and number of values in 'other' do not match"
			}
		}
		if (pointnullvalue) {
			if( !Burlap.isArray(pointnullvalue) || pointnullvalue.length != ptproperty.length ) {
				throw "Number of properties and number of values in 'null' do not match"
			}
		}
		for (var i=0; i<pointvalues.length; i++) {
			if ( !Burlap.isArray(pointvalues) || pointvalues[i].length != ptproperty.length ) {
				throw "Number of properties and number of values in group " + i + " do not match";
			}
		}
		decorate = function(pt, val) {
			for(var i=0; i<ptproperty.length; i++) {
				pt[ptproperty[i]] = val[i];
			}
		}
	} else {
		decorate = function(pt, val) {
			pt[ptproperty] = val;
		}
	}

	return {
		link: function(data, headers) {
			acc = Burlap.getAccessor(datacol, data, headers)
		},
		format: function(pt,i) {
			if(acc) {
				var val = lookup(acc.get(i));
				if (val != null) {
					decorate(pt, val);
				}
			}
			return pt;
		}
	}
}

Burlap.isInRange = function(a, r1, r2) {
	if ( Burlap.isUndefinedOrNull(r1) && Burlap.isUndefinedOrNull(r2)) {
		return true;
	}
	if (Burlap.isArray(r1)) {
		r2 = r1[1];
		r1 = r1[0];
	}
	if (r1 !== null && a<r1) {
		return false;
	}
	if (r2 !== null && a>r2) {
		return false;
	}
	return true;
}

Burlap.XYShaper = function(xcol, ycol, data, headers) {
	var xdata, ydata;
	xdata = Burlap.getAccessor(xcol,data,headers)
	ydata = Burlap.getAccessor(ycol,data,headers);
	if ( xdata.len != ydata.len ) {
		throw("x and y length must be equal");
	}
	return {
		iterations: xdata.len,
		data: data,
		headers: headers,
		datarange: function(withinX, withinY) {

			var xmin=Number.MAX_VALUE, xmax=Number.MIN_VALUE;
			var ymin=Number.MAX_VALUE, ymax=Number.MIN_VALUE;

			for(var i=0; i<xdata.len; i++) {
				if (Burlap.isInRange(xdata.get(i), withinX) && 
					Burlap.isInRange(ydata.get(i), withinY)) {

					if (xdata.get(i)<xmin) {xmin = xdata.get(i)}
					if (xdata.get(i)>xmax) {xmax = xdata.get(i)}
					if (ydata.get(i)<ymin) {ymin = ydata.get(i)}
					if (ydata.get(i)>ymax) {ymax = ydata.get(i)}				
				}
			}

			return {x:[xmin, xmax], y:[ymin, ymax]}

		},
		call: function(i, data, tr) {
			return {x: tr(xdata.get(i)), y: tr(null,ydata.get(i))};
		}
	}
}

function colorToRGB(colour) {
    var colours = {
        "aliceblue": "#f0f8ff",
        "antiquewhite": "#faebd7",
        "aqua": "#00ffff",
        "aquamarine": "#7fffd4",
        "azure": "#f0ffff",
        "beige": "#f5f5dc",
        "bisque": "#ffe4c4",
        "black": "#000000",
        "blanchedalmond": "#ffebcd",
        "blue": "#0000ff",
        "blueviolet": "#8a2be2",
        "brown": "#a52a2a",
        "burlywood": "#deb887",
        "cadetblue": "#5f9ea0",
        "chartreuse": "#7fff00",
        "chocolate": "#d2691e",
        "coral": "#ff7f50",
        "cornflowerblue": "#6495ed",
        "cornsilk": "#fff8dc",
        "crimson": "#dc143c",
        "cyan": "#00ffff",
        "darkblue": "#00008b",
        "darkcyan": "#008b8b",
        "darkgoldenrod": "#b8860b",
        "darkgray": "#a9a9a9",
        "darkgreen": "#006400",
        "darkkhaki": "#bdb76b",
        "darkmagenta": "#8b008b",
        "darkolivegreen": "#556b2f",
        "darkorange": "#ff8c00",
        "darkorchid": "#9932cc",
        "darkred": "#8b0000",
        "darksalmon": "#e9967a",
        "darkseagreen": "#8fbc8f",
        "darkslateblue": "#483d8b",
        "darkslategray": "#2f4f4f",
        "darkturquoise": "#00ced1",
        "darkviolet": "#9400d3",
        "deeppink": "#ff1493",
        "deepskyblue": "#00bfff",
        "dimgray": "#696969",
        "dodgerblue": "#1e90ff",
        "firebrick": "#b22222",
        "floralwhite": "#fffaf0",
        "forestgreen": "#228b22",
        "fuchsia": "#ff00ff",
        "gainsboro": "#dcdcdc",
        "ghostwhite": "#f8f8ff",
        "gold": "#ffd700",
        "goldenrod": "#daa520",
        "gray": "#808080",
        "green": "#008000",
        "greenyellow": "#adff2f",
        "honeydew": "#f0fff0",
        "hotpink": "#ff69b4",
        "indianred ": "#cd5c5c",
        "indigo": "#4b0082",
        "ivory": "#fffff0",
        "khaki": "#f0e68c",
        "lavender": "#e6e6fa",
        "lavenderblush": "#fff0f5",
        "lawngreen": "#7cfc00",
        "lemonchiffon": "#fffacd",
        "lightblue": "#add8e6",
        "lightcoral": "#f08080",
        "lightcyan": "#e0ffff",
        "lightgoldenrodyellow": "#fafad2",
        "lightgrey": "#d3d3d3",
        "lightgreen": "#90ee90",
        "lightpink": "#ffb6c1",
        "lightsalmon": "#ffa07a",
        "lightseagreen": "#20b2aa",
        "lightskyblue": "#87cefa",
        "lightslategray": "#778899",
        "lightsteelblue": "#b0c4de",
        "lightyellow": "#ffffe0",
        "lime": "#00ff00",
        "limegreen": "#32cd32",
        "linen": "#faf0e6",
        "magenta": "#ff00ff",
        "maroon": "#800000",
        "mediumaquamarine": "#66cdaa",
        "mediumblue": "#0000cd",
        "mediumorchid": "#ba55d3",
        "mediumpurple": "#9370d8",
        "mediumseagreen": "#3cb371",
        "mediumslateblue": "#7b68ee",
        "mediumspringgreen": "#00fa9a",
        "mediumturquoise": "#48d1cc",
        "mediumvioletred": "#c71585",
        "midnightblue": "#191970",
        "mintcream": "#f5fffa",
        "mistyrose": "#ffe4e1",
        "moccasin": "#ffe4b5",
        "navajowhite": "#ffdead",
        "navy": "#000080",
        "oldlace": "#fdf5e6",
        "olive": "#808000",
        "olivedrab": "#6b8e23",
        "orange": "#ffa500",
        "orangered": "#ff4500",
        "orchid": "#da70d6",
        "palegoldenrod": "#eee8aa",
        "palegreen": "#98fb98",
        "paleturquoise": "#afeeee",
        "palevioletred": "#d87093",
        "papayawhip": "#ffefd5",
        "peachpuff": "#ffdab9",
        "peru": "#cd853f",
        "pink": "#ffc0cb",
        "plum": "#dda0dd",
        "powderblue": "#b0e0e6",
        "purple": "#800080",
        "red": "#ff0000",
        "rosybrown": "#bc8f8f",
        "royalblue": "#4169e1",
        "saddlebrown": "#8b4513",
        "salmon": "#fa8072",
        "sandybrown": "#f4a460",
        "seagreen": "#2e8b57",
        "seashell": "#fff5ee",
        "sienna": "#a0522d",
        "silver": "#c0c0c0",
        "skyblue": "#87ceeb",
        "slateblue": "#6a5acd",
        "slategray": "#708090",
        "snow": "#fffafa",
        "springgreen": "#00ff7f",
        "steelblue": "#4682b4",
        "tan": "#d2b48c",
        "teal": "#008080",
        "thistle": "#d8bfd8",
        "tomato": "#ff6347",
        "turquoise": "#40e0d0",
        "violet": "#ee82ee",
        "wheat": "#f5deb3",
        "white": "#ffffff",
        "whitesmoke": "#f5f5f5",
        "yellow": "#ffff00",
        "yellowgreen": "#9acd32"
    };

	var hex;
	if (colour[0]=="#") {
		hex = colour;
	} else if (typeof colours[colour.toLowerCase()] != 'undefined')  {
		hex = colours[colour.toLowerCase()];
	} else {
		return false;
	}
	return [parseInt(hex.substring(1,3),16),
		parseInt(hex.substring(3,5),16),
		parseInt(hex.substring(5),16)]

    return false;
}
