"use strict";

/**

  Data Layer Class

  A data layer is an abstract class representing a data set and its
  graphical representation within a panel

*/

LocusZoom.DataLayer = function() { 

    this.id     = null;
    this.parent = null;
    this.svg    = null;

    this.fields = [];
    this.data = [];

    // TODO: abstract out afterGet functions to canonical filters on fields at the LocusZoom.Data.Requester level
    this.afterGet = null;

    this.state = {
        z_index: null
    };
    
    return this;

};

LocusZoom.DataLayer.prototype.attachToYAxis = function(y){
    if (typeof y === "undefined"){
        y = 1;
    }
    if (y !== 1 && y !== 2){
        return false;
    } else {
        this.parent.axes["y" + y + "_data_layer_id"] = this.id;
    }
    return this;
};

// Initialize a panel
LocusZoom.DataLayer.prototype.initialize = function(){

    var clip_id = this.parent.parent.id + "." + this.parent.id + "." + this.id + ".clip";
        
    // Append clip path to the parent svg element
    this.parent.svg.append("clipPath")
        .attr("id", clip_id)
        .append("rect")
        .attr("width", this.parent.view.cliparea.width)
        .attr("height", this.parent.view.cliparea.height);
    
    // Append svg group for rendering all panel child elements, clipped by the clip path
    this.svg = this.parent.svg.append("g")
        .attr("id", this.id + "_data_layer")
        .attr("transform", "translate(" + this.parent.view.cliparea.origin.x +  "," + this.parent.view.cliparea.origin.y + ")")
        .attr("clip-path", "url(#" + clip_id + ")");

};


// Re-Map a data layer to new positions according to the parent panel's parent instance's state
LocusZoom.DataLayer.prototype.reMap = function(){
    var promise = this.parent.parent.lzd.getData(this.parent.parent.state, this.fields); //,"ld:best"
    promise.then(function(new_data){
        this.data = new_data.body;
        if (typeof this.afterGet == "function"){
            this.afterGet();
        }
    }.bind(this));
    return promise;
};


/*********************
  Positions Data Layer
*/

LocusZoom.PositionsDataLayer = function(){

    LocusZoom.DataLayer.apply(this, arguments);  
    this.id = "positions";
    this.fields = ["id","position","pvalue","refAllele","ld:best"];

    this.afterGet = function(){
        this.data.map(function(d, i){
            this.data[i].ld = +d["ld:best"];
            this.data[i].log10pval = -Math.log(d.pvalue) / Math.LN10;
        }.bind(this));
    }

    this.render = function(){
        this.svg.selectAll("*").remove(); // should this happen at all, or happen at the panel level?
        this.svg
            .selectAll("circle.datum")
            .data(this.data)
            .enter().append("circle")
            .attr("class", "datum")
            .attr("id", function(d){ return d.id; })
            .attr("cx", function(d){ return this.parent.state.x_scale(d.position); }.bind(this))
            .attr("cy", function(d){ return this.parent.state.y1_scale(d.log10pval); }.bind(this))
            .attr("fill", function(d){ return this.fillColor(d.ld); }.bind(this))
            .attr("stroke", "black")
            .attr("r", 4)
            .style({ cursor: "pointer" })
            .append("svg:title")
            .text(function(d) { return d.id; });
    };

    // TODO: abstract out to a Color Scale class and support arbitrarily many scales that can be substituted out per user input
    this.fillColor = function(pval){
        var getCutter = function(breaks) {
            var fn = function(x) {
                if (x == null || isNaN(x)){ return 0; }
                for(var i = 0; i < breaks.length; i++) {
                    if (x < breaks[i]) break;
                }
                return i;
            }
            return fn;
        }
        var cutter = getCutter([0,.2,.4,.6,.8])
        var fill = ["#808080","#357ebd","#46b8da","#5cb85c","#eea236","#d43f3a"][ cutter(pval) ]
        return fill;
    }
       
    return this;
};

LocusZoom.PositionsDataLayer.prototype = new LocusZoom.DataLayer();


/*********************
  Recombination Rate Data Layer
*/

LocusZoom.RecombinationRateDataLayer = function(){

    LocusZoom.DataLayer.apply(this, arguments);
    this.id = "ld";
    this.fields = [];

    this.render = function(){
        this.svg.selectAll("*").remove();
    }
       
    return this;
};

LocusZoom.RecombinationRateDataLayer.prototype = new LocusZoom.DataLayer();


/*********************
  Genes Data Layer
*/

LocusZoom.GenesDataLayer = function(){

    LocusZoom.DataLayer.apply(this, arguments);
    this.id = "genes";
    this.fields = ["gene:gene"];

    this.render = function(){
        this.svg.selectAll("*").remove();
    }
       
    return this;
};

LocusZoom.GenesDataLayer.prototype = new LocusZoom.DataLayer();
