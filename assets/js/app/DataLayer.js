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
        this.data = [];
        for (var idx in new_data.body){
            this.data.push(new LocusZoom.PositionDatum(new_data.body[idx]));
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
    this.fields = ["id","position","pvalue","refAllele"];

    this.render = function(){
        this.svg.selectAll("*").remove();
        this.svg
            .selectAll("circle.datum")
            .data(this.data)
            .enter().append("circle")
            .attr("class", "datum")
            .attr("id", function(d){ return d.id; })
            .attr("cx", function(d){ return this.parent.state.x_scale(d.position); }.bind(this))
            .attr("cy", function(d){ return this.parent.state.y1_scale(d.log10pval); }.bind(this))
            .attr("fill", "red")
            .attr("stroke", "black")
            .attr("r", 4)
            .style({ cursor: "pointer" })
            .append("svg:title")
            .text(function(d) { return d.id; });
    };
       
    return this;
};

LocusZoom.PositionsDataLayer.prototype = new LocusZoom.DataLayer();


/*********************
  LD Data Layer
*/

LocusZoom.LDDataLayer = function(){

    LocusZoom.DataLayer.apply(this, arguments);
    this.id = "ld";
    this.fields = [];
       
    return this;
};

LocusZoom.LDDataLayer.prototype = new LocusZoom.DataLayer();


/*********************
  Genes Data Layer
*/

LocusZoom.GenesDataLayer = function(){

    LocusZoom.DataLayer.apply(this, arguments);
    this.id = "genes";
    this.fields = [];
       
    return this;
};

LocusZoom.GenesDataLayer.prototype = new LocusZoom.DataLayer();
