"use strict"

// Singleton LocusZoom object to behave as a namespace for all instances contained herein
var LocusZoom = {};

LocusZoom.instances = {};

// Method to automatically detect divs by class and populate them with LocusZoom instances
LocusZoom.populate = function(class_name){
  if (typeof class_name === "undefined"){
    var class_name = "lz-instance";
  }
  d3.selectAll("div." + class_name).each(function(){
    LocusZoom.addInstance(this.id);
  });
}

// Method to instantiate a new LocusZoom instance
LocusZoom.addInstance = function(div_id){
  this.instances[div_id] = new LocusZoom.Instance(div_id);
}


// Object for storing current view parameters
/*
LocusZoom.view = {
  chromosome: 0,
  xscale: null,
  yscale: null,
  position_range: [0,0],
  data_array_index_range: [0,0],
  svg: { width: 700, height: 350 },
  margin: { top: 20, right: 30, bottom: 30, left: 40 }
};
*/

// Object for storing aggregated information about the data in the view
/*
LocusZoom.metadata = {
  position_range: [0,0],
  pvalue_range: [0,0]
};
*/

// var lzd = new LocusZoom.Data.Requester(LocusZoom.DefaultDataSources);

// To be migrated out into panel abstract class and beyond
function migrate_me(){

  // Set stage attributes
  this.view.stage = {
    width: this.view.svg.width - this.view.margin.left - this.view.margin.right,
    height: this.view.svg.height - this.view.margin.top - this.view.margin.bottom,
  };

  // Append stage clipping path
  this.svg.append("clipPath")
    .attr("class", "stage_clip")
    .append("rect")
    .attr("x", this.view.margin.left)
    .attr("y", this.view.margin.top)
    .attr("width", this.view.stage.width)
    .attr("height", this.view.stage.height);

  // Append stage group, apply clipping path
  this.svg
    .append("g")
    .attr("class", "stage")
    .attr("transform", "translate(" + this.view.margin.left +  "," + this.view.margin.top + ")")
    .attr("clip-path", "url(#" + svg_id + ".stage_clip)");

  // Store stage selector
  this.stage = d3.select("#" + svg_id + " g.stage");

  // Initialize axes
  this.view.xscale = d3.scale.linear().domain([0,1]).range([0, this.view.stage.width]);
  this.view.xaxis  = d3.svg.axis().scale(this.view.xscale).orient("bottom");
  this.view.yscale = d3.scale.linear().domain([0,1]).range([this.view.stage.height, 0]).nice();
  this.view.yaxis  = d3.svg.axis().scale(this.view.yscale).orient("left");

  // Append axes
  this.svg.append("g")
    .attr("class", "y axis")
    .attr("transform", "translate(" + this.view.margin.left + "," + this.view.margin.top + ")")
    .call(this.view.yaxis);
  this.svg.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(" + this.view.margin.left + "," + (this.view.svg.height - this.view.margin.bottom) + ")")
    .call(this.view.xaxis);

  /*
  this.stage.append("rect")
    .attr("x", 0 )
    .attr("y", 0 )
    .attr("width", this.view.stage.width)
    .attr("height", this.view.stage.height)
    .attr("fill", "rgba(160, 240, 190, 0.3)");
  */
  
  // Initialize zoom
  /*
  this.view.zoom = d3.behavior.zoom()
    .scaleExtent([1, 1])
    .x(this.view.xscale)
    .on('zoom', function() {
      //svg.select('.data').attr('d', line)
      console.log("zooming");
    });
  this.svg.call(this.view.zoom);
  */

};

// Map the LocusZoom SVG container to a new region (requires migration)
LocusZoom.mapTo = function(chromosome, new_start, new_stop){

  // Prepend region
  if (new_start < this.view.position_range[0]){
    var prepend = { start: new_start, stop: Math.min(new_stop, this.view.position_range[0]) };
    console.log("prepending region:");
    console.log(prepend);
    var lzd = new LZD();
    var prepend_promise = lzd.getData({start: prepend.start, stop: prepend.stop},
                                      ['id','position','pvalue','refAllele']);
    prepend_promise.then(function(data){
      LocusZoom.data = new_data.body.concat(LocusZoom.data);
      LocusZoom.view.data_array_index_range[0] = 0;
      LocusZoom.render();
    });
  }

  // Append region
  else if (new_stop > this.view.position_range[1]){
    var append = { start: Math.max(this.view.position_range[1], new_start), stop: new_stop };
    console.log("appending region:");
    console.log(append);
    var lzd = new LZD();
    var append_promise = lzd.getData({start: append.start, stop: append.stop},
                                     ['id','position','pvalue','refAllele']);
    append_promise.then(function(new_data){
      LocusZoom.data = LocusZoom.data.concat(new_data.body);
      LocusZoom.render();
    });
  }

  // This doesn't belong here...
  this.view.chromosome = chromosome;
  this.view.position_range = [new_start, new_stop];

}

// Draw (or redraw) axes and data
LocusZoom.render = function(){

  this.metadata.position_range = d3.extent(this.data, function(d) { return +d.position; } );
  this.metadata.pvalue_range = d3.extent(this.data, function(d) { return +d.log10pval; } );

  // Update axes
  this.view.xscale = d3.scale.linear()
    .domain([this.metadata.position_range[0], this.metadata.position_range[1]])
    .range([0, this.view.stage.width]);
  this.view.xaxis  = d3.svg.axis().scale(this.view.xscale).orient('bottom')
    .tickValues(d3.range(this.metadata.position_range[0], this.metadata.position_range[1], (this.metadata.position_range[1] - this.metadata.position_range[0]) / 10));
  this.svg.selectAll("g .x.axis").call(this.view.xaxis);

  this.view.yscale = d3.scale.linear()
    .domain([0, this.metadata.pvalue_range[1]])
    .range([this.view.stage.height, 0]);
  this.view.yaxis  = d3.svg.axis().scale(this.view.yscale).orient('left')
    .tickValues(d3.range(this.metadata.pvalue_range[0], this.metadata.pvalue_range[1], (this.metadata.pvalue_range[1] - this.metadata.pvalue_range[0]) / 4));
  this.svg.selectAll("g .y.axis").call(this.view.yaxis);

  // Render data
  this.stage
    .selectAll("circle.datum")
    .data(LocusZoom.data)
    .enter().append("circle")
    .attr("class", "datum")
    .attr("id", function(d){ return d.id; })
    .attr("cx", function(d){ return LocusZoom.view.xscale(d.position); })
    .attr("cy", function(d){ return LocusZoom.view.yscale(d.log10pval); })
    .attr("fill", "red")
    .attr("stroke", "black")
    .attr("r", 4);

  // Set zoom
  /*
  this.view.zoom = d3.behavior.zoom()
    .scaleExtent([1, 1])
    .x(this.view.xscale)
    .on('zoom', function() {
      svg.select('.datum').attr('d', line)
      console.log("zooming");
    });
  this.svg.call(this.view.zoom);
  */

  // Set drag
  this.drag = d3.behavior.drag()
    .on('drag', function() {
      var stage = d3.select('#'+this.id+' g.stage');
      var transform = d3.transform(stage.attr("transform"));
      transform.translate[0] += d3.event.dx;
      stage.attr("transform", transform.toString());
    }).on('dragend', function() {
      // mapTo new values
    });
  this.svg.call(this.drag);

}


////////////////////////////////////////////////////////
////////////////////////////////////////////////////////
////////////////////////////////////////////////////////

// Legace LocusZoom logic

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

/*
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
*/

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

//LocusZoom.Default = {};
//LocusZoom.Default.Viewer = LocusZoom.initD3Viewer;
//LocusZoom.Default.Viewer = LocusZoom.initCanvasViewer;
//LocusZoom.Default.Datasource = LocusZoom.Data.StaticLocal;
