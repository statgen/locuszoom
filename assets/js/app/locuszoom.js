"use strict";

// Singleton LocusZoom object to behave as a namespace for all instances contained herein
var LocusZoom = {};

LocusZoom.instances = {};

// Method to instantiate a new LocusZoom instance
LocusZoom.addInstance = function(div_id){
    this.instances[div_id] = new LocusZoom.Instance(div_id);
};

// Method to automatically detect divs by class and populate them with LocusZoom instances
LocusZoom.populate = function(class_name){
    if (typeof class_name === "undefined"){
        class_name = "lz-instance";
    }
    d3.selectAll("div." + class_name).each(function(){
        LocusZoom.addInstance(this.id);
        // Detect regon and map to it
        if (typeof this.dataset.region !== "undefined"){
            var region = this.dataset.region.split(":");
            region[1]  = region[1].split("-");
            LocusZoom.instances[this.id].mapTo(+region[0], +region[1][0], +region[1][1]);
        }
    });
};

//from http://www.html5rocks.com/en/tutorials/cors/
//and with promises from https://gist.github.com/kriskowal/593076
LocusZoom.createCORSPromise = function (method, url, body, timeout) {
	var response = Q.defer();
	var xhr = new XMLHttpRequest();
	if ("withCredentials" in xhr) {

		// Check if the XMLHttpRequest object has a "withCredentials" property.
		// "withCredentials" only exists on XMLHTTPRequest2 objects.
		xhr.open(method, url, true);

	} else if (typeof XDomainRequest != "undefined") {

		// Otherwise, check if XDomainRequest.
		// XDomainRequest only exists in IE, and is IE's way of making CORS requests.
		xhr = new XDomainRequest();
		xhr.open(method, url);

	} else {
		// Otherwise, CORS is not supported by the browser.
		xhr = null;
	}
	if (xhr) {
		xhr.onreadystatechange = function() {
			if (xhr.readyState === 4) {
				if (xhr.status === 200 || xhr.status === 0 ) {
					response.resolve(JSON.parse(xhr.responseText));
				} else {
					response.reject("HTTP" + xhr.status + " for " + url);
				}
			}
		};
		timeout && setTimeout(response.reject, timeout);
		body = typeof body !== "undefined" ? body : "";
		xhr.send(body);

	} 
	return response.promise;
};


////////////////////////////////////////////////////////
////////////////////////////////////////////////////////
////////////////////////////////////////////////////////

/*******************************************************
// Legacy LocusZoom Logic
// Commented so as not to throw linting noise. Purge?

LocusZoom.initCanvasViewer = function(holder, region) {
	var cv = $("<canvas>").attr({
		id: "lzplugin"
	}).css({
		width: 700 + "px",
		height: 275 + "px"
	});
	cv[0].width = 700;
	cv[0].height = 275;
	cv.appendTo(holder);
	var b = new Burlap.Burlap();
	var out = new Burlap.Canvas(cv[0]);
	var datasource = new LocusZoom.Data.StaticLocal();
	//var datasource = new LocusZoom.Data.LZAPI();
	
	var pval = datasource.fetchResults(1,region.chr, region.start, region.end);
	pval.then(function(x) {
		console.log("pvals loaded");
		var ld = datasource.getRefLD(3, "10:114885816_A/G", region.chr, region.start, region.end);
		ld.then( function(y) {
			console.log("ld loaded");

			x.log10pval = LocusZoom.Transform.NegLog10(x.pvalue);

			x.ld = LocusZoom.SortedLeftJoin(
				new LocusZoom.JSONIterator(x, function(z, i) {
					if(i < z.chr.length) {
						return({chr:z.chr[i], pos:z.position[i]});
					} else {
						return(null);
					}
				}, function() {return(0);}),
				new LocusZoom.JSONIterator(y, function(z, i) {
					return({chr:z.chromosome2[i],pos:z.position2[i]});
				}, function(z, i) {return(z.rsquare[i]);}),
				LocusZoom.GenomePosComparer,
				new LocusZoom.ArrayAccumulator()
			);
			

			//b.setDataRange(0,10,0,10)
			//b.setDisplayRange(0,dz.width*2, dz.height*2,0);
			b.addView("results").
				setShaper( Burlap.XYShaper("position","log10pval",x) ).
				addFormatter( Burlap.StaticFormatter({shape:"circle", size:4}) ).
				addFormatter( Burlap.NumericFormatter("ld","fillColor",[0,.2,.4,.6,.8,1],["lightgrey","purple","blue","green","orange","red", "lightgrey"],"lightgrey") );
				
			b.render(out);
		}).done();
	});
};

LocusZoom.Data = {};
LocusZoom.Data.LZAPI = function() {
	
	var result = null;

	var mergeLD = function(x, chr, start, end) {
		this.getRefLD(2, refvar, chr, start ,end).then(
			function(y) {}
		);
	};

	this.fetchResults = function(analysis, chr, start, end) {
		var url = "/api/v1/single/results?filter=analysis in 1 " + 
			"and chromosome in  '" + chr + "'" + 
			" and position ge " + start + 
			" and position le " + end;
		console.log(url);
		var ret = LocusZoom.createCORSPromise("GET",url)
			.then(function(x) {result = x; return(result);});
		return(ret);
	};

	this.getRefLD = function(pop, refvar, chr, start, end) {
		var url = "/api/v1/pair/LD/results?find=reference::2" + 
			"|chr::" + chr + 
			"|start::" + start + 
			"|end::" + end + 
			"|id1::" + refvar + 
			"&fields=chr,pos,rsquare";
		console.log(url);
		return(LocusZoom.createCORSPromise("GET",url));
	};
};

LocusZoom.Data.UM.ResultsFacade = function(x) {
	this.GetBestPvalue = function() {
		var bestidx = 0;
		for(var idx=0; idx < x.pvalue.length; idx++) {
			if(x.pvalue[idx] < x.pvalue[bestidx]) {
				bestidx = idx;
			}
		}
		return bestidx;
	}
}

LocusZoom.Data.StaticLocal = function() {

	this.fetchResults = function(analysis, chr, start, end) {
		var url = "staticdata/pval.json";
		console.log(url);
		return(LocusZoom.createCORSPromise("GET",url));

	};
	this.getRefLD = function(analysis, chr, start, end) {
		var url = "staticdata/ld.json";
		console.log(url);
		return(LocusZoom.createCORSPromise("GET",url));

	};
};

LocusZoom.Transform = {};
LocusZoom.Transform.NegLog10 = function(x) {
	var out = [];
	for (var i = 0; i< x.length; i++) {
		out.push(-Math.log(x[i]) / Math.LN10);
	}
	return(out);
};

LocusZoom.SortedLeftJoin = function(iteratorA, iteratorB, comparer, accumulator) {

	var comp;
	while(true) {
		comp = comparer(iteratorA.getKey(),iteratorB.getKey());
		if ( iteratorA.isDone() ) {
			break;
		}
		if(comp===0) {
			accumulator.add(iteratorB.getValue());
			iteratorA.moveNext();
			iteratorB.moveNext();
		} else if (comp<0) {
			accumulator.add(null);
			iteratorA.moveNext();
		} else {
			iteratorB.moveNext();
		}

	}
	return(accumulator.getValues());
};

LocusZoom.JSONIterator = function(data, keyExtractor, valExtractor) {
	var index = 0;
	var done = false;

	this.getKey = function() {
		var val = keyExtractor(data, index);
		if (!val) {
			done = true;
		}
		return(val);
	};

	this.getValue = function() {
		return(valExtractor(data, index));
	};

	this.moveNext = function() {
		index += 1;
	};

	this.isDone = function() {
		return(done);
	};

};

LocusZoom.ArrayAccumulator = function() {
	var vals = [];
	
	this.add = function(x) {
		vals.push(x);
	};
	
	this.getValues = function() {
		return(vals);
	};
};

LocusZoom.GenomePosComparer = function(a,b, chrVal, posVal) {
	chrVal = typeof chrVal !== "undefined" ? chrVal : "chr";
	posVal = typeof posVal !== "undefined" ? posVal : "pos";
	
	if (!a) {return(null);}
	if (!b) {return(null);}	

	if (a[[chrVal]] == b[[chrVal]]) {
		if(a[[posVal]] == b[[posVal]]) {
			return(0);
		} else if (a[[posVal]] < b[[posVal]]) {
			return(-1);
		} else {
			return(1);
		}
	} else {
		if (a[[chrVal]] < b[[chrVal]]) {
			return(-1);
		} else {
			return(1);
		}
	}
};

//LocusZoom.Default = {};
//LocusZoom.Default.Viewer = LocusZoom.initD3Viewer;
//LocusZoom.Default.Viewer = LocusZoom.initCanvasViewer;
//LocusZoom.Default.Datasource = LocusZoom.Data.StaticLocal;

*/