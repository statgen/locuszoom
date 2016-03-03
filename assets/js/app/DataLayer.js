/* global d3,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/**

  Data Layer Class

  A data layer is an abstract class representing a data set and its
  graphical representation within a panel

*/

LocusZoom.DataLayer = function(id, layout) {

    this.initialized = false;

    this.id     = id;
    this.parent = null;
    this.svg    = {};

    this.layout = layout || {
        class: "DataLayer",
        fields: []
    };

    this.data = [];
    this.metadata = {};

    this.getBaseId = function(){
        return this.parent.parent.id + "." + this.parent.id + "." + this.id;
    };
    
    return this;

};

// Generate a y-axis extent functions based on the layout
LocusZoom.DataLayer.prototype.getYExtent = function(){
    return function(){
        var extent = d3.extent(this.data, function(d) {
            return +d[this.layout.y_axis.data];
        }.bind(this));
        // Apply upper/lower buffers, if applicable
        if (!isNaN(this.layout.y_axis.lower_buffer)){ extent[0] *= 1 - this.layout.y_axis.lower_buffer; }
        if (!isNaN(this.layout.y_axis.upper_buffer)){ extent[1] *= 1 + this.layout.y_axis.upper_buffer; }
        // Apply floor/ceiling, if applicable
        if (!isNaN(this.layout.y_axis.floor)){ extent[0] = Math.max(extent[0], this.layout.y_axis.floor); }
        if (!isNaN(this.layout.y_axis.ceiling)){ extent[1] = Math.min(extent[1], this.layout.y_axis.ceiling); }
        return extent;
    }.bind(this);
};

// Initialize a data layer
LocusZoom.DataLayer.prototype.initialize = function(){

    // Append a container group element to house the main data layer group element and the clip path
    this.svg.container = this.parent.svg.group.append("g")
        .attr("id", this.getBaseId() + ".data_layer_container");
        
    // Append clip path to the container element
    this.svg.clipRect = this.svg.container.append("clipPath")
        .attr("id", this.getBaseId() + ".clip")
        .append("rect");
    
    // Append svg group for rendering all data layer elements, clipped by the clip path
    this.svg.group = this.svg.container.append("g")
        .attr("id", this.getBaseId() + ".data_layer")
        .attr("clip-path", "url(#" + this.getBaseId() + ".clip)");

    // Flip the "initialized" bit
    this.initialized = true;

    return this;

};

LocusZoom.DataLayer.prototype.draw = function(){
    this.svg.container.attr("transform", "translate(" + this.parent.layout.cliparea.origin.x +  "," + this.parent.layout.cliparea.origin.y + ")");
    this.svg.clipRect
        .attr("width", this.parent.layout.cliparea.width)
        .attr("height", this.parent.layout.cliparea.height);
    return this;
};

// Re-Map a data layer to new positions according to the parent panel's parent instance's state
LocusZoom.DataLayer.prototype.reMap = function(){
    var promise = this.parent.parent.lzd.getData(this.parent.parent.state, this.layout.fields); //,"ld:best"
    promise.then(function(new_data){
        this.data = new_data.body;
    }.bind(this));
    return promise;
};

/****************
  Color Functions
  Singleton for accessing/storing functions to apply different color schemes to data sets
*/

LocusZoom.DataLayer.ColorFunctions = (function() {
    var obj = {};
    var functions = {
        "numeric_cut": function(parameters, value){
            var breaks = parameters.breaks;
            var colors = parameters.colors;
            if (value == null || isNaN(+value)){
                return (parameters.null_color ? parameters.null_color : colors[0]);
            }
            var threshold = breaks.reduce(function(prev, curr){
                if (+value < prev || (+value >= prev && +value < curr)){
                    return prev;
                } else {
                    return curr;
                }
            });
            return colors[breaks.indexOf(threshold)];
        },
        "categorical_cut": function(parameters, value){
            if (parameters.categories.indexOf(value) != -1){
                return parameters.colors[parameters.categories.indexOf(value)];
            } else {
                return (parameters.null_color ? parameters.null_color : parameters.colors[0]); 
            }
        }
    };

    obj.get = function(name, parameters, value) {
        if (!name) {
            return null;
        } else if (functions[name]) {
            if (typeof parameters == "undefined" && typeof value == "undefined"){
                return functions[name];
            } else {
                return functions[name](parameters, value);
            }
        } else {
            throw("color function [" + name + "] not found");
        }
    };

    obj.set = function(name, fn) {
        if (fn) {
            functions[name] = fn;
        } else {
            delete functions[name];
        }
    };

    obj.add = function(name, fn) {
        if (functions.name) {
            throw("color function already exists with name: " + name);
        } else {
            obj.set(name, fn);
        }
    };

    obj.list = function() {
        return Object.keys(functions);
    };

    return obj;
})();


/*********************
  Scatter Data Layer
  Implements a standard scatter plot
*/

LocusZoom.ScatterDataLayer = function(id, layout){

    LocusZoom.DataLayer.apply(this, arguments);
    this.layout = layout;

    // Apply defaults to the layout where missing
    this.layout.size == this.layout.size || 4;
    this.layout.color == this.layout.color || "#888888";
    if (this.layout.y_axis && this.layout.y_axis.axis != 1 && this.layout.y_axis.axis != 2){
        this.layout.y_axis.axis = 1;
    }

    this.render = function(){
        this.svg.group.selectAll("*").remove(); // should this happen at all, or happen at the panel level?
        var selection = this.svg.group
            .selectAll("circle.lz-data_layer-scatter")
            .data(this.data)
            .enter().append("circle") // Todo: make shape definable in layout; support a few different shapes
            .attr("class", "lz-data_layer-scatter")
            .attr("r", this.layout.size)
            .style({ cursor: "pointer" });
        // Apply x position
        if (this.layout.x_axis && this.layout.x_axis.data){
            selection.attr("cx", function(d){
                return this.parent.state.x_scale(d[this.layout.x_axis.data]);
            }.bind(this));
        }
        // Apply y position
        if (this.layout.y_axis && this.layout.y_axis.data){
            selection.attr("cy", function(d){
                return this.parent.state["y"+this.layout.y_axis.axis+"_scale"](d[this.layout.y_axis.data]);
            }.bind(this));
        }
        // Apply id (if included in fields)
        if (this.layout.fields.indexOf("id") != -1){
            selection.attr("id", function(d){ return d.id; });
        }
        // Apply color
        if (this.layout.color){
            if (typeof this.layout.color == "string"){
                selection.attr("fill", this.layout.color);
            } else if (this.layout.color.function && this.layout.color.data) {
                selection.attr("fill", function(d){
                    return LocusZoom.DataLayer.ColorFunctions.get(this.layout.color.function,
                                                                  this.layout.color.parameters || {},
                                                                  d[this.layout.color.data]);
                }.bind(this));
            }
        }
        // Apply title (basic mouseover label)
        if (this.layout.label_data){
            selection.append("svg:title")
                .text(function(d) { return d[this.layout.label_data]; }.bind(this));
        }
    };
       
    return this;
};

LocusZoom.ScatterDataLayer.prototype = new LocusZoom.DataLayer();


/*********************
  Genes Data Layer
*/

LocusZoom.GenesDataLayer = function(id, layout){

    LocusZoom.DataLayer.apply(this, arguments);
    this.layout = layout;

    this.metadata.tracks = 1;
    this.metadata.gene_track_index = { 1: [] }; // track-number-indexed object with arrays of gene indexes in the dataset
    this.metadata.min_display_range_width = 80; // minimum width in pixels for a gene, to allow enough room for its label

    // After we've loaded the genes interpret them to assign
    // each to a track so that they do not overlap in the view
    this.assignTracks = function(){

        // Reinitialize metadata
        this.metadata.tracks = 1;
        this.metadata.gene_track_index = { 1: [] };

        this.data.map(function(d, g){

            // Determine display range start and end, based on minimum allowable gene display width, bounded by what we can see
            // (range: values in terms of pixels on the screen)
            this.data[g].display_range = {
                start: this.parent.state.x_scale(Math.max(d.start, this.parent.parent.state.start)),
                end:   this.parent.state.x_scale(Math.min(d.end, this.parent.parent.state.end))
            };
            this.data[g].display_range.width = this.data[g].display_range.end - this.data[g].display_range.start;
            this.data[g].display_range.text_anchor = "middle";
            if (this.data[g].display_range.width < this.metadata.min_display_range_width){
                if (d.start < this.parent.parent.state.start){
                    this.data[g].display_range.end = this.data[g].display_range.start + this.metadata.min_display_range_width;
                    this.data[g].display_range.text_anchor = "start";
                } else if (d.end > this.parent.parent.state.end){
                    this.data[g].display_range.start = this.data[g].display_range.end - this.metadata.min_display_range_width;
                    this.data[g].display_range.text_anchor = "end";
                } else {
                    var centered_margin = (this.metadata.min_display_range_width - this.data[g].display_range.width) / 2;
                    if ((this.data[g].display_range.start - centered_margin) < this.parent.state.x_scale(this.parent.parent.state.start)){
                        this.data[g].display_range.start = this.parent.state.x_scale(this.parent.parent.state.start);
                        this.data[g].display_range.end = this.data[g].display_range.start + this.metadata.min_display_range_width;
                        this.data[g].display_range.text_anchor = "start";
                    } else if ((this.data[g].display_range.end + centered_margin) > this.parent.state.x_scale(this.parent.parent.state.end)) {
                        this.data[g].display_range.end = this.parent.state.x_scale(this.parent.parent.state.end);
                        this.data[g].display_range.start = this.data[g].display_range.end - this.metadata.min_display_range_width;
                        this.data[g].display_range.text_anchor = "end";
                    } else {
                        this.data[g].display_range.start -= centered_margin;
                        this.data[g].display_range.end += centered_margin;
                    }
                }
                this.data[g].display_range.width = this.data[g].display_range.end - this.data[g].display_range.start;
            }
            // Convert and stash display range values into domain values
            // (domain: values in terms of the data set, e.g. megabases)
            this.data[g].display_domain = {
                start: this.parent.state.x_scale.invert(this.data[g].display_range.start),
                end:   this.parent.state.x_scale.invert(this.data[g].display_range.end)
            };
            this.data[g].display_domain.width = this.data[g].display_domain.end - this.data[g].display_domain.start;

            // Using display range/domain data generated above cast each gene to tracks such that none overlap
            this.data[g].track = null;
            var potential_track = 1;
            while (this.data[g].track == null){
                var collision_on_potential_track = false;
                this.metadata.gene_track_index[potential_track].map(function(placed_gene){
                    if (!collision_on_potential_track){
                        var min_start = Math.min(placed_gene.display_range.start, this.display_range.start);
                        var max_end = Math.max(placed_gene.display_range.end, this.display_range.end);
                        if ((max_end - min_start) < (placed_gene.display_range.width + this.display_range.width)){
                            collision_on_potential_track = true;
                        }
                    }
                }.bind(this.data[g]));
                if (!collision_on_potential_track){
                    this.data[g].track = potential_track;
                    this.metadata.gene_track_index[potential_track].push(this.data[g]);
                } else {
                    potential_track++;
                    if (potential_track > this.metadata.tracks){
                        this.metadata.tracks = potential_track;
                        this.metadata.gene_track_index[potential_track] = [];
                    }
                }
            }

            // Stash parent references on all genes, trascripts, and exons
            this.data[g].parent = this;
            this.data[g].transcripts.map(function(d, t){
                this.data[g].transcripts[t].parent = this.data[g];
                this.data[g].transcripts[t].exons.map(function(d, e){
                    this.data[g].transcripts[t].exons[e].parent = this.data[g].transcripts[t];
                }.bind(this));
            }.bind(this));

        }.bind(this));
        return this;
    };

    this.render = function(){

        this.assignTracks();

        this.svg.group.selectAll("*").remove();

        // Render gene groups
        this.svg.group.selectAll("g.lz-gene").data(this.data).enter()
            .append("g")
            .attr("class", "lz-gene")
            .attr("id", function(d){ return d.gene_name; })
            .each(function(gene){

                // Render gene boundaries
                d3.select(this).selectAll("rect.lz-gene").filter(".lz-boundary")
                    .data([gene]).enter().append("rect")
                    .attr("class", "lz-gene lz-boundary")
                    .attr("id", function(d){ return d.gene_name; })
                    .attr("x", function(d){ return this.parent.state.x_scale(d.start); }.bind(gene.parent))
                    .attr("y", function(d){ return (d.track * 40) - 20; }) // Arbitrary track height; should be dynamic
                    .attr("width", function(d){ return this.parent.state.x_scale(d.end) - this.parent.state.x_scale(d.start); }.bind(gene.parent))
                    .attr("height", 1) // This should be scaled dynamically somehow
                    .attr("fill", "#000099")
                    .style({ cursor: "pointer" })
                    .append("svg:title")
                    .text(function(d) { return d.gene_name; });

                // Render gene labels
                d3.select(this).selectAll("text.lz-gene")
                    .data([gene]).enter().append("text")
                    .attr("class", "lz-gene lz-label")
                    .attr("x", function(d){
                        if (d.display_range.text_anchor == "middle"){
                            return d.display_range.start + (d.display_range.width / 2);
                        } else if (d.display_range.text_anchor == "start"){
                            return d.display_range.start;
                        } else if (d.display_range.text_anchor == "end"){
                            return d.display_range.end;
                        }
                    })
                    .attr("y", function(d){ return (d.track * 40) - 30; })
                    .attr("text-anchor", function(d){ return d.display_range.text_anchor; })
                    .text(function(d){ return (d.strand == "+") ? d.gene_name + "→" : "←" + d.gene_name; });

                // Render exons (first transcript only, for now)
                d3.select(this).selectAll("g.lz-gene").filter(".lz-exons")
                    .data([gene]).enter().append("g")
                    .attr("class", "lz-gene lz-exons")
                    .each(function(gene){

                        d3.select(this).selectAll("rect.lz-gene").filter(".lz-exon")
                            .data(gene.transcripts[0].exons).enter().append("rect")
                            .attr("class", "lz-gene lz-exon")
                            .attr("id", function(d){ return d.exon_id; })
                            .attr("x", function(d){ return this.parent.state.x_scale(d.start); }.bind(gene.parent))
                            .attr("y", function(){ return (this.track * 40) - 26; }.bind(gene)) // Arbitrary track height
                            .attr("width", function(d){
                                return this.parent.state.x_scale(d.end) - this.parent.state.x_scale(d.start);
                            }.bind(gene.parent))
                            .attr("height", 12) // This should be scaled dynamically somehow
                            .attr("fill", "#000099")
                            .style({ cursor: "pointer" });

                    });

            });
        
    };
       
    return this;
};

LocusZoom.GenesDataLayer.prototype = new LocusZoom.DataLayer();
