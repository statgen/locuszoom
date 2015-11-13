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

    // The _panels property stores child panel instances
    this._panels = {};
    
    // The state property stores any instance-wide parameters subject to change via user input
    this.state = {
        chr: 0,
        start: 0,
        end: 0
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

// Set the view dimensions for this instance. If an SVG exists, update its dimensions
LocusZoom.Instance.prototype.setDimensions = function(width, height){
    if (typeof width !== "undefined" && typeof height !== "undefined") {
        this.view.width  = +width;
        this.view.height = +height;
    }
    if (this.svg != null){
        this.svg.attr("width", this.view.width).attr("height", this.view.height);
    }
    return this;
};

// Create a new panel by panel class
LocusZoom.Instance.prototype.addPanel = function(PanelClass){
    if (typeof PanelClass !== "function"){
        return false
    }
    var panel = new PanelClass();
    panel.parent = this;
    this._panels[panel.id] = panel;
    return this._panels[panel.id];
};

// Call initialize on all child panels
LocusZoom.Instance.prototype.initializePanels = function(){
    for (var id in this._panels){
        this._panels[id].initialize();
    }
}

// Map an entire LocusZoom Instance to a new region
LocusZoom.Instance.prototype.mapTo = function(chr, start, end){

    // Apply new state values
    // TODO: preserve existing state until new state is completely loaded+rendered or aborted?
    this.state.chr   = +chr;
    this.state.start = +start;
    this.state.end   = +end;

    // Trigger reMap on each Panel
    for (var id in this._panels){
        this._panels[id].reMap();
    }

    return this;

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

    this.setDimensions(700,600);
  
    this.addPanel(LocusZoom.PositionsPanel)
        .setOrigin(0, 0)
        .setDimensions(700, 350)
        .setMargin(20, 30, 20, 30);
    this._panels.positions.addDataLayer(LocusZoom.PositionsDataLayer).attachToYAxis(1);
    //this._panels.positions.addDataLayer(LocusZoom.LDDataLayer).attachToYAxis(2);

    this.addPanel(LocusZoom.GenesPanel)
        .setOrigin(0, 350)
        .setDimensions(700, 250)
        .setMargin(20, 30, 20, 30);
  
    return this;
  
};

LocusZoom.DefaultInstance.prototype = new LocusZoom.Instance();
