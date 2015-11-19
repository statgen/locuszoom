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

    this.getBaseId = function(){
        return this.parent.parent.id + "." + this.parent.id + "." + this.id;
    }
    
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

    // Append a container group element to house the main data layer group element and the clip path
    var container = this.parent.svg.append("g")
        .attr("id", this.getBaseId() + ".data_layer_container")
        .attr("transform", "translate(" + this.parent.view.cliparea.origin.x +  "," + this.parent.view.cliparea.origin.y + ")");
        
    // Append clip path to the container element
    container.append("clipPath")
        .attr("id", this.getBaseId() + ".clip")
        .append("rect")
        .attr("width", this.parent.view.cliparea.width)
        .attr("height", this.parent.view.cliparea.height);
    
    // Append svg group for rendering all data layer elements, clipped by the clip path
    this.svg = container.append("g")
        .attr("id", this.getBaseId() + ".data_layer")
        .attr("clip-path", "url(#" + this.getBaseId() + ".clip)");

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
    this.fields = ["id","position","pvalue","refAllele","ld:state"];

    this.afterGet = function(){
        this.data.map(function(d, i){
            this.data[i].ld = +d["ld:state"];
            this.data[i].log10pval = -Math.log(d.pvalue) / Math.LN10;
        }.bind(this));
    };

    this.render = function(){
        var that = this;
        var clicker = function() {
            var me = d3.select(this);
            console.log(me.attr("id"));
            that.parent.parent.state.ldrefvar = me.attr("id");
        };
        this.svg.selectAll("*").remove(); // should this happen at all, or happen at the panel level?
        this.svg
            .selectAll("circle.positions")
            .data(this.data)
            .enter().append("circle")
            .attr("class", "position")
            .attr("id", function(d){ return d.id; })
            .attr("cx", function(d){ return this.parent.state.x_scale(d.position); }.bind(this))
            .attr("cy", function(d){ return this.parent.state.y1_scale(d.log10pval); }.bind(this))
            .attr("fill", function(d){ return this.fillColor(d.ld); }.bind(this))
            .on("click", clicker)
            .attr("r", 4) // This should be scaled dynamically somehow
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
            };
            return fn;
        };
        var cutter = getCutter([0,.2,.4,.6,.8]);
        var fill = ["#B8B8B8","#357ebd","#46b8da","#5cb85c","#eea236","#d43f3a"][ cutter(pval) ];
        return fill;
    };
       
    return this;
};

LocusZoom.PositionsDataLayer.prototype = new LocusZoom.DataLayer();


/*********************
  Recombination Rate Data Layer
*/

LocusZoom.RecombinationRateDataLayer = function(){

    LocusZoom.DataLayer.apply(this, arguments);
    this.id = "recombination_rate";
    this.fields = [];

    this.render = function(){
        this.svg.selectAll("*").remove();
    };
       
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

    // After we've loaded the genes interpret them to assign each to a track
    // so that they do not overlap in the view
    this.afterGet = function(){
        this.data.map(function(d, i){
            // Iterative stagger for now, more sophisticated track logic forthcoming
            this.data[i].track = 50 + ((i % 3 ) * 50);
        }.bind(this));
    };

    this.render = function(){
        this.svg.selectAll("*").remove();
        this.svg
            .selectAll("rect.gene")
            .data(this.data)
            .enter().append("rect")
            .attr("class", "gene")
            .attr("id", function(d){ return d.gene_id; })
            .attr("x", function(d){ return this.parent.state.x_scale(d.start); }.bind(this))
            .attr("y", function(d){ return d.track; }.bind(this))
            .attr("width", function(d){ return this.parent.state.x_scale(d.end) - this.parent.state.x_scale(d.start); }.bind(this))
            .attr("height", 5) // This should be scaled dynamically somehow
            .attr("fill", "#000099")
            .style({ cursor: "pointer" })
            .append("svg:title")
            .text(function(d) { return d.gene_id; });
    };
       
    return this;
};

LocusZoom.GenesDataLayer.prototype = new LocusZoom.DataLayer();
