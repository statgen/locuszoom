/* global d3,LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/**

  Singletons

  LocusZoom has various singleton objects that are used for registering functions or classes.
  These objects provide safe, standard methods to redefine or delete existing functions/classes
  as well as define new custom functions/classes to be used in a plot.

*/


/* The Collection of "Known" Data Source Endpoints */

LocusZoom.KnownDataSources = (function() {
    var obj = {};
    var sources = [];

    var findSourceByName = function(x) {
        for(var i=0; i<sources.length; i++) {
            if (!sources[i].SOURCE_NAME) {
                throw("KnownDataSources at position " + i + " does not have a 'SOURCE_NAME' static property");
            }
            if (sources[i].SOURCE_NAME == x) {
                return sources[i];
            }
        }
        return null;
    };

    obj.get = function(name) {
        return findSourceByName(name);
    };

    obj.add = function(source) {
        if (!source.SOURCE_NAME) {
            console.warn("Data source added does not have a SOURCE_NAME");
        }
        sources.push(source);
    };

    obj.push = function(source) {
        console.warn("Warning: KnownDataSources.push() is depricated. Use .add() instead");
        obj.add(source);
    };

    obj.list = function() {
        return sources.map(function(x) {return x.SOURCE_NAME;});
    };

    obj.create = function(name) {
        //create new object (pass additional parameters to constructor)
        var newObj = findSourceByName(name);
        if (newObj) {
            var params = arguments;
            params[0] = null;
            return new (Function.prototype.bind.apply(newObj, params));
        } else {
            throw("Unable to find data source for name: " + name); 
        }
    };

    //getAll, setAll and clear really should only be used by tests
    obj.getAll = function() {
        return sources;
    };
    
    obj.setAll = function(x) {
        sources = x;
    };

    obj.clear = function() {
        sources = [];
    };

    return obj;
})();


/****************
  Label Functions

  These functions will generate a string based on a provided state object. Useful for dynamic axis labels.
*/

LocusZoom.LabelFunctions = (function() {
    var obj = {};
    var functions = {};

    obj.get = function(name, state) {
        if (!name) {
            return null;
        } else if (functions[name]) {
            if (typeof state == "undefined"){
                return functions[name];
            } else {
                return functions[name](state);
            }
        } else {
            throw("label function [" + name + "] not found");
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
        if (functions[name]) {
            throw("label function already exists with name: " + name);
        } else {
            obj.set(name, fn);
        }
    };

    obj.list = function() {
        return Object.keys(functions);
    };

    return obj;
})();

// Label function for "Chromosome # (Mb)" where # comes from state
LocusZoom.LabelFunctions.add("chromosome", function(state){
    if (!isNaN(+state.chr)){ 
        return "Chromosome " + state.chr + " (Mb)";
    } else {
        return "Chromosome (Mb)";
    }
});


/**************************
  Transformation Functions

  Singleton for formatting or transforming a single input, for instance turning raw p values into negeative log10 form
  Transformation functions are chainable with a pipe on a field name, like so: "pvalue|neglog10"

  NOTE: Because these functions are chainable the FUNCTION is returned by get(), not the result of that function.

  All transformation functions must accept an object of parameters and a value to process.
*/
LocusZoom.TransformationFunctions = (function() {
    var obj = {};
    var transformations = {};

    var getTrans = function(name) {
        if (!name) {
            return null;
        }
        var fun = transformations[name];
        if (fun)  {
            return fun;
        } else {
            throw("transformation " + name + " not found");
        }
    };

    //a single transformation with any parameters
    //(parameters not currently supported)
    var parseTrans = function(name) {
        return getTrans(name);
    };

    //a "raw" transformation string with a leading pipe
    //and one or more transformations
    var parseTransString = function(x) {
        var funs = [];
        var re = /\|([^\|]+)/g;
        var result;
        while((result = re.exec(x))!=null) {
            funs.push(result[1]);
        }
        if (funs.length==1) {
            return parseTrans(funs[0]);
        } else if (funs.length > 1) {
            return function(x) {
                var val = x;
                for(var i = 0; i<funs.length; i++) {
                    val = parseTrans(funs[i])(val);
                }
                return val;
            };
        }
        return null;
    };

    //accept both "|name" and "name"
    obj.get = function(name) {
        if (name && name.substring(0,1)=="|") {
            return parseTransString(name);
        } else {
            return parseTrans(name);
        }
    };

    obj.set = function(name, fn) {
        if (name.substring(0,1)=="|") {
            throw("transformation name should not start with a pipe");
        } else {
            if (fn) {
                transformations[name] = fn;
            } else {
                delete transformations[name];
            }
        }
    };

    obj.add = function(name, fn) {
        if (transformations[name]) {
            throw("transformation already exists with name: " + name);
        } else {
            obj.set(name, fn);
        }
    };

    obj.list = function() {
        return Object.keys(transformations);
    };

    return obj;
})();

LocusZoom.TransformationFunctions.add("neglog10", function(x) {
    return -Math.log(x) / Math.LN10;
});

LocusZoom.TransformationFunctions.add("scinotation", function(x) {
    var log;
    if (Math.abs(x) > 1){
        log = Math.ceil(Math.log(x) / Math.LN10);
    } else {
        log = Math.floor(Math.log(x) / Math.LN10);
    }
    if (Math.abs(log) <= 3){
        return x.toFixed(3);
    } else {
        return x.toExponential(2).replace("+", "").replace("e", " × 10^");
    }
});


/****************
  Scale Functions

  Singleton for accessing/storing functions that will convert arbitrary data points to values in a given scale
  Useful for anything that needs to scale discretely with data (e.g. color, point size, etc.)

  All scale functions must accept an object of parameters and a value to process.
*/

LocusZoom.ScaleFunctions = (function() {
    var obj = {};
    var functions = {};

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
            throw("scale function [" + name + "] not found");
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
        if (functions[name]) {
            throw("scale function already exists with name: " + name);
        } else {
            obj.set(name, fn);
        }
    };

    obj.list = function() {
        return Object.keys(functions);
    };

    return obj;
})();

// Boolean scale function: bin a dataset numerically by matching against an array of distinct values
LocusZoom.ScaleFunctions.add("if", function(parameters, value){
    if (typeof value == "undefined" || parameters.field_value != value){
        if (typeof parameters.else != "undefined"){
            return parameters.else;
        } else {
            return null;
        }
    } else {
        return parameters.then;
    }
});

// Numerical Bin scale function: bin a dataset numerically by an array of breakpoints
LocusZoom.ScaleFunctions.add("numerical_bin", function(parameters, value){
    var breaks = parameters.breaks;
    var values = parameters.values;
    if (typeof value == "undefined" || value == null || isNaN(+value)){
        return (parameters.null_value ? parameters.null_value : null);
    }
    var threshold = breaks.reduce(function(prev, curr){
        if (+value < prev || (+value >= prev && +value < curr)){
            return prev;
        } else {
            return curr;
        }
    });
    return values[breaks.indexOf(threshold)];
});

// Categorical Bin scale function: bin a dataset numerically by matching against an array of distinct values
LocusZoom.ScaleFunctions.add("categorical_bin", function(parameters, value){
    if (typeof value == "undefined" || parameters.categories.indexOf(value) == -1){
        return (parameters.null_value ? parameters.null_value : null); 
    } else {
        return parameters.values[parameters.categories.indexOf(value)];
    }
});


/************************
  Data Layer Subclasses

  The abstract Data Layer class has general methods and properties that apply universally to all Data Layers
  Specific data layer subclasses (e.g. a scatter plot, a line plot, gene visualization, etc.) must be defined
  and registered with this singleton to be accessible.

  All new Data Layer subclasses must be defined by accepting an id string and a layout object.
  Singleton for storing available Data Layer classes as well as updating existing and/or registering new ones
*/

LocusZoom.DataLayers = (function() {
    var obj = {};
    var datalayers = {};

    obj.get = function(name, layout, parent) {
        if (!name) {
            return null;
        } else if (datalayers[name]) {
            if (typeof layout != "object"){
                throw("invalid layout argument for data layer [" + name + "]");
            } else {
                return new datalayers[name](layout, parent);
            }
        } else {
            throw("data layer [" + name + "] not found");
        }
    };

    obj.set = function(name, datalayer) {
        if (datalayer) {
            if (typeof datalayer != "function"){
                throw("unable to set data layer [" + name + "], argument provided is not a function");
            } else {
                datalayers[name] = datalayer;
                datalayers[name].prototype = new LocusZoom.DataLayer();
            }
        } else {
            delete datalayers[name];
        }
    };

    obj.add = function(name, datalayer) {
        if (datalayers[name]) {
            throw("data layer already exists with name: " + name);
        } else {
            obj.set(name, datalayer);
        }
    };

    obj.list = function() {
        return Object.keys(datalayers);
    };

    return obj;
})();



/*********************
  Scatter Data Layer
  Implements a standard scatter plot
*/

LocusZoom.DataLayers.add("scatter", function(layout){

    // Define a default layout for this DataLayer type and merge it with the passed argument
    this.DefaultLayout = {
        point_size: 40,
        point_shape: "circle",
        color: "#888888",
        y_axis: {
            axis: 1
        },
        id_field: "id"
    };
    layout = LocusZoom.mergeLayouts(layout, this.DefaultLayout);

    // Extra default for layout spacing
    // Not in default layout since that would make the label attribute always present
    if (layout.label && isNaN(layout.label.spacing)){
        layout.label.spacing = 4;
    }

    // Apply the arguments to set LocusZoom.DataLayer as the prototype
    LocusZoom.DataLayer.apply(this, arguments);

    // Reimplement the positionTooltip() method to be scatter-specific
    this.positionTooltip = function(id){
        if (typeof id != "string"){
            throw ("Unable to position tooltip: id is not a string");
        }
        if (!this.tooltips[id]){
            throw ("Unable to position tooltip: id does not point to a valid tooltip");
        }
        var tooltip = this.tooltips[id];
        var point_size = this.resolveScalableParameter(this.layout.point_size, tooltip.data);
        var arrow_width = 7; // as defined in the default stylesheet
        var stroke_width = 1; // as defined in the default stylesheet
        var border_radius = 6; // as defined in the default stylesheet
        var page_origin = this.getPageOrigin();
        var x_center = this.parent.x_scale(tooltip.data[this.layout.x_axis.field]);
        var y_scale  = "y"+this.layout.y_axis.axis+"_scale";
        var y_center = this.parent[y_scale](tooltip.data[this.layout.y_axis.field]);
        var tooltip_box = tooltip.selector.node().getBoundingClientRect();
        // Position horizontally on the left or the right depending on which side of the plot the point is on
        var offset = Math.sqrt(point_size / Math.PI);
        var left, arrow_type, arrow_left;
        if (x_center <= this.parent.layout.width / 2){
            left = page_origin.x + x_center + offset + arrow_width + stroke_width;
            arrow_type = "left";
            arrow_left = -1 * (arrow_width + stroke_width);
        } else {
            left = page_origin.x + x_center - tooltip_box.width - offset - arrow_width - stroke_width;
            arrow_type = "right";
            arrow_left = tooltip_box.width - stroke_width;
        }
        // Position vertically centered unless we're at the top or bottom of the plot
        var data_layer_height = this.parent.layout.height - (this.parent.layout.margin.top + this.parent.layout.margin.bottom);
        var top, arrow_top;
        if (y_center - (tooltip_box.height / 2) <= 0){ // Too close to the top, push it down
            top = page_origin.y + y_center - (1.5 * arrow_width) - border_radius;
            arrow_top = border_radius;
        } else if (y_center + (tooltip_box.height / 2) >= data_layer_height){ // Too close to the bottom, pull it up
            top = page_origin.y + y_center + arrow_width + border_radius - tooltip_box.height;
            arrow_top = tooltip_box.height - (2 * arrow_width) - border_radius;
        } else { // vertically centered
            top = page_origin.y + y_center - (tooltip_box.height / 2);
            arrow_top = (tooltip_box.height / 2) - arrow_width;
        }        
        // Apply positions to the main div
        tooltip.selector.style("left", left + "px").style("top", top + "px");
        // Create / update position on arrow connecting tooltip to data
        if (!tooltip.arrow){
            tooltip.arrow = tooltip.selector.append("div").style("position", "absolute");
        }
        tooltip.arrow
            .attr("class", "lz-data_layer-tooltip-arrow_" + arrow_type)
            .style("left", arrow_left + "px")
            .style("top", arrow_top + "px");
    };

    // Function to flip labels from being anchored at the start of the text to the end
    // Both to keep labels from running outside the data layer and  also as a first
    // pass on recursive separation
    this.flip_labels = function(){
        var data_layer = this;
        var point_size = data_layer.resolveScalableParameter(data_layer.layout.point_size, {});
        var spacing = data_layer.layout.label.spacing;
        var handle_lines = Boolean(data_layer.layout.label.lines);
        var min_x = 2 * spacing;
        var max_x = data_layer.parent.layout.width - data_layer.parent.layout.margin.left - data_layer.parent.layout.margin.right - (2 * spacing);
        var flip = function(dn, dnl){
            var dnx = +dn.attr("x");
            var text_swing = (2 * spacing) + (2 * Math.sqrt(point_size));
            if (handle_lines){
                var dnlx2 = +dnl.attr("x2");
                var line_swing = spacing + (2 * Math.sqrt(point_size));
            }
            if (dn.style("text-anchor") == "start"){
                dn.style("text-anchor", "end");
                dn.attr("x", dnx - text_swing);
                if (handle_lines){ dnl.attr("x2", dnlx2 - line_swing); }
            } else {
                dn.style("text-anchor", "start");
                dn.attr("x", dnx + text_swing);
                if (handle_lines){ dnl.attr("x2", dnlx2 + line_swing); }
            }
        };
        // Flip any going over the right edge from the right side to the left side
        // (all labels start on the right side)
        data_layer.label_texts.each(function (d, i) {
            var a = this;
            var da = d3.select(a);
            var dax = +da.attr("x");
            var abound = da.node().getBoundingClientRect();
            if (dax + abound.width + spacing > max_x){
                var dal = handle_lines ? d3.select(data_layer.label_lines[0][i]) : null;
                flip(da, dal);
            }
        });
        // Second pass to flip any others that haven't flipped yet if they collide with another label
        data_layer.label_texts.each(function (d, i) {
            var a = this;
            var da = d3.select(a);
            if (da.style("text-anchor") == "end") return;
            var dax = +da.attr("x");
            var abound = da.node().getBoundingClientRect();
            var dal = handle_lines ? d3.select(data_layer.label_lines[0][i]) : null;
            data_layer.label_texts.each(function () {
                var b = this;
                var db = d3.select(b);
                var bbound = db.node().getBoundingClientRect();
                var collision = abound.left < bbound.left + bbound.width + (2*spacing) &&
                    abound.left + abound.width + (2*spacing) > bbound.left &&
                    abound.top < bbound.top + bbound.height + (2*spacing) &&
                    abound.height + abound.top + (2*spacing) > bbound.top;
                if (collision){
                    flip(da, dal);
                    // Double check that this flip didn't push the label past min_x. If it did, immediately flip back.
                    dax = +da.attr("x");
                    if (dax - abound.width - spacing < min_x){
                        flip(da, dal);
                    }
                }
                return;
            });
        });
    };

    // Recursive function to space labels apart immediately after initial render
    // Adapted from thudfactor's fiddle here: https://jsfiddle.net/thudfactor/HdwTH/
    // TODO: Make labels also aware of data elements
    this.separate_labels = function(){
        this.seperate_iterations++;
        var data_layer = this;
        var alpha = 0.5;
        var spacing = this.layout.label.spacing;
        var again = false;
        data_layer.label_texts.each(function () {
            var a = this;
            var da = d3.select(a);
            var y1 = da.attr("y");
            data_layer.label_texts.each(function () {
                var b = this;
                // a & b are the same element and don't collide.
                if (a == b) return;
                var db = d3.select(b);
                // a & b are on opposite sides of the chart and
                // don't collide
                if (da.attr("text-anchor") != db.attr("text-anchor")) return;
                // Determine if the  bounding rects for the two text elements collide
                var abound = da.node().getBoundingClientRect();
                var bbound = db.node().getBoundingClientRect();
                var collision = abound.left < bbound.left + bbound.width + (2*spacing) &&
                    abound.left + abound.width + (2*spacing) > bbound.left &&
                    abound.top < bbound.top + bbound.height + (2*spacing) &&
                    abound.height + abound.top + (2*spacing) > bbound.top;
                if (!collision) return;
                again = true;
                // If the labels collide, we'll push each
                // of the two labels up and down a little bit.
                var y2 = db.attr("y");
                var sign = abound.top < bbound.top ? 1 : -1;
                var adjust = sign * alpha;
                var new_a_y = +y1 - adjust;
                var new_b_y = +y2 + adjust;
                // Keep new values from extending outside the data layer
                var min_y = 2 * spacing;
                var max_y = data_layer.parent.layout.height - data_layer.parent.layout.margin.top - data_layer.parent.layout.margin.bottom - (2 * spacing);
                var delta;
                if (new_a_y - (abound.height/2) < min_y){
                    delta = +y1 - new_a_y;
                    new_a_y = +y1;
                    new_b_y += delta;
                } else if (new_b_y - (bbound.height/2) < min_y){
                    delta = +y2 - new_b_y;
                    new_b_y = +y2;
                    new_a_y += delta;
                }
                if (new_a_y + (abound.height/2) > max_y){
                    delta = new_a_y - +y1;
                    new_a_y = +y1;
                    new_b_y -= delta;
                } else if (new_b_y + (bbound.height/2) > max_y){
                    delta = new_b_y - +y2;
                    new_b_y = +y2;
                    new_a_y -= delta;
                }
                da.attr("y",new_a_y);
                db.attr("y",new_b_y);
            });
        });
        if (again) {
            // Adjust lines to follow the labels
            if (data_layer.layout.label.lines){
                var label_elements = data_layer.label_texts[0];
                data_layer.label_lines.attr("y2",function(d,i) {
                    var label_line = d3.select(label_elements[i]);
                    return label_line.attr("y");
                });
            }
            // After ~150 iterations we're probably beyond diminising returns, so stop recursing
            if (this.seperate_iterations < 150){
                setTimeout(function(){
                    this.separate_labels();
                }.bind(this), 1);
            }
        }
    };

    // Implement the main render function
    this.render = function(){

        var data_layer = this;
        var x_scale = "x_scale";
        var y_scale = "y"+this.layout.y_axis.axis+"_scale";

        // Generate labels first (if defined)
        if (this.layout.label){
            // Apply filters to generate a filtered data set
            var filtered_data = this.data.filter(function(d){
                if (!data_layer.layout.label.filters){
                    return true;
                } else {
                    // Start by assuming a match, run through all filters to test if not a match on any one
                    var match = true;
                    data_layer.layout.label.filters.forEach(function(filter){
                        if (isNaN(d[filter.field])){
                            match = false;
                        } else {
                            switch (filter.operator){
                            case "<":
                                if (!(d[filter.field] < filter.value)){ match = false; }
                                break;
                            case "<=":
                                if (!(d[filter.field] <= filter.value)){ match = false; }
                                break;
                            case ">":
                                if (!(d[filter.field] > filter.value)){ match = false; }
                                break;
                            case ">=":
                                if (!(d[filter.field] >= filter.value)){ match = false; }
                                break;
                            case "=":
                                if (!(d[filter.field] == filter.value)){ match = false; }
                                break;
                            default:
                                // If we got here the operator is not valid, so the filter should fail
                                match = false;
                                break;
                            }
                        }
                    });
                    return match;
                }
            });
            // Render label groups
            this.label_groups = this.svg.group
                .selectAll("g.lz-data_layer-scatter-label")
                .data(filtered_data, function(d){ return d.id + "_label"; });
            this.label_groups.enter()
                .append("g")
                .attr("class", "lz-data_layer-scatter-label");
            // Render label texts
            if (this.label_texts){ this.label_texts.remove(); }
            this.label_texts = this.label_groups.append("text")
                .attr("class", "lz-data_layer-scatter-label");
            this.label_texts
                .text(function(d){
                    return LocusZoom.parseFields(d, data_layer.layout.label.text || "");
                })
                .style(data_layer.layout.label.style || {})
                .attr({
                    "x": function(d){
                        var x = data_layer.parent[x_scale](d[data_layer.layout.x_axis.field])
                              + Math.sqrt(data_layer.resolveScalableParameter(data_layer.layout.point_size, d))
                              + data_layer.layout.label.spacing;
                        if (isNaN(x)){ x = -1000; }
                        return x;
                    },
                    "y": function(d){
                        var y = data_layer.parent[y_scale](d[data_layer.layout.y_axis.field]);
                        if (isNaN(y)){ y = -1000; }
                        return y;
                    },
                    "text-anchor": function(){
                        return "start";
                    }
                });
            // Render label lines
            if (data_layer.layout.label.lines){
                if (this.label_lines){ this.label_lines.remove(); }
                this.label_lines = this.label_groups.append("line")
                    .attr("class", "lz-data_layer-scatter-label");
                this.label_lines
                    .style(data_layer.layout.label.lines.style || {})
                    .attr({
                        "x1": function(d){
                            var x = data_layer.parent[x_scale](d[data_layer.layout.x_axis.field]);
                            if (isNaN(x)){ x = -1000; }
                            return x;
                        },
                        "y1": function(d){
                            var y = data_layer.parent[y_scale](d[data_layer.layout.y_axis.field]);
                            if (isNaN(y)){ y = -1000; }
                            return y;
                        },
                        "x2": function(d){
                            var x = data_layer.parent[x_scale](d[data_layer.layout.x_axis.field])
                                  + Math.sqrt(data_layer.resolveScalableParameter(data_layer.layout.point_size, d))
                                  + (data_layer.layout.label.spacing/2);
                            if (isNaN(x)){ x = -1000; }
                            return x;
                        },
                        "y2": function(d){
                            var y = data_layer.parent[y_scale](d[data_layer.layout.y_axis.field]);
                            if (isNaN(y)){ y = -1000; }
                            return y;
                        }
                    });
            }
            // Remove labels when they're no longer in the filtered data set
            this.label_groups.exit().remove();
        }
            
        // Generate main scatter data elements
        var selection = this.svg.group
            .selectAll("path.lz-data_layer-scatter")
            .data(this.data, function(d){ return d[this.layout.id_field]; }.bind(this));

        // Create elements, apply class, ID, and initial position
        var initial_y = isNaN(this.parent.layout.height) ? 0 : this.parent.layout.height;
        selection.enter()
            .append("path")
            .attr("class", "lz-data_layer-scatter")
            .attr("id", function(d){ return this.getElementId(d); }.bind(this))
            .attr("transform", "translate(0," + initial_y + ")");

        // Generate new values (or functions for them) for position, color, size, and shape
        var transform = function(d) {
            var x = this.parent[x_scale](d[this.layout.x_axis.field]);
            var y = this.parent[y_scale](d[this.layout.y_axis.field]);
            if (isNaN(x)){ x = -1000; }
            if (isNaN(y)){ y = -1000; }
            return "translate(" + x + "," + y + ")";
        }.bind(this);

        var fill = function(d){ return this.resolveScalableParameter(this.layout.color, d); }.bind(this);

        var shape = d3.svg.symbol()
            .size(function(d){ return this.resolveScalableParameter(this.layout.point_size, d); }.bind(this))
            .type(function(d){ return this.resolveScalableParameter(this.layout.point_shape, d); }.bind(this));

        // Apply position and color, using a transition if necessary

        if (this.canTransition()){
            selection
                .transition()
                .duration(this.layout.transition.duration || 0)
                .ease(this.layout.transition.ease || "cubic-in-out")
                .attr("transform", transform)
                .attr("fill", fill)
                .attr("d", shape);
        } else {
            selection
                .attr("transform", transform)
                .attr("fill", fill)
                .attr("d", shape);
        }

        // Remove old elements as needed
        selection.exit().remove();

        // Apply default event emitters to selection
        selection.on("click", function(element){
            this.parent.emit("element_clicked", element);
            this.parent.parent.emit("element_clicked", element);
        }.bind(this));
       
        // Apply selectable, tooltip, etc
        this.applyAllStatusBehaviors(selection);

        // Apply method to keep labels from overlapping each other
        if (this.layout.label){
            this.flip_labels();
            this.seperate_iterations = 0;
            this.separate_labels();
        }
        
    };
       
    return this;

});

/*********************
  Line Data Layer
  Implements a standard line plot
*/

LocusZoom.DataLayers.add("line", function(layout){

    // Define a default layout for this DataLayer type and merge it with the passed argument
    this.DefaultLayout = {
        style: {
            fill: "none",
            "stroke-width": "2px"
        },
        interpolate: "linear",
        x_axis: { field: "x" },
        y_axis: { field: "y", axis: 1 },
        hitarea_width: 5
    };
    layout = LocusZoom.mergeLayouts(layout, this.DefaultLayout);

    // Var for storing mouse events for use in tool tip positioning
    this.mouse_event = null;

    // Var for storing the generated line function itself
    this.line = null;

    this.tooltip_timeout = null;

    // Apply the arguments to set LocusZoom.DataLayer as the prototype
    LocusZoom.DataLayer.apply(this, arguments);

    // Helper function to get display and data objects representing
    // the x/y coordinates of the current mouse event with respect to the line in terms of the display
    // and the interpolated values of the x/y fields with respect to the line
    this.getMouseDisplayAndData = function(){
        var ret = {
            display: {
                x: d3.mouse(this.mouse_event)[0],
                y: null
            },
            data: {},
            slope: null
        };
        var x_field = this.layout.x_axis.field;
        var y_field = this.layout.y_axis.field;
        var x_scale = "x_scale";
        var y_scale = "y" + this.layout.y_axis.axis + "_scale";
        ret.data[x_field] = this.parent[x_scale].invert(ret.display.x);
        var bisect = d3.bisector(function(datum) { return +datum[x_field]; }).left;
        var index = bisect(this.data, ret.data[x_field]) - 1;
        var startDatum = this.data[index];
        var endDatum = this.data[index + 1];
        var interpolate = d3.interpolateNumber(+startDatum[y_field], +endDatum[y_field]);
        var range = +endDatum[x_field] - +startDatum[x_field];
        ret.data[y_field] = interpolate((ret.data[x_field] % range) / range);
        ret.display.y = this.parent[y_scale](ret.data[y_field]);
        if (this.layout.tooltip.x_precision){
            ret.data[x_field] = ret.data[x_field].toPrecision(this.layout.tooltip.x_precision);
        }
        if (this.layout.tooltip.y_precision){
            ret.data[y_field] = ret.data[y_field].toPrecision(this.layout.tooltip.y_precision);
        }
        ret.slope = (this.parent[y_scale](endDatum[y_field]) - this.parent[y_scale](startDatum[y_field]))
                  / (this.parent[x_scale](endDatum[x_field]) - this.parent[x_scale](startDatum[x_field]));
        return ret;
    };

    // Reimplement the positionTooltip() method to be line-specific
    this.positionTooltip = function(id){
        if (typeof id != "string"){
            throw ("Unable to position tooltip: id is not a string");
        }
        if (!this.tooltips[id]){
            throw ("Unable to position tooltip: id does not point to a valid tooltip");
        }
        var tooltip = this.tooltips[id];
        var tooltip_box = tooltip.selector.node().getBoundingClientRect();
        var arrow_width = 7; // as defined in the default stylesheet
        var border_radius = 6; // as defined in the default stylesheet
        var stroke_width = parseFloat(this.layout.style["stroke-width"]) || 1;
        var page_origin = this.getPageOrigin();
        var data_layer_height = this.parent.layout.height - (this.parent.layout.margin.top + this.parent.layout.margin.bottom);
        var data_layer_width = this.parent.layout.width - (this.parent.layout.margin.left + this.parent.layout.margin.right);
        var top, left, arrow_top, arrow_left, arrow_type;

        // Determine x/y coordinates for display and data
        var dd = this.getMouseDisplayAndData();

        // If the absolute value of the slope of the line at this point is above 1 (including Infinity)
        // then position the tool tip left/right. Otherwise position top/bottom.
        if (Math.abs(dd.slope) > 1){

            // Position horizontally on the left or the right depending on which side of the plot the point is on
            if (dd.display.x <= this.parent.layout.width / 2){
                left = page_origin.x + dd.display.x + stroke_width + arrow_width + stroke_width;
                arrow_type = "left";
                arrow_left = -1 * (arrow_width + stroke_width);
            } else {
                left = page_origin.x + dd.display.x - tooltip_box.width - stroke_width - arrow_width - stroke_width;
                arrow_type = "right";
                arrow_left = tooltip_box.width - stroke_width;
            }
            // Position vertically centered unless we're at the top or bottom of the plot
            if (dd.display.y - (tooltip_box.height / 2) <= 0){ // Too close to the top, push it down
                top = page_origin.y + dd.display.y - (1.5 * arrow_width) - border_radius;
                arrow_top = border_radius;
            } else if (dd.display.y + (tooltip_box.height / 2) >= data_layer_height){ // Too close to the bottom, pull it up
                top = page_origin.y + dd.display.y + arrow_width + border_radius - tooltip_box.height;
                arrow_top = tooltip_box.height - (2 * arrow_width) - border_radius;
            } else { // vertically centered
                top = page_origin.y + dd.display.y - (tooltip_box.height / 2);
                arrow_top = (tooltip_box.height / 2) - arrow_width;
            }

        } else {

            // Position horizontally: attempt to center on the mouse's x coordinate
            // pad to either side if bumping up against the edge of the data layer
            var offset_right = Math.max((tooltip_box.width / 2) - dd.display.x, 0);
            var offset_left = Math.max((tooltip_box.width / 2) + dd.display.x - data_layer_width, 0);
            left = page_origin.x + dd.display.x - (tooltip_box.width / 2) - offset_left + offset_right;
            var min_arrow_left = arrow_width / 2;
            var max_arrow_left = tooltip_box.width - (2.5 * arrow_width);
            arrow_left = (tooltip_box.width / 2) - arrow_width + offset_left - offset_right;
            arrow_left = Math.min(Math.max(arrow_left, min_arrow_left), max_arrow_left);

            // Position vertically above the line unless there's insufficient space
            if (tooltip_box.height + stroke_width + arrow_width > dd.display.y){
                top = page_origin.y + dd.display.y + stroke_width + arrow_width;
                arrow_type = "up";
                arrow_top = 0 - stroke_width - arrow_width;
            } else {
                top = page_origin.y + dd.display.y - (tooltip_box.height + stroke_width + arrow_width);
                arrow_type = "down";
                arrow_top = tooltip_box.height - stroke_width;
            }
        }

        // Apply positions to the main div
        tooltip.selector.style({ left: left + "px", top: top + "px" });
        // Create / update position on arrow connecting tooltip to data
        if (!tooltip.arrow){
            tooltip.arrow = tooltip.selector.append("div").style("position", "absolute");
        }
        tooltip.arrow
            .attr("class", "lz-data_layer-tooltip-arrow_" + arrow_type)
            .style({ "left": arrow_left + "px", top: arrow_top + "px" });

    };


    // Implement the main render function
    this.render = function(){

        // Several vars needed to be in scope
        var data_layer = this;
        var panel = this.parent;
        var x_field = this.layout.x_axis.field;
        var y_field = this.layout.y_axis.field;
        var x_scale = "x_scale";
        var y_scale = "y" + this.layout.y_axis.axis + "_scale";

        // Join data to the line selection
        var selection = this.svg.group
            .selectAll("path.lz-data_layer-line")
            .data([this.data]);

        // Create path element, apply class
        selection.enter()
            .append("path")
            .attr("class", "lz-data_layer-line");

        // Generate the line
        this.line = d3.svg.line()
            .x(function(d) { return panel[x_scale](d[x_field]); })
            .y(function(d) { return panel[y_scale](d[y_field]); })
            .interpolate(this.layout.interpolate);

        // Apply line and style
        if (this.canTransition()){
            selection
                .transition()
                .duration(this.layout.transition.duration || 0)
                .ease(this.layout.transition.ease || "cubic-in-out")
                .attr("d", this.line)
                .style(this.layout.style);
        } else {
            selection
                .attr("d", this.line)
                .style(this.layout.style);
        }

        // Apply tooltip, etc
        if (this.layout.tooltip){
            // Generate an overlaying transparent "hit area" line for more intuitive mouse events
            var hitarea_width = parseFloat(this.layout.hitarea_width).toString() + "px";
            var hitarea = this.svg.group
                .selectAll("path.lz-data_layer-line-hitarea")
                .data([this.data]);
            hitarea.enter()
                .append("path")
                .attr("class", "lz-data_layer-line-hitarea")
                .style("stroke-width", hitarea_width);
            var hitarea_line = d3.svg.line()
                .x(function(d) { return panel[x_scale](d[x_field]); })
                .y(function(d) { return panel[y_scale](d[y_field]); })
                .interpolate(this.layout.interpolate);
            hitarea
                .attr("d", hitarea_line)
                .on("mouseover", function(){
                    clearTimeout(data_layer.tooltip_timeout);
                    data_layer.mouse_event = this;
                    var dd = data_layer.getMouseDisplayAndData();
                    data_layer.createTooltip(dd.data);
                })
                .on("mousemove", function(){
                    clearTimeout(data_layer.tooltip_timeout);
                    data_layer.mouse_event = this;
                    var dd = data_layer.getMouseDisplayAndData();
                    data_layer.updateTooltip(dd.data);
                    data_layer.positionTooltip(data_layer.getElementId());
                })
                .on("mouseout", function(){
                    data_layer.tooltip_timeout = setTimeout(function(){
                        data_layer.mouse_event = null;
                        data_layer.destroyTooltip(data_layer.getElementId());
                    }, 300);
                });
            hitarea.exit().remove();
        }

        // Remove old elements as needed
        selection.exit().remove();
        
    };
       
    return this;

});

/*********************
  Genes Data Layer
  Implements a data layer that will render gene tracks
*/

LocusZoom.DataLayers.add("genes", function(layout){

    // Define a default layout for this DataLayer type and merge it with the passed argument
    this.DefaultLayout = {
        label_font_size: 12,
        label_exon_spacing: 4,
        exon_height: 16,
        bounding_box_padding: 6,
        track_vertical_spacing: 10,
        hover_element: "bounding_box"
    };
    layout = LocusZoom.mergeLayouts(layout, this.DefaultLayout);

    // Apply the arguments to set LocusZoom.DataLayer as the prototype
    LocusZoom.DataLayer.apply(this, arguments);
    
    // Helper function to sum layout values to derive total height for a single gene track
    this.getTrackHeight = function(){
        return 2 * this.layout.bounding_box_padding
            + this.layout.label_font_size
            + this.layout.label_exon_spacing
            + this.layout.exon_height
            + this.layout.track_vertical_spacing;
    };

    // A gene may have arbitrarily many transcripts, but this data layer isn't set up to render them yet.
    // Stash a transcript_idx to point to the first transcript and use that for all transcript refs.
    this.transcript_idx = 0;
    
    this.tracks = 1;
    this.gene_track_index = { 1: [] }; // track-number-indexed object with arrays of gene indexes in the dataset

    // After we've loaded the genes interpret them to assign
    // each to a track so that they do not overlap in the view
    this.assignTracks = function(){

        // Function to get the width in pixels of a label given the text and layout attributes
        this.getLabelWidth = function(gene_name, font_size){
            var temp_text = this.svg.group.append("text")
                .attr("x", 0).attr("y", 0).attr("class", "lz-data_layer-genes lz-label")
                .style("font-size", font_size)
                .text(gene_name + "→");
            var label_width = temp_text.node().getBBox().width;
            temp_text.remove();
            return label_width;
        };

        // Reinitialize some metadata
        this.tracks = 1;
        this.gene_track_index = { 1: [] };

        this.data.map(function(d, g){

            // If necessary, split combined gene id / version fields into discrete fields.
            // NOTE: this may be an issue with CSG's genes data source that may eventually be solved upstream.
            if (this.data[g].gene_id && this.data[g].gene_id.indexOf(".")){
                var split = this.data[g].gene_id.split(".");
                this.data[g].gene_id = split[0];
                this.data[g].gene_version = split[1];
            }

            // Stash the transcript ID on the parent gene
            this.data[g].transcript_id = this.data[g].transcripts[this.transcript_idx].transcript_id;

            // Determine display range start and end, based on minimum allowable gene display width, bounded by what we can see
            // (range: values in terms of pixels on the screen)
            this.data[g].display_range = {
                start: this.parent.x_scale(Math.max(d.start, this.state.start)),
                end:   this.parent.x_scale(Math.min(d.end, this.state.end))
            };
            this.data[g].display_range.label_width = this.getLabelWidth(this.data[g].gene_name, this.layout.label_font_size);
            this.data[g].display_range.width = this.data[g].display_range.end - this.data[g].display_range.start;
            // Determine label text anchor (default to middle)
            this.data[g].display_range.text_anchor = "middle";
            if (this.data[g].display_range.width < this.data[g].display_range.label_width){
                if (d.start < this.state.start){
                    this.data[g].display_range.end = this.data[g].display_range.start
                        + this.data[g].display_range.label_width
                        + this.layout.label_font_size;
                    this.data[g].display_range.text_anchor = "start";
                } else if (d.end > this.state.end){
                    this.data[g].display_range.start = this.data[g].display_range.end
                        - this.data[g].display_range.label_width
                        - this.layout.label_font_size;
                    this.data[g].display_range.text_anchor = "end";
                } else {
                    var centered_margin = ((this.data[g].display_range.label_width - this.data[g].display_range.width) / 2)
                        + this.layout.label_font_size;
                    if ((this.data[g].display_range.start - centered_margin) < this.parent.x_scale(this.state.start)){
                        this.data[g].display_range.start = this.parent.x_scale(this.state.start);
                        this.data[g].display_range.end = this.data[g].display_range.start + this.data[g].display_range.label_width;
                        this.data[g].display_range.text_anchor = "start";
                    } else if ((this.data[g].display_range.end + centered_margin) > this.parent.x_scale(this.state.end)) {
                        this.data[g].display_range.end = this.parent.x_scale(this.state.end);
                        this.data[g].display_range.start = this.data[g].display_range.end - this.data[g].display_range.label_width;
                        this.data[g].display_range.text_anchor = "end";
                    } else {
                        this.data[g].display_range.start -= centered_margin;
                        this.data[g].display_range.end += centered_margin;
                    }
                }
                this.data[g].display_range.width = this.data[g].display_range.end - this.data[g].display_range.start;
            }
            // Add bounding box padding to the calculated display range start, end, and width
            this.data[g].display_range.start -= this.layout.bounding_box_padding;
            this.data[g].display_range.end   += this.layout.bounding_box_padding;
            this.data[g].display_range.width += 2 * this.layout.bounding_box_padding;
            // Convert and stash display range values into domain values
            // (domain: values in terms of the data set, e.g. megabases)
            this.data[g].display_domain = {
                start: this.parent.x_scale.invert(this.data[g].display_range.start),
                end:   this.parent.x_scale.invert(this.data[g].display_range.end)
            };
            this.data[g].display_domain.width = this.data[g].display_domain.end - this.data[g].display_domain.start;

            // Using display range/domain data generated above cast each gene to tracks such that none overlap
            this.data[g].track = null;
            var potential_track = 1;
            while (this.data[g].track == null){
                var collision_on_potential_track = false;
                this.gene_track_index[potential_track].map(function(placed_gene){
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
                    this.gene_track_index[potential_track].push(this.data[g]);
                } else {
                    potential_track++;
                    if (potential_track > this.tracks){
                        this.tracks = potential_track;
                        this.gene_track_index[potential_track] = [];
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

    // Implement the main render function
    this.render = function(){

        this.assignTracks();

        var width, height, x, y;

        // Render gene groups
        var selection = this.svg.group.selectAll("g.lz-data_layer-genes")
            .data(this.data, function(d){ return d.gene_name; });

        selection.enter().append("g")
            .attr("class", "lz-data_layer-genes");
        
        selection.attr("id", function(d){ return this.getElementId(d); }.bind(this))
            .each(function(gene){

                var data_layer = gene.parent;

                // Render gene bounding box
                var bboxes = d3.select(this).selectAll("rect.lz-data_layer-genes.lz-data_layer-genes-bounding_box")
                    .data([gene], function(d){ return d.gene_name + "_bbox"; });

                bboxes.enter().append("rect")
                    .attr("class", "lz-data_layer-genes lz-data_layer-genes-bounding_box");
                
                bboxes
                    .attr("id", function(d){
                        return data_layer.getElementId(d) + "_bounding_box";
                    })
                    .attr("rx", function(){
                        return data_layer.layout.bounding_box_padding;
                    })
                    .attr("ry", function(){
                        return data_layer.layout.bounding_box_padding;
                    });

                width = function(d){
                    return d.display_range.width;
                };
                height = function(){
                    return data_layer.getTrackHeight() - data_layer.layout.track_vertical_spacing;
                };
                x = function(d){
                    return d.display_range.start;
                };
                y = function(d){
                    return ((d.track-1) * data_layer.getTrackHeight());
                };
                if (data_layer.canTransition()){
                    bboxes
                        .transition()
                        .duration(data_layer.layout.transition.duration || 0)
                        .ease(data_layer.layout.transition.ease || "cubic-in-out")
                        .attr("width", width).attr("height", height).attr("x", x).attr("y", y);
                } else {
                    bboxes
                        .attr("width", width).attr("height", height).attr("x", x).attr("y", y);
                }

                bboxes.exit().remove();

                // Render gene boundaries
                var boundaries = d3.select(this).selectAll("rect.lz-data_layer-genes.lz-boundary")
                    .data([gene], function(d){ return d.gene_name + "_boundary"; });

                boundaries.enter().append("rect")
                    .attr("class", "lz-data_layer-genes lz-boundary");

                width = function(d){
                    return data_layer.parent.x_scale(d.end) - data_layer.parent.x_scale(d.start);
                };
                height = function(){
                    return 1; // TODO: scale dynamically?
                };
                x = function(d){
                    return data_layer.parent.x_scale(d.start);
                };
                y = function(d){
                    return ((d.track-1) * data_layer.getTrackHeight())
                        + data_layer.layout.bounding_box_padding
                        + data_layer.layout.label_font_size
                        + data_layer.layout.label_exon_spacing
                        + (Math.max(data_layer.layout.exon_height, 3) / 2);
                };
                if (data_layer.canTransition()){
                    boundaries
                        .transition()
                        .duration(data_layer.layout.transition.duration || 0)
                        .ease(data_layer.layout.transition.ease || "cubic-in-out")
                        .attr("width", width).attr("height", height).attr("x", x).attr("y", y);
                } else {
                    boundaries
                        .attr("width", width).attr("height", height).attr("x", x).attr("y", y);
                }
                
                boundaries.exit().remove();

                // Render gene labels
                var labels = d3.select(this).selectAll("text.lz-data_layer-genes.lz-label")
                    .data([gene], function(d){ return d.gene_name + "_label"; });

                labels.enter().append("text")
                    .attr("class", "lz-data_layer-genes lz-label");

                labels
                    .attr("text-anchor", function(d){
                        return d.display_range.text_anchor;
                    })
                    .text(function(d){
                        return (d.strand == "+") ? d.gene_name + "→" : "←" + d.gene_name;
                    })
                    .style("font-size", gene.parent.layout.label_font_size);

                x = function(d){
                    if (d.display_range.text_anchor == "middle"){
                        return d.display_range.start + (d.display_range.width / 2);
                    } else if (d.display_range.text_anchor == "start"){
                        return d.display_range.start + data_layer.layout.bounding_box_padding;
                    } else if (d.display_range.text_anchor == "end"){
                        return d.display_range.end - data_layer.layout.bounding_box_padding;
                    }
                };
                y = function(d){
                    return ((d.track-1) * data_layer.getTrackHeight())
                        + data_layer.layout.bounding_box_padding
                        + data_layer.layout.label_font_size;
                };
                if (data_layer.canTransition()){
                    labels
                        .transition()
                        .duration(data_layer.layout.transition.duration || 0)
                        .ease(data_layer.layout.transition.ease || "cubic-in-out")
                        .attr("x", x).attr("y", y);
                } else {
                    labels
                        .attr("x", x).attr("y", y);
                }

                labels.exit().remove();

                // Render exon rects (first transcript only, for now)
                var exons = d3.select(this).selectAll("rect.lz-data_layer-genes.lz-exon")
                    .data(gene.transcripts[gene.parent.transcript_idx].exons, function(d){ return d.exon_id; });
                        
                exons.enter().append("rect")
                    .attr("class", "lz-data_layer-genes lz-exon");
                        
                width = function(d){
                    return data_layer.parent.x_scale(d.end) - data_layer.parent.x_scale(d.start);
                };
                height = function(){
                    return data_layer.layout.exon_height;
                };
                x = function(d){
                    return data_layer.parent.x_scale(d.start);
                };
                y = function(){
                    return ((gene.track-1) * data_layer.getTrackHeight())
                        + data_layer.layout.bounding_box_padding
                        + data_layer.layout.label_font_size
                        + data_layer.layout.label_exon_spacing;
                };
                if (data_layer.canTransition()){
                    exons
                        .transition()
                        .duration(data_layer.layout.transition.duration || 0)
                        .ease(data_layer.layout.transition.ease || "cubic-in-out")
                        .attr("width", width).attr("height", height).attr("x", x).attr("y", y);
                } else {
                    exons
                        .attr("width", width).attr("height", height).attr("x", x).attr("y", y);
                }

                exons.exit().remove();

                // Render gene click area
                var clickareas = d3.select(this).selectAll("rect.lz-data_layer-genes.lz-clickarea")
                    .data([gene], function(d){ return d.gene_name + "_clickarea"; });

                clickareas.enter().append("rect")
                    .attr("class", "lz-data_layer-genes lz-clickarea");

                clickareas
                    .attr("id", function(d){
                        return data_layer.getElementId(d) + "_clickarea";
                    })
                    .attr("rx", function(){
                        return data_layer.layout.bounding_box_padding;
                    })
                    .attr("ry", function(){
                        return data_layer.layout.bounding_box_padding;
                    });

                width = function(d){
                    return d.display_range.width;
                };
                height = function(){
                    return data_layer.getTrackHeight() - data_layer.layout.track_vertical_spacing;
                };
                x = function(d){
                    return d.display_range.start;
                }
                y = function(d){
                    return ((d.track-1) * data_layer.getTrackHeight());
                };
                if (data_layer.canTransition()){
                    clickareas
                        .transition()
                        .duration(data_layer.layout.transition.duration || 0)
                        .ease(data_layer.layout.transition.ease || "cubic-in-out")
                        .attr("width", width).attr("height", height).attr("x", x).attr("y", y);
                } else {
                    clickareas
                        .attr("width", width).attr("height", height).attr("x", x).attr("y", y);
                }

                // Remove old clickareas as needed
                clickareas.exit().remove();

                // Apply default event emitters to clickareas
                clickareas.on("click", function(element){
                    this.parent.emit("element_clicked", element);
                    this.parent.parent.emit("element_clicked", element);
                }.bind(this));

                // Apply selectable, tooltip, etc to clickareas
                data_layer.applyAllStatusBehaviors(clickareas);

            });

        // Remove old elements as needed
        selection.exit().remove();

    };

    // Reimplement the positionTooltip() method to be gene-specific
    this.positionTooltip = function(id){
        if (typeof id != "string"){
            throw ("Unable to position tooltip: id is not a string");
        }
        if (!this.tooltips[id]){
            throw ("Unable to position tooltip: id does not point to a valid tooltip");
        }
        var tooltip = this.tooltips[id];
        var arrow_width = 7; // as defined in the default stylesheet
        var stroke_width = 1; // as defined in the default stylesheet
        var page_origin = this.getPageOrigin();
        var tooltip_box = tooltip.selector.node().getBoundingClientRect();
        var gene_bbox_id = this.getElementId(tooltip.data) + "_bounding_box";
        var gene_bbox = d3.select("#" + gene_bbox_id).node().getBBox();
        var data_layer_height = this.parent.layout.height - (this.parent.layout.margin.top + this.parent.layout.margin.bottom);
        var data_layer_width = this.parent.layout.width - (this.parent.layout.margin.left + this.parent.layout.margin.right);
        // Position horizontally: attempt to center on the portion of the gene that's visible,
        // pad to either side if bumping up against the edge of the data layer
        var gene_center_x = ((tooltip.data.display_range.start + tooltip.data.display_range.end) / 2) - (this.layout.bounding_box_padding / 2);
        var offset_right = Math.max((tooltip_box.width / 2) - gene_center_x, 0);
        var offset_left = Math.max((tooltip_box.width / 2) + gene_center_x - data_layer_width, 0);
        var left = page_origin.x + gene_center_x - (tooltip_box.width / 2) - offset_left + offset_right;
        var arrow_left = (tooltip_box.width / 2) - (arrow_width / 2) + offset_left - offset_right;
        // Position vertically below the gene unless there's insufficient space
        var top, arrow_type, arrow_top;
        if (tooltip_box.height + stroke_width + arrow_width > data_layer_height - (gene_bbox.y + gene_bbox.height)){
            top = page_origin.y + gene_bbox.y - (tooltip_box.height + stroke_width + arrow_width);
            arrow_type = "down";
            arrow_top = tooltip_box.height - stroke_width;
        } else {
            top = page_origin.y + gene_bbox.y + gene_bbox.height + stroke_width + arrow_width;
            arrow_type = "up";
            arrow_top = 0 - stroke_width - arrow_width;
        }
        // Apply positions to the main div
        tooltip.selector.style("left", left + "px").style("top", top + "px");
        // Create / update position on arrow connecting tooltip to data
        if (!tooltip.arrow){
            tooltip.arrow = tooltip.selector.append("div").style("position", "absolute");
        }
        tooltip.arrow
            .attr("class", "lz-data_layer-tooltip-arrow_" + arrow_type)
            .style("left", arrow_left + "px")
            .style("top", arrow_top + "px");
    };
       
    return this;

});


/************************
  Controls Components

  ...
*/

LocusZoom.ControlsComponent = function(layout, parent) {
    this.layout = layout || {};
    this.parent = parent || null;
    this.selector = null;
    this.buttons = [];
    if (!this.layout.position){ this.layout.position = "left"; }
    return this;
};
LocusZoom.ControlsComponent.prototype.show = function(){
    if (!this.parent || !this.parent.selector){ return; }
    this.selector = this.parent.selector.append("div")
        .attr("class", "lz-controls-" + this.layout.position);
    return this.update();
};
LocusZoom.ControlsComponent.prototype.update = function(){ return this; };
LocusZoom.ControlsComponent.prototype.persist = function(){ return false; };
LocusZoom.ControlsComponent.prototype.hide = function(){
    if (!this.persist()){
        this.buttons = [];
        this.selector.remove();
        this.selector = null;
    }
};

LocusZoom.ControlsComponents = (function() {
    var obj = {};
    var components = {};

    obj.get = function(name, layout, parent) {
        if (!name) {
            return null;
        } else if (components[name]) {
            if (typeof layout != "object"){
                throw("invalid layout argument for controls component [" + name + "]");
            } else {
                return new components[name](layout, parent);
            }
        } else {
            throw("controls component [" + name + "] not found");
        }
    };

    obj.set = function(name, component) {
        if (component) {
            if (typeof component != "function"){
                throw("unable to set controls component [" + name + "], argument provided is not a function");
            } else {
                components[name] = component;
                components[name].prototype = new LocusZoom.ControlsComponent();
            }
        } else {
            delete components[name];
        }
    };

    obj.add = function(name, component) {
        if (components[name]) {
            throw("controls component already exists with name: " + name);
        } else {
            obj.set(name, component);
        }
    };

    obj.list = function() {
        return Object.keys(components);
    };

    return obj;
})();

/**

  LocusZoom.ControlsComponent.Button Class

  Plots and panels may have a "controls" element suited for showing HTML components that may be interactive.
  When components need to incoroprate a generic button, or additionally a button that generates a menu, this
  class provides much of the necessary framework.

*/

LocusZoom.ControlsComponent.Button = function(parent) {   

    if (!(parent instanceof LocusZoom.ControlsComponent)){
        throw "Unable to create controls component button, invalid parent";
    }
    this.parent = parent;

    this.showing = false;
    this.persist = false;
    this.selector = null;

    // Tag controls
    this.tag = "button";
    this.setTag = function(tag){
        this.tag = tag;
        return this;
    };

    // HTML controls
    this.text = "";
    this.setText = function(text){
        this.text = text;
        return this;
    };

    // Title controls (HTML built-in tool tip)
    this.title = "";
    this.setTitle = function(title){
        this.title = title;
        return this;
    };

    // Color controls (using predefined CSS classes as opposed to styles)
    this.color = "gray";
    this.setColor = function(color){
        if (["gray", "red", "orange", "yellow", "blue", "purple"].indexOf(color) !== -1){ this.color = color; }
        return this;
    };

    // Style controls
    this.style = {};
    this.setStyle = function(style){
        this.style = style;
        return this;
    };

    // Permanance controls
    this.permanent = false;
    this.setPermanent = function(bool){
        if (typeof bool == "undefined"){ bool = true; } else { bool = Boolean(bool); }
        this.permanent = bool;
        if (this.permanent){ this.persist = true; }
        return this;
    };

    // Status controls (highlighted / disabled)
    this.status = "";
    this.setStatus = function(status){
        if (["", "highlighted", "disabled"].indexOf(status) !== -1){ this.status = status; }
        return this;
    };
    this.highlight = function(bool){
        if (typeof bool == "undefined"){ bool = true; } else { bool = Boolean(bool); }
        if (bool){ return this.setStatus("highlighted"); }
        else if (this.status == "highlighted"){ return this.setStatus(""); }
        return this;
    };
    this.disable = function(bool){
        if (typeof bool == "undefined"){ bool = true; } else { bool = Boolean(bool); }
        if (bool){ return this.setStatus("disabled"); }
        else if (this.status == "disabled"){ return this.setStatus(""); }
        return this;
    };

    // Mouse event controls
    this.onmouseover = function(){};
    this.setOnMouseover = function(onmouseover){
        if (typeof onmouseover == "function"){ this.onmouseover = onmouseover; }
        else { this.onmouseover = function(){}; }
        return this;
    };
    this.onmouseout = function(){};
    this.setOnMouseout = function(onmouseout){
        if (typeof onmouseout == "function"){ this.onmouseout = onmouseout; }
        else { this.onmouseout = function(){}; }
        return this;
    };
    this.onclick = function(){};
    this.setOnclick = function(onclick){
        if (typeof onclick == "function"){ this.onclick = onclick; }
        else { this.onclick = function(){}; }
        return this;
    };
    
    // Primary behavior functions
    this.show = function(){
        if (!this.parent){ return; }
        if (!this.showing){
            this.selector = this.parent.selector.append(this.tag)
                .attr("class", "lz-controls-button");
            this.showing = true;
        }
        return this.update();
    };
    this.preUpdate = function(){ return this; };
    this.update = function(){
        if (!this.showing){ return this; }
        this.preUpdate();
        this.selector
            .attr("class", "lz-controls-button lz-controls-button-" + this.color + (this.status ? "-" + this.status : ""))
            .attr("title", this.title).style(this.style)
            .on("mouseover", (this.status == "disabled") ? null : this.onmouseover)
            .on("mouseout", (this.status == "disabled") ? null : this.onmouseout)
            .on("click", (this.status == "disabled") ? null : this.onclick)
            .text(this.text);
        if (this.menu.enabled){ this.menu.update(); }
        this.postUpdate();
        return this;
    };
    this.postUpdate = function(){ return this; };
    this.hide = function(){
        if (this.showing && !this.persist){
            this.selector.remove();
            this.selector = null;
            this.showing = false;
        }
        return this;
    };    

    // Menu object and controls
    this.menu = {
        outer_selector: null,
        inner_selector: null,
        showing: false,
        enabled: false
    };
    this.menu.show = function(){
        if (this.menu.showing){ return this; }
        this.menu.outer_selector = d3.select(this.parent.parent.svg.node().parentNode).append("div")
            .attr("class", "lz-panel-controls lz-panel-controls-menu lz-panel-controls-menu-" + this.color)
            .attr("id", this.parent.getBaseId() + ".controls." + this.id + ".menu");
        this.menu.inner_selector = this.menu.outer_selector.append("div")
            .attr("class", "lz-panel-controls-menu-content");
        this.menu.showing = true;
        return this.menu.update();
    }.bind(this);
    this.menu.update = function(){
        if (!this.menu.showing){ return this.menu; }
        this.menu.populate(); // This is the custom part
        return this.menu.position();
    }.bind(this);
    this.menu.position = function(){
        if (!this.menu.showing){ return this.menu; }
        var padding = 3;
        var page_origin = this.parent.getPageOrigin();
        var controls_client_rect = this.parent.controls.selector.node().getBoundingClientRect();
        var menu_client_rect = this.menu.outer_selector.node().getBoundingClientRect();
        var total_content_height = this.menu.inner_selector.node().scrollHeight;
        var top = (page_origin.y + controls_client_rect.height + padding).toString() + "px";
        var left = Math.max(page_origin.x + this.parent.layout.width - menu_client_rect.width - padding, page_origin.x + padding).toString() + "px";
        var base_max_width = (this.parent.layout.width - (2 * padding));
        var container_max_width = base_max_width.toString() + "px";
        var content_max_width = (base_max_width - (4 * padding)).toString() + "px";
        var base_max_height = (this.parent.layout.height - (7 * padding) - controls_client_rect.height);
        var height = Math.min(total_content_height, base_max_height).toString() + "px";
        var max_height = base_max_height.toString() + "px";
        this.menu.outer_selector.style({
            top: top, left: left,
            "max-width": container_max_width,
            "max-height": max_height,
            height: height
        });
        this.menu.inner_selector.style({ "max-width": content_max_width });        
        return this.menu;
    }.bind(this);
    this.menu.hide = function(){
        if (!this.menu.showing){ return this.menu; }
        this.menu.inner_selector.remove();
        this.menu.outer_selector.remove();
        this.menu.inner_selector = null;
        this.menu.outer_selector = null;
        this.menu.showing = false;
        return this.menu;
    }.bind(this);
    // By convention populate() does nothing and should be reimplemented with each controls button definition
    // Reimplement by way of ControlsComponent.Button.menuPopulate to define the populate method and hook up standard menu
    // click-toggle behaviorprototype.
    this.menu.populate = function(){
        this.menu.inner_selector.html("...");
    }.bind(this);
    this.menuPopulate = function(menu_populate_function){
        if (typeof menu_populate_function == "function"){
            this.menu.populate = menu_populate_function;
            this.setOnclick(function(){
                if (!this.menu.showing){
                    this.menu.show();
                    this.highlight().update();
                    this.persist = true;
                } else {
                    this.menu.hide();
                    this.highlight(false).update();
                    if (!this.permanent){
                        this.persist = false;
                    }
                }
            }.bind(this));
            this.menu.enabled = true;
        } else {
            this.setOnclick();
            this.menu.enabled = false;
        }
        return this;
    };

};

// Title component - show a generic title
LocusZoom.ControlsComponents.add("title", function(layout){
    LocusZoom.ControlsComponent.apply(this, arguments);
    this.show = function(){
        this.selector = this.parent.selector.append("div")
            .attr("class", "lz-controls-title lz-controls-" + this.layout.position);
        return this.update();
    };
    this.update = function(){
        this.selector.text(layout.title);
        return this;
    };
});

// Dimensions component - show current dimensions of the plot
LocusZoom.ControlsComponents.add("dimensions", function(layout){
    LocusZoom.ControlsComponent.apply(this, arguments);
    this.update = function(){
        var display_width = this.parent.parent.layout.width.toString().indexOf(".") == -1 ? this.parent.parent.layout.width : this.parent.parent.layout.width.toFixed(2);
        var display_height = this.parent.parent.layout.height.toString().indexOf(".") == -1 ? this.parent.parent.layout.height : this.parent.parent.layout.height.toFixed(2);
        this.selector.text(display_width + "px × " + display_height + "px");
        return this;
    };
});

// Region Scale component - show the size of the region in state
LocusZoom.ControlsComponents.add("region_scale", function(layout){
    LocusZoom.ControlsComponent.apply(this, arguments);
    this.update = function(){
        if (!isNaN(this.parent.parent.state.start) && !isNaN(this.parent.parent.state.end)
            && this.parent.parent.state.start != null && this.parent.parent.state.end != null){
            this.selector.style("display", null);
            this.selector.text(LocusZoom.positionIntToString(this.parent.parent.state.end - this.parent.parent.state.start, null, true));
        } else {
            this.selector.style("display", "none");
        }
        return this;
    };
});

// Download SVG component - button to export current plot to an SVG
LocusZoom.ControlsComponents.add("download_svg", function(layout){
    LocusZoom.ControlsComponent.apply(this, arguments);
    this.update = function(){
        if (this.buttons[0]){ return this; }
        this.buttons[0] = new LocusZoom.ControlsComponent.Button(this)
            .setTag("a").setColor("gray").setText("Download SVG").setTitle("Download SVG as locuszoom.svg")
            .setOnMouseover(function() {
                this.buttons[0].selector
                    .classed("lz-controls-button-gray-disabled", true)
                    .text("Preparing SVG");
                this.generateBase64SVG().then(function(base64_string){
                    this.buttons[0].selector
                        .attr("href", "data:image/svg+xml;base64,\n" + base64_string)
                        .classed("lz-controls-button-gray-disabled", false)
                        .classed("lz-controls-button-gray-highlighted", true)
                        .text("Download SVG");
                }.bind(this));
            }.bind(this))
            .setOnMouseout(function() {
                this.buttons[0].selector.classed("lz-controls-button-gray-highlighted", false);
            }.bind(this));
        this.buttons[0].show();
        this.buttons[0].selector.attr("href-lang", "image/svg+xml").attr("download", "locuszoom.svg");
        return this;
    };
    this.css_string = "";
    for (var stylesheet in Object.keys(document.styleSheets)){
        if ( document.styleSheets[stylesheet].href != null
             && document.styleSheets[stylesheet].href.indexOf("locuszoom.css") != -1){
            LocusZoom.createCORSPromise("GET", document.styleSheets[stylesheet].href)
                .then(function(response){
                    this.css_string = response.replace(/[\r\n]/g," ");
                }.bind(this));
            break;
        }
    } 
    this.generateBase64SVG = function(){
        return Q.fcall(function () {
            // Insert a hidden div, clone the node into that so we can modify it with d3
            var container = this.parent.selector.append("div").style("display", "none")
                .html(this.parent.parent.svg.node().outerHTML);
            // Remove unnecessary elements
            container.selectAll("g.lz-curtain").remove();
            container.selectAll("g.lz-ui").remove();
            container.selectAll("g.lz-mouse_guide").remove();
            // Pull the svg into a string and add the contents of the locuszoom stylesheet
            // Don't add this with d3 because it will escape the CDATA declaration incorrectly
            var initial_html = d3.select(container.select("svg").node().parentNode).html();
            var style_def = "<style type=\"text/css\"><![CDATA[ " + this.css_string + " ]]></style>";
            var insert_at = initial_html.indexOf(">") + 1;
            initial_html = initial_html.slice(0,insert_at) + style_def + initial_html.slice(insert_at);
            // Delete the container node
            container.remove();
            // Base64-encode the string and return it
            return btoa(encodeURIComponent(initial_html).replace(/%([0-9A-F]{2})/g, function(match, p1) {
                return String.fromCharCode("0x" + p1);
            }));
        }.bind(this));
    }
});

// Remove Panel component - button to remove panel from plot
LocusZoom.ControlsComponents.add("remove_panel", function(layout){
    LocusZoom.ControlsComponent.apply(this, arguments);
    this.update = function(){
        if (this.buttons[0]){ return this; }
        this.buttons[0] = new LocusZoom.ControlsComponent.Button(this)
            .setColor("red").setText("×").setTitle("Remove panel")
            .setOnclick(function(){
                var panel = this.parent.parent;
                panel.controls.hide(true);
                d3.select(panel.parent.svg.node().parentNode).on("mouseover." + panel.getBaseId() + ".controls", null);
                d3.select(panel.parent.svg.node().parentNode).on("mouseout." + panel.getBaseId() + ".controls", null);
                panel.parent.removePanel(panel.id);
            }.bind(this));
        this.buttons[0].show();
        return this;
    };
});
