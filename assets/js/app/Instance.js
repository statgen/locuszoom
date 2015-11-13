"use strict";

/**

  LocusZoom.Instance Class

  An instance is an independent LocusZoom object. Many instances can exist simultaneously
  on a single page, each having its own data caching, configuration, and state.

*/

LocusZoom.Instance = function(id) {

  this.id = id;
  this.parent = LocusZoom;
  
  this.svg = null;

    this.defaults = {
        view: { width: 700, height: 600 },
        panels: [ "Positions", "Genes" ]
    };

    // The panels property stores child panel instances
    this.panels = {};
    
    // TODO: move into datalayers within panels!
    this.data = [];
    
    // The state property stores any instance-wide parameters subject to change via user input
    this.state = {
        chromosome: 0,
        position: { start: 0, stop: 0 }
    };
    
    // The view property contains parameters that define the physical space of the entire LocusZoom object
    this.view = {
        width: 0,
        height: 0
    };

    // LocusZoom.Data.Requester
    this.lzd = new LocusZoom.Data.Requester(LocusZoom.DefaultDataSources);
    
  return this;
  
};


LocusZoom.Instance.prototype.setDimensions = function(width, height){
  if (typeof width === "undefined") {
    this.view.width = this.defaults.view.width;
  } else {
    this.view.width = +width;
  }
  if (typeof height === "undefined") {
    this.view.height = this.defaults.view.height;
  } else {
    this.view.height = +height;
        }
  this.svg.attr("width", this.view.width).attr("height", this.view.height);
  return this;
};


// Select a div element, add an SVG element, and change id to match the id of the div
LocusZoom.Instance.prototype.attachToDivById = function(id){
  this.parent.changeInstanceId(this.id, id);
  this.id = id;
  this.svg = d3.select("div#" + this.id).append("svg").attr("id", this.id + "_svg").attr("class", "locuszoom");
  // Detect data-region and map to it if necessary
  if (typeof this.svg.node().parentNode.dataset.region !== "undefined"){
    var region = this.svg.node().parentNode.dataset.region.split(/\D/);
    this.mapTo(+region[0], +region[1], +region[2]);
  }
}

// Create a new panel by panel class
LocusZoom.Instance.prototype.addPanel = function(PanelClass){
  if (typeof PanelClass !== "function"){
    return false
  }
  var panel = new PanelClass();
  this.panels[panel.id] = panel;
  return this.panels[panel.id];
};

// Map an entire LocusZoom Instance to a new region
LocusZoom.Instance.prototype.mapTo = function(chromosome, start, stop){

  console.log(this.id + " Map to:", chromosome, start, stop);
  return;

    // Apply new state values
    // TODO: preserve existing state until new state is completely loaded+rendered or aborted?
    this.state.chromosome     = +chromosome;
    this.state.position.start = +start;
    this.state.position.stop  = +stop;

    // Trigger reMap on each Panel
    for (var panel_id in this.panels){
        this.panels[panel_id].reMap();
    }

    /*
    
    // TODO: data requests need to pushed down into data layers
    
    var promises = [];
    
    // Prepend region
    if (new_start < this.state.position.start){
        var prepend = { start: new_start, stop: Math.min(new_stop, this.state.position.start) };
        var prepend_promise = this.lzd.getData({chr: chromosome, start: prepend.start, end: prepend.stop},
                                               ["id","position","pvalue","refAllele"]);
        prepend_promise.then(function(new_data){
            for (var idx in new_data.body){
                new_data.body[idx].log10pval = -Math.log(new_data.body[idx].pvalue) / Math.LN10;
            }
            this.data = new_data.body.concat(this.data);
        }.bind(this));
        promises.push(prepend_promise);
    }
    
    // Append region
    else if (new_stop > this.state.position.stop){
        var append = { start: Math.max(this.state.position.stop, new_start), stop: new_stop };
        var append_promise = this.lzd.getData({chr: chromosome, start: append.start, end: append.stop},
                                         ["id","position","pvalue","refAllele"]); //,"ld:best"
        append_promise.then(function(new_data){
            for (var idx in new_data.body){
                new_data.body[idx].log10pval = -Math.log(new_data.body[idx].pvalue) / Math.LN10;
            }
            this.data = this.data.concat(new_data.body);
        }.bind(this));
        promises.push(append_promise);
    }
    
    // When all finished: update Instance state and render
    Promise.all(promises).then(function(){
        this.state.chromosome     = chromosome;
        this.state.position.start = new_start;
        this.state.position.stop  = new_stop;
        this.render();
    }.bind(this));

    */
    
};

/******************
  Default Instance
  - During alpha development this class definition can serve as a functional draft of the API
  - The default instance should therefore have/do "one of everything" (however possible)
  - Ultimately the default instance should stand up the most commonly configured LZ use case
*/

LocusZoom.DefaultInstance = function(id){

    LocusZoom.Instance.apply(this, arguments);
  
    this.addPanel(LocusZoom.PositionsPanel)
        .setOrigin(0, 0)
        .setDimensions(700, 350)
        .setMargin(20, 20, 20, 30);
    this.panels.positions.addDataLayer(LocusZoom.PositionsDataLayer);
    this.panels.positions.addDataLayer(LocusZoom.LDDataLayer);

    this.addPanel(LocusZoom.GenesPanel)
        .setOrigin(0, 350)
        .setDimensions(700, 250)
        .setMargin(20, 20, 20, 30);
  
    return this;
  
};

LocusZoom.DefaultInstance.prototype = new LocusZoom.Instance();
