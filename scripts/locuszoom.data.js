"use strict";

LocusZoom.Data = LocusZoom.Data ||  {};

LocusZoom.Data.Requester = function(sources) {

	function split_requests(fields) {
		var requests = {base: []};
		fields.forEach(function(field) {
			var parts = field.split(/\:(.*)/);
			if (parts.length==1) {
				requests.base.push(field);
			} else {
				if (typeof requests[parts[0]] =="undefined") {
					requests[parts[0]] = [];
				}
				requests[parts[0]].push(parts[1]);
			}
		});
		return requests;
	}
	
	this.getData = function(state, fields) {
		var requests = split_requests(fields);
		var promises = Object.keys(requests).map(function(key) {
			return sources[key].getData(state, requests[key])
		})
		return Q.all(promises);
	}
}

LocusZoom.Data.AssociationSource = function(url) {
	this.url = url;

	this.getData = function(state, fields) {
		var requrl = this.url + "results?filter=analysis in 1 " + 
			"and chromosome in  '" + state.chr + "'" + 
			" and position ge " + state.start + 
			" and position le " + state.end;
		//var ret = LocusZoom.createCORSPromise("GET",url);
		var ret = LocusZoom.createResolvedPromise("GET",url);
		return(ret);
	}
}

LocusZoom.Data.LDSource = function(url) {
	this.url = url;

	this.getData = function(state, fields) {
		var requrl = this.url + "results?find=reference::2" + 
			"|chr::" + state.chr + 
			"|start::" + state.start + 
			"|end::" + state.end + 
			"|id1::" + state.refvar + 
			"&fields=chr,pos,rsquare";
		//var ret = LocusZoom.createCORSPromise("GET",url);
		var ret = LocusZoom.createResolvedPromise("GET",url);
		return(ret);

	}
}

LocusZoom.Data.GeneSource = function(url) {

}

LocusZoom.createResolvedPromise = function() {
	var response = Q.defer();
	response.resolve(Array.prototype.slice.call(arguments));
	return response.promise;
}

LocusZoom.DefaultDataSources = {
	base: new LocusZoom.Data.AssociationSource("/api/v1/single/"),
	ld: new LocusZoom.Data.LDSource("/api/v1/pair/LD/"),
	gene: new LocusZoom.Data.GeneSource("/api/v1/pair/LD/")
}

var lzd = new LocusZoom.Data.Requester(LocusZoom.DefaultDataSources);
