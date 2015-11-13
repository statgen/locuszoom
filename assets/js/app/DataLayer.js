"use strict"

/**

  Data Layer Class

  A data layer is an abstract class representing a data set and its
  graphical representation within a panel

*/

LocusZoom.DataLayer = function() { 

    this.id     = null;
    this.parent = null;

    this.data = [];

    this.state = {
        z_index: null
    };
    
    return this;

}

LocusZoom.DataLayer.prototype.attachToYAxis = function(y){
    if (typeof y === "undefined"){
        y = 1;
    }
    if (y !== 1 && y !== 2){
        return false;
    } else {
        this.parent.axes["y" + y + "_data_layer_id"] = this.id
    }
    return this;
}

/*
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
*/



/*********************
  Positions Data Layer
*/

LocusZoom.PositionsDataLayer = function(){

    LocusZoom.DataLayer.apply(this, arguments);  
    this.id = "positions";
       
    return this;
};

LocusZoom.PositionsDataLayer.prototype = new LocusZoom.DataLayer();


/*********************
  LD Data Layer
*/

LocusZoom.LDDataLayer = function(){

    LocusZoom.DataLayer.apply(this, arguments);
    this.id = "ld";
       
    return this;
};

LocusZoom.LDDataLayer.prototype = new LocusZoom.DataLayer();

