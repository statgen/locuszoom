"use strict"

var LocusZoom = {};

// Array for storing all data points currently displayed in the view
LocusZoom.data = [];

// Object for storing current view parameters
LocusZoom.view = {
  chromosome: 0,
  position_range: [0,0],
  data_array_index_range: [0,0],
  svg: { width: 700, height: 350 },
  margin: { top: 20, right: 20, bottom: 50, left: 50 }
};

// Object for storing aggregated information about the data in the view
LocusZoom.metadata = {
  position_range: [0,0],
  pvalue_range: [0,0]
};

// Initialize the LocusZoom object and SVG container
LocusZoom.init = function(svg_id) {

  this.svg = d3.select("#" + svg_id);

  this.view.stage = {
    width: this.view.svg.width - this.view.margin.left - this.view.margin.right,
    height: this.view.svg.height - this.view.margin.top - this.view.margin.bottom,
  };

  this.svg
    .attr("width", this.view.width)
    .attr("height", this.view.height);

  this.svg.append("clipPath")
    .attr("class", "stage_clip")
    .append("rect")
    .attr("x", this.view.margin.left)
    .attr("y", this.view.margin.top)
    .attr("width", this.view.stage.width)
    .attr("height", this.view.stage.height);

  this.svg
    .append("g")
    .attr("class", "stage")
    .attr("transform", "translate(" + this.view.margin.left +  "," + this.view.margin.top + ")")
    .attr("clip-path", "url(#" + svg_id + ".stage_clip)");

  this.stage = d3.select("#" + svg_id + " g.stage");
  
};

// Map the LocusZoom SVG container to a new region
LocusZoom.mapTo = function(chromosome, new_start, new_end){

  // Prepend region
  if (new_start < this.view.position_range[0]){
    var prepend = { start: new_start, end: Math.min(new_end, this.view.position_range[0]) };
    console.log("prepending region:");
    console.log(prepend);
    var prepend_csv = this.streamData(chromosome, prepend.start, prepend.end);
    var prepend_data = d3.csv.parse(prepend_csv, function(d) {
      return new Datum(d);
    });
    this.data = prepend_data.concat(this.data);
    this.view.data_array_index_range[0] = 0;
  }

  // Append region
  if (new_end > this.view.position_range[1]){
    var append = { start: Math.max(this.view.position_range[1], new_start), end: new_end };
    console.log("appending region:");
    console.log(append);
    var append_csv = this.streamData(chromosome, append.start, append.end);
    var append_data = d3.csv.parse(append_csv, function(d) {
      return new Datum(d);
    });
    this.data = this.data.concat(append_data);
  }

  this.view.chromosome = chromosome;
  this.view.position_range = [new_start, new_end];

  this.metadata.position_range = d3.extent(this.data, function(d) { return +d.position; } );
  this.metadata.pvalue_range = d3.extent(this.data, function(d) { return +d.log10pval; } );

  var xscale = d3.scale.linear().domain([this.metadata.position_range[0], this.metadata.position_range[1]]).range([0, this.view.stage.width]);
  var yscale = d3.scale.linear().domain([0, this.metadata.pvalue_range[1]]).range([this.view.stage.height, 0]);

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

  var xaxis = d3.svg.axis().scale(xscale).orient('bottom').tickValues(d3.range(this.metadata.position_range[0], this.metadata.position_range[1], (this.metadata.position_range[1] - this.metadata.position_range[0]) / 10));
  var yaxis = d3.svg.axis().scale(yscale).orient('left').tickValues(d3.range(this.metadata.pvalue_range[0], this.metadata.pvalue_range[1], (this.metadata.pvalue_range[1] - this.metadata.pvalue_range[0]) / 4)).orient("left");

  var yAxis = d3.svg.axis().scale(yscale).ticks(4).orient("left");

  // Render data
  this.stage
    .selectAll("circle.datum")
    .data(LocusZoom.data)
    .enter().append("circle")
    .attr("class", "datum")
    .attr("id", function(d){ return d.id; })
    .attr("cx", function(d){ return xscale(d.position); })
    .attr("cy", function(d){ return yscale(d.log10pval); })
    .attr("fill", "red")
    .attr("stroke", "black")
    .attr("r", 4);

  this.svg.call(xaxis)
  this.svg.call(yaxis)

}

// Wrapper method to stream data by whatever means currently supported and just return it outright for handling elsewhere
LocusZoom.streamData = function(chromosome, start, end){
  var csv = mockCSV(chromosome, start, end);
  return csv;
}


LocusZoom.initContainer = function(x) {
	var reg = x.data("region");
	console.log(reg);
	var splitter = /^(.*):(.*)-(.*)$/;
	var match = splitter.exec(reg);
	LocusZoom.Default.Viewer(x, {chr:match[1], start:match[2], end:match[3]});
};

LocusZoom.initD3Viewer = function(holder, region) {
  
  // d3.csv("staticdata/pval.csv", function(d) {
  // 114560253 - 114959615

  var csv = mockCSV(114560253, 114959615);
  console.log(csv);
  LocusZoom.Data = d3.csv.parse(csv, function(d) {
    return new Datum(d);
  });

  metadataset.position_range = d3.extent(LocusZoom.Data, function(d) { return +d.position; } );
  metadataset.pvalue_range = d3.extent(LocusZoom.Data, function(d) { return +d.log10pval; } );

  var xt = d3.scale.linear().domain([metadataset.position_range[0], metadataset.position_range[1]]).range([0, width]);
  var yt = d3.scale.linear().domain([0, metadataset.pvalue_range[1]]).range([height, 0]);
  var yAxis = d3.svg.axis().scale(yt).ticks(4).orient("left");

  vis.append("g")
        .attr("class","y axis")
        .attr("transform", "translate(-10,0)")
        .call(yAxis);
      
  var rules = vis.selectAll("g.rule")
        .data(yt.ticks(4))
        .enter().append("svg:g")
        .attr("class","rule");
      
  rules.append("svg:line")
        .attr("y1", yt)
        .attr("y2", yt)
        .attr("x1", 0)
        .attr("x2", width-1);
      
  vis.selectAll("circle.datum")
        .data(LocusZoom.Data)
        .enter().append("circle")
        .attr("class", "datum")
        .attr("id", function(d){ return d.id; })
        .attr("cx", function(d){ return xt(d.position); })
        .attr("cy", function(d){ return yt(d.log10pval); })
        .attr("fill", "red")
        .attr("stroke", "black")
        .attr("r", 4);
      
};

// mockCSV(): Simple method for mocking quasi-realistic data for more rapid development
// Written with extremely poor working knowledge of the actual shape and behavior of such data. =P
//
// Arguments:
//   chromosome: integer value for a chromosome number (required)
//   min_position: integer value for lower position bound (required)
//   max_position: integer value for upper position bound (required)
var mockCSV = function(chromosome, min_position, max_position){

  var csv = "analysis,chr,id,position,pvalue,refAllele,refAlleleFreq,scoreTestStat";
  var random_nuc = function(exclude){
    var nucs = 'GATC';
    if (typeof exclude != 'undefined'){
      nucs = nucs.replace(exclude, '');
    }
    return nucs[Math.floor(Math.random()*nucs.length)];
  }

  var range = max_position - min_position;
  var points = Math.max(Math.round(Math.random()*Math.min(range, 4000)), 1);
  var step = range / (points * 1.1);

  for (var p = 1; p <= points; p++){

    // Analysis (TODO: mock something more realistic)
    var analysis = 1;
    // Chromosome
    var chr = chromosome;
    // Position
    var position = min_position + Math.ceil(p * step);
    // P-Value
    var pvalue = Math.max(Math.pow(Math.random(), 1.2), 0.0001).toFixed(4);
    // Reference / Variant Allele
    var ref_allele = random_nuc();
    var var_allele = random_nuc(ref_allele);
    if (Math.random() < 0.04){
      var ref_length = Math.ceil(Math.random() * 14);
      for (var n = 0; n < ref_length; n++){ ref_allele += random_nuc(); }
    }
    if (Math.random() < 0.04 && ref_allele.length == 1){
      var var_length = Math.ceil(Math.random() * 14);
      for (var n = 0; n < var_length; n++){ var_allele += random_nuc(); }
    }
    // Reference Allele Frequency
    var ref_allele_freq = Math.pow(Math.random(), 0.1).toFixed(4);
    // Score Test Stat (TODO: ???)
    var score_test_stat = '';
    // ID
    var id = chr + ":" + position + "_" + ref_allele  + '/' + var_allele
    if (Math.random() < 0.1 && ref_allele.length == 1 && var_allele.length == 1){
      id += '_';
      if (Math.random() > 0.5){
        id += 'SNP' + chr + '-' + (position + Math.ceil(Math.random() * 100));
      } else {
        id += 'rs' + Math.round(Math.random() * Math.pow(10, 8));
      }
    }

    // Append the completed line
    csv += "\n" + analysis + "," + chr + "," + id + "," + position + "," + pvalue + "," + ref_allele + "," + ref_allele_freq + "," + score_test_stat;

  }

  return csv;

}

////////////////////////////////////////////////////////

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

LocusZoom.Default = {};
LocusZoom.Default.Viewer = LocusZoom.initD3Viewer;
//LocusZoom.Default.Viewer = LocusZoom.initCanvasViewer;
LocusZoom.Default.Datasource = LocusZoom.Data.StaticLocal;
