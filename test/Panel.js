"use strict";

/**
  Instance.js Tests
  Test composition of the LocusZoom.Panel object and its base classes
*/

var jsdom = require('mocha-jsdom');
var fs = require("fs");
var assert = require('assert');
var should = require("should");

describe('LocusZoom.Panel', function(){

    // Load all javascript files
    jsdom({
        src: [ fs.readFileSync('./assets/js/vendor/should.min.js'),
               fs.readFileSync('./assets/js/vendor/d3.min.js'),
               fs.readFileSync('./assets/js/vendor/q.min.js'),
               fs.readFileSync('./assets/js/app/LocusZoom.js'),
               fs.readFileSync('./assets/js/app/Instance.js'),
               fs.readFileSync('./assets/js/app/Panel.js'),
               fs.readFileSync('./assets/js/app/DataLayer.js'),
               fs.readFileSync('./assets/js/app/Singletons.js'),
               fs.readFileSync('./assets/js/app/Data.js')
             ]
    });

    // Reset DOM after each test
    afterEach(function(){
        d3.select("body").selectAll("*").remove();
    });

    // Tests
    it("creates an object for its name space", function() {
        should.exist(LocusZoom.Panel);
    });

    it("defines its layout defaults", function() {
        LocusZoom.Panel.should.have.property('DefaultLayout').which.is.an.Object;
    });

    describe("Constructor", function() {
        beforeEach(function(){
            d3.select("body").append("div").attr("id", "instance_id");
            this.instance = LocusZoom.populate("#instance_id");
            this.panel = this.instance.panels.positions;
        });
        it("returns an object", function() {
            this.panel.should.be.an.Object;
        });
        it('should have an id', function(){
            this.panel.should.have.property('id');
        });
        it('should have an object for tracking data layers', function(){
            this.panel.should.have.property('data_layers').which.is.an.Object;
        });
        it('should track dimensions, margins, and positioning with a layout object', function(){
            this.panel.should.have.property('layout').which.is.an.Object;
            this.panel.layout.width.should.be.a.Number;
            this.panel.layout.height.should.be.a.Number;
            this.panel.layout.min_width.should.be.a.Number;
            this.panel.layout.min_height.should.be.a.Number;
            this.panel.layout.proportional_width.should.be.a.Number;
            this.panel.layout.proportional_height.should.be.a.Number;
            this.panel.layout.origin.should.be.an.Object;
            this.panel.layout.origin.should.have.property('x').which.is.a.Number
            this.panel.layout.origin.should.have.property('y').which.is.a.Number;
            this.panel.layout.margin.should.be.an.Object;
            this.panel.layout.margin.should.have.property('top').which.is.a.Number
            this.panel.layout.margin.should.have.property('right').which.is.a.Number;
            this.panel.layout.margin.should.have.property('bottom').which.is.a.Number;
            this.panel.layout.margin.should.have.property('left').which.is.a.Number;
            this.panel.layout.cliparea.should.be.an.Object;
            this.panel.layout.cliparea.should.have.property('width').which.is.a.Number
            this.panel.layout.cliparea.should.have.property('height').which.is.a.Number;
            this.panel.layout.cliparea.should.have.property('origin').which.is.an.Object;
            this.panel.layout.cliparea.origin.should.have.property('x').which.is.a.Number;
            this.panel.layout.cliparea.origin.should.have.property('y').which.is.a.Number;
        });
        it('should generate an ID if passed a layout that does not define one', function(){
            this.instance.addPanel({ "foo": "bar" });
            var panel_idx = this.instance.layout.panels.length - 1;
            this.instance.layout.panels[panel_idx].should.have.property("id").which.is.a.String;
            this.instance.layout.panels[panel_idx].foo.should.be.exactly("bar");
            this.instance.panels[this.instance.layout.panels[panel_idx].id].should.be.an.Object;
            this.instance.panels[this.instance.layout.panels[panel_idx].id].layout.foo.should.be.exactly("bar");
        });
        it('should throw an error if adding a panel with an ID that is already used', function(){
            this.instance.addPanel({ "id": "duplicate", "foo": "bar" });
            assert.throws(function(){
                this.instance.addPanel({ "id": "duplicate", "foo2": "bar2" });
            }.bind(this));
        });
    });

    describe("Geometry methods", function() {
        beforeEach(function(){
            d3.select("body").append("div").attr("id", "instance_id");
            this.instance = LocusZoom.populate("#instance_id");
            this.panel = this.instance.panels.positions;
        });
        it('should allow changing dimensions', function(){
            this.panel.setDimensions(840, 560);
            this.panel.layout.should.have.property('width').which.is.exactly(840);
            this.panel.layout.should.have.property('height').which.is.exactly(560);
            this.panel.setDimensions(9000, -50);
            this.panel.layout.should.have.property('width').which.is.exactly(840);
            this.panel.layout.should.have.property('height').which.is.exactly(560);
            this.panel.setDimensions("q", 942);
            this.panel.layout.should.have.property('width').which.is.exactly(840);
            this.panel.layout.should.have.property('height').which.is.exactly(560);
        });
        it('should enforce minimum dimensions', function(){
            this.panel.layout.width.should.not.be.lessThan(this.panel.layout.min_width);
            this.panel.layout.height.should.not.be.lessThan(this.panel.layout.min_height);
            this.panel.setDimensions(this.panel.layout.min_width / 2, 0);
            this.panel.layout.width.should.not.be.lessThan(this.panel.layout.min_width);
            this.panel.layout.height.should.not.be.lessThan(this.panel.layout.min_height);
            this.panel.setDimensions(0, this.panel.layout.min_height / 2);
            this.panel.layout.width.should.not.be.lessThan(this.panel.layout.min_width);
            this.panel.layout.height.should.not.be.lessThan(this.panel.layout.min_height);
        });
        it('should allow setting origin irrespective of instance dimensions', function(){
            this.instance.setDimensions(500, 600);
            this.panel.setOrigin(20, 50);
            this.panel.layout.origin.x.should.be.exactly(20);
            this.panel.layout.origin.y.should.be.exactly(50);
            this.panel.setOrigin(0, 0);
            this.panel.layout.origin.x.should.be.exactly(0);
            this.panel.layout.origin.y.should.be.exactly(0);
            this.panel.setOrigin("q", { foo: "bar" });
            this.panel.layout.origin.x.should.be.exactly(0);
            this.panel.layout.origin.y.should.be.exactly(0);
            this.panel.setOrigin(700, 800);
            this.panel.layout.origin.x.should.be.exactly(700);
            this.panel.layout.origin.y.should.be.exactly(800);
        });
        it('should allow setting margin, which sets cliparea origin and dimensions', function(){
            this.panel.setMargin(1, 2, 3, 4);
            this.panel.layout.margin.top.should.be.exactly(1);
            this.panel.layout.margin.right.should.be.exactly(2);
            this.panel.layout.margin.bottom.should.be.exactly(3);
            this.panel.layout.margin.left.should.be.exactly(4);
            this.panel.layout.cliparea.origin.x.should.be.exactly(4);
            this.panel.layout.cliparea.origin.y.should.be.exactly(1);
            this.panel.layout.cliparea.width.should.be.exactly(this.panel.layout.width - (2 + 4));
            this.panel.layout.cliparea.height.should.be.exactly(this.panel.layout.height - (1 + 3));
            this.panel.setMargin(0, "12", -17, {foo: "bar"});
            this.panel.layout.margin.top.should.be.exactly(0);
            this.panel.layout.margin.right.should.be.exactly(12);
            this.panel.layout.margin.bottom.should.be.exactly(3);
            this.panel.layout.margin.left.should.be.exactly(4);
            this.panel.layout.cliparea.origin.x.should.be.exactly(4);
            this.panel.layout.cliparea.origin.y.should.be.exactly(0);
            this.panel.layout.cliparea.width.should.be.exactly(this.panel.layout.width - (12 + 4));
            this.panel.layout.cliparea.height.should.be.exactly(this.panel.layout.height - (0 + 3));
        });
        it('should prevent margins from overlapping', function(){
            this.panel.setDimensions(500, 500);
            this.panel.setMargin(700, 1000, 900, 800);
            this.panel.layout.margin.should.have.property('top').which.is.exactly(150);
            this.panel.layout.margin.should.have.property('right').which.is.exactly(350);
            this.panel.layout.margin.should.have.property('bottom').which.is.exactly(350);
            this.panel.layout.margin.should.have.property('left').which.is.exactly(150);
        });
    });

    describe("Panel Curtain and Loader", function() {
        beforeEach(function(){
            var datasources = new LocusZoom.DataSources();
            this.layout = {
                width: 100,
                height: 100,
                min_width: 100,
                min_height: 100,
                resizable: false,
                aspect_ratio: 1,
                panels: [
                    { id: "test",
                      width: 100,
                      height: 100 }
                ],
                controls: []
            };
            d3.select("body").append("div").attr("id", "plot");
            this.plot = LocusZoom.populate("#plot", datasources, this.layout);
            this.panel = this.plot.panels.test;
        });
        it("should have a curtain object with show/update/hide methods, a showing boolean, and selectors", function(){
            this.panel.should.have.property("curtain").which.is.an.Object;
            this.panel.curtain.should.have.property("showing").which.is.exactly(false);
            this.panel.curtain.should.have.property("show").which.is.a.Function;
            this.panel.curtain.should.have.property("update").which.is.a.Function;
            this.panel.curtain.should.have.property("hide").which.is.a.Function;
            this.panel.curtain.should.have.property("selector").which.is.exactly(null);
            this.panel.curtain.should.have.property("content_selector").which.is.exactly(null);
        });
        it("should show/hide/update on command and track shown status", function(){
            this.panel.curtain.showing.should.be.false;
            this.panel.curtain.should.have.property("selector").which.is.exactly(null);
            this.panel.curtain.should.have.property("content_selector").which.is.exactly(null);
            this.panel.curtain.show("test content");
            this.panel.curtain.showing.should.be.true;
            this.panel.curtain.selector.empty().should.be.false;
            this.panel.curtain.content_selector.empty().should.be.false;
            this.panel.curtain.content_selector.html().should.be.exactly("test content");
            this.panel.curtain.hide();
            this.panel.curtain.showing.should.be.false;
            this.panel.curtain.should.have.property("selector").which.is.exactly(null);
            this.panel.curtain.should.have.property("content_selector").which.is.exactly(null);
        });
        it("should have a loader object with show/update/animate/setPercentCompleted/hide methods, a showing boolean, and selectors", function(){
            this.panel.should.have.property("loader").which.is.an.Object;
            this.panel.loader.should.have.property("showing").which.is.false;
            this.panel.loader.should.have.property("show").which.is.a.Function;
            this.panel.loader.should.have.property("update").which.is.a.Function;
            this.panel.loader.should.have.property("animate").which.is.a.Function;
            this.panel.loader.should.have.property("update").which.is.a.Function;
            this.panel.loader.should.have.property("setPercentCompleted").which.is.a.Function;
            this.panel.loader.should.have.property("selector").which.is.exactly(null);
            this.panel.loader.should.have.property("content_selector").which.is.exactly(null);
            this.panel.loader.should.have.property("progress_selector").which.is.exactly(null);
        });
        it("should show/hide/update on command and track shown status", function(){
            this.panel.loader.showing.should.be.false;
            this.panel.loader.should.have.property("selector").which.is.exactly(null);
            this.panel.loader.should.have.property("content_selector").which.is.exactly(null);
            this.panel.loader.should.have.property("progress_selector").which.is.exactly(null);
            this.panel.loader.show("test content");
            this.panel.loader.showing.should.be.true;
            this.panel.loader.selector.empty().should.be.false;
            this.panel.loader.content_selector.empty().should.be.false;
            this.panel.loader.content_selector.html().should.be.exactly("test content");
            this.panel.loader.progress_selector.empty().should.be.false;
            this.panel.loader.hide();
            this.panel.loader.showing.should.be.false;
            this.panel.loader.should.have.property("selector").which.is.exactly(null);
            this.panel.loader.should.have.property("content_selector").which.is.exactly(null);
            this.panel.loader.should.have.property("progress_selector").which.is.exactly(null);
        });
        it("should allow for animating or showing discrete percentages of completion", function(){
            this.panel.loader.show("test content").animate();
            this.panel.loader.progress_selector.classed("lz-loader-progress-animated").should.be.true;
            this.panel.loader.setPercentCompleted(15);
            this.panel.loader.content_selector.html().should.be.exactly("test content");
            this.panel.loader.progress_selector.classed("lz-loader-progress-animated").should.be.false;
            this.panel.loader.progress_selector.style("width").should.be.exactly("15%");
            this.panel.loader.update("still loading...", 62);
            this.panel.loader.content_selector.html().should.be.exactly("still loading...");
            this.panel.loader.progress_selector.style("width").should.be.exactly("62%");
            this.panel.loader.setPercentCompleted(200);
            this.panel.loader.progress_selector.style("width").should.be.exactly("100%");
            this.panel.loader.setPercentCompleted(-43);
            this.panel.loader.progress_selector.style("width").should.be.exactly("1%");
            this.panel.loader.setPercentCompleted("foo");
            this.panel.loader.progress_selector.style("width").should.be.exactly("1%");
        });
    });

    /*
    describe("Panel Controls and Control Buttons", function() {
        beforeEach(function(){
            var datasources = new LocusZoom.DataSources();
            this.layout = {
                width: 100,
                height: 100,
                min_width: 100,
                min_height: 100,
                resizable: false,
                aspect_ratio: 1,
                panels: [],
                controls: false
            };
            d3.select("body").append("div").attr("id", "plot");
            this.plot = LocusZoom.populate("#plot", datasources, this.layout);
            this.panel = this.plot.panels.test;
        });
        it("panels should have a controls element with buttons as defined in the panel layout", function(){
            var test1 = this.plot.addPanel({
                id: "test1",
                controls: { remove: true }
            });
            test1.should.have.property("controls").which.is.an.Object;
            test1.controls.should.have.property("showing").which.is.exactly(false);
            test1.controls.should.have.property("selector").which.is.exactly(null);
            test1.controls.should.have.property("show").which.is.a.Function;
            test1.controls.should.have.property("update").which.is.a.Function;
            test1.controls.should.have.property("position").which.is.a.Function;
            test1.controls.should.have.property("hide").which.is.a.Function;
            test1.controls.should.have.property("buttons").which.is.an.Object;
            assert.deepEqual(Object.keys(test1.controls.buttons), ["remove"]);
            assert.ok(test1.controls.buttons.remove instanceof LocusZoom.PanelControlsButton);
            var test2 = this.plot.addPanel({
                id: "test2",
                description: "Lorem ipsum",
                controls: { description: true }
            });
            assert.deepEqual(Object.keys(test2.controls.buttons), ["description"]);
            assert.ok(test2.controls.buttons.description instanceof LocusZoom.PanelControlsButton);
            var test3 = this.plot.addPanel({
                id: "test3",
                controls: { model: true, reposition: true }
            });
            assert.deepEqual(Object.keys(test3.controls.buttons), ["model", "reposition_down", "reposition_up"]);
            assert.ok(test3.controls.buttons.model instanceof LocusZoom.PanelControlsButton);
            assert.ok(test3.controls.buttons.reposition_down instanceof LocusZoom.PanelControlsButton);
            assert.ok(test3.controls.buttons.reposition_up instanceof LocusZoom.PanelControlsButton);
        });
        it("panel buttons should have show/hide/update and various property setter methods", function(){
            var test1 = this.plot.addPanel({
                id: "test1",
                controls: { remove: true }
            });
            var btn = test1.controls.buttons.remove;
            btn.should.have.property("id").which.is.a.String;
            assert.equal(btn.id, "remove");
            btn.should.have.property("parent").which.is.an.Object;
            assert.deepEqual(btn.parent, test1);
            btn.should.have.property("showing").which.is.exactly(false);
            btn.should.have.property("persist").which.is.exactly(false);
            btn.should.have.property("selector").which.is.exactly(null);
            btn.should.have.property("text").which.is.a.String;
            btn.should.have.property("setText").which.is.a.Function;
            btn.setText("foo");
            assert.equal(btn.text, "foo");
            btn.should.have.property("title").which.is.a.String;
            btn.should.have.property("setTitle").which.is.a.Function;
            btn.setTitle("bar");
            assert.equal(btn.title, "bar");
            btn.should.have.property("color").which.is.a.String;
            btn.should.have.property("setColor").which.is.a.Function;
            btn.setColor("red");
            assert.equal(btn.color, "red");
            btn.should.have.property("status").which.is.a.String;
            btn.should.have.property("setStatus").which.is.a.Function;
            btn.setStatus("highlighted");
            assert.equal(btn.status, "highlighted");
            btn.should.have.property("disable").which.is.a.Function;
            btn.should.have.property("highlight").which.is.a.Function;
            btn.disable();
            assert.equal(btn.status, "disabled");
            btn.disable(false);
            assert.equal(btn.status, "");
            btn.highlight();
            assert.equal(btn.status, "highlighted");
            btn.should.have.property("onclick").which.is.a.Function;
            btn.should.have.property("setOnclick").which.is.a.Function;
            var func = function(){ return "foo"; };
            btn.setOnclick(func);
            assert.deepEqual(btn.onclick, func);
            btn.should.have.property("show").which.is.a.Function;
            btn.should.have.property("preUpdate").which.is.a.Function;
            btn.should.have.property("update").which.is.a.Function;
            btn.should.have.property("postUpdate").which.is.a.Function;
            btn.should.have.property("hide").which.is.a.Function;
        });
        it("panel controls show and hide methods should add/remove DOM object", function(){
            var test1 = this.plot.addPanel({
                id: "test1",
                controls: { remove: true }
            });
            test1.controls.show();
            assert.ok(test1.controls.showing);
            test1.controls.selector.should.have.property("empty").which.is.a.Function;
            assert.equal(test1.controls.selector.empty(), false);
            assert.ok(test1.controls.selector.classed("lz-panel-controls"));
            assert.ok(test1.controls.buttons.remove.showing);
            test1.controls.buttons.remove.selector.should.have.property("empty").which.is.a.Function;
            assert.equal(test1.controls.buttons.remove.selector.empty(), false);
            assert.ok(test1.controls.buttons.remove.selector.classed("lz-panel-controls-button"));
            test1.controls.hide();
            assert.equal(test1.controls.showing, false);
            assert.equal(test1.controls.selector, null);
            assert.equal(test1.controls.buttons.remove.showing, false);
            assert.equal(test1.controls.buttons.remove.selector, null);
        });
        it("panel controls buttons that implement a menu should create/destroy menu DOM element on click", function(){
            var test1 = this.plot.addPanel({
                id: "test1",
                description: "Lorem ipsum",
                controls: { description: true }
            });
            test1.controls.buttons.description.should.have.property("menu").which.is.an.Object;
            test1.controls.buttons.description.menu.should.have.property("showing").which.is.exactly(false);
            test1.controls.buttons.description.menu.should.have.property("enabled").which.is.exactly(true);
            test1.controls.buttons.description.menu.should.have.property("outer_selector").which.is.exactly(null);
            test1.controls.buttons.description.menu.should.have.property("inner_selector").which.is.exactly(null);
            test1.controls.buttons.description.menu.should.have.property("show").which.is.a.Function;
            test1.controls.buttons.description.menu.should.have.property("update").which.is.a.Function;
            test1.controls.buttons.description.menu.should.have.property("position").which.is.a.Function;
            test1.controls.buttons.description.menu.should.have.property("hide").which.is.a.Function;
            test1.controls.show();
            test1.controls.buttons.description.selector.on("click")(); // toggle menu on
            assert.equal(test1.controls.buttons.description.status, "highlighted");
            assert.ok(test1.controls.buttons.description.menu.showing);
            test1.controls.buttons.description.menu.outer_selector.should.have.property("empty").which.is.a.Function;
            assert.equal(test1.controls.buttons.description.menu.outer_selector.empty(), false);
            assert.ok(test1.controls.buttons.description.menu.outer_selector.classed("lz-panel-controls-menu"));
            test1.controls.buttons.description.menu.inner_selector.should.have.property("empty").which.is.a.Function;
            assert.equal(test1.controls.buttons.description.menu.inner_selector.empty(), false);
            assert.ok(test1.controls.buttons.description.menu.inner_selector.classed("lz-panel-controls-menu-content"));
            assert.equal(test1.controls.buttons.description.menu.inner_selector.html(), "Lorem ipsum");
            test1.controls.buttons.description.selector.on("click")(); // toggle menu off
            assert.equal(test1.controls.buttons.description.menu.showing, false);
            assert.equal(test1.controls.buttons.description.menu.outer_selector, null);
            assert.equal(test1.controls.buttons.description.menu.inner_selector, null);
        });
    });
    */

    describe("Panel Interactions", function() {
        beforeEach(function(){
            this.plot = null;
            this.datasources = new LocusZoom.DataSources()
                .add("static", ["StaticJSON", [{ id: "a", x: 1, y: 2 }, { id: "b", x: 3, y: 4 }, { id: "c", x: 5, y: 6 }] ]);
            this.layout = {
                width: 100,
                height: 100,
                panels: [
                    {
                        id: "p",
                        width: 100,
                        height: 100,
                        axes: {
                            x: { label: "x" },
                            y1: { label: "y1" }
                        },
                        interaction: {},
                        data_layers: [
                            {
                                id: "d",
                                type: "scatter",
                                fields: ["static:id", "static:x", "static:y"],
                                id_field: "static:id",
                                z_index: 0,
                                x_axis: {
                                    field: "static:x"
                                },
                                y_axis: {
                                    axis: 1,
                                    field: "static:y"
                                }
                            }
                        ]
                    }
                ]
            };
            // Stash the original d3.mouse function as some of the tests in this suite will override it to simulate clicks
            this.d3_mouse_orig = d3.mouse;
            d3.select("body").append("div").attr("id", "plot");
        });
        afterEach(function(){
            d3.select("#plot").remove();
            d3.mouse = this.d3_mouse_orig;
            delete this.plot;
            delete this.datasources;
            delete this.layout;
        });
        it("should not establish any interaction mouse event handlers when no interaction layout directives are defined", function(){
            this.plot = LocusZoom.populate("#plot", this.datasources, this.layout);
            should.not.exist(this.plot.panels.p.svg.container.select(".lz-panel-background")["__onmousedown.plot.p.interaction.drag.background"]);
            should.not.exist(this.plot.svg.node()["__onmouseup.plot.p.interaction.drag.background"]);
            should.not.exist(this.plot.svg.node()["__onmousemove.plot.p.interaction.drag"]);
            should.not.exist(this.plot.panels.p.svg.container.node()["__onwheel.zoom"]);
        });
        it("should establish background drag interaction handlers when the layout directive is present", function(done){
            this.layout.panels[0].interaction.drag_background_to_pan = true;
            this.plot = LocusZoom.populate("#plot", this.datasources, this.layout);
            Q.all(this.plot.remap_promises).then(function(){
                assert.equal(typeof this.plot.panels.p.svg.container.select(".lz-panel-background").node()["__onmousedown.plot.p.interaction.drag.background"], "function");
                assert.equal(typeof this.plot.svg.node()["__onmouseup.plot.p.interaction.drag"], "function");
                assert.equal(typeof this.plot.svg.node()["__onmousemove.plot.p.interaction.drag"], "function");
                done();
            }.bind(this));
        });
        it("should establish x tick drag interaction handlers when the layout directives are present", function(done){
            this.layout.panels[0].interaction.drag_x_ticks_to_scale = true;
            this.plot = LocusZoom.populate("#plot", this.datasources, this.layout);
            Q.all(this.plot.remap_promises).then(function(){
                assert.equal(typeof this.plot.svg.node()["__onmouseup.plot.p.interaction.drag"], "function");
                assert.equal(typeof this.plot.svg.node()["__onmousemove.plot.p.interaction.drag"], "function");
                assert.equal(typeof this.plot.panels.p.svg.container.select(".lz-axis.lz-x .tick text").node()["__onmousedown.plot.p.interaction.drag"], "function");
                done();
            }.bind(this));
        });
        it("should establish y1 tick drag interaction handlers when the layout directives are present", function(done){
            this.layout.panels[0].interaction.drag_y1_ticks_to_scale = true;
            this.plot = LocusZoom.populate("#plot", this.datasources, this.layout);
            Q.all(this.plot.remap_promises).then(function(){
                assert.equal(typeof this.plot.svg.node()["__onmouseup.plot.p.interaction.drag"], "function");
                assert.equal(typeof this.plot.svg.node()["__onmousemove.plot.p.interaction.drag"], "function");
                assert.equal(typeof this.plot.panels.p.svg.container.select(".lz-axis.lz-y1 .tick text").node()["__onmousedown.plot.p.interaction.drag"], "function");
                done();
            }.bind(this));
        });
        it("should establish a zoom interaction handler on the panel when the layout directive is present", function(done){
            this.layout.panels[0].interaction.scroll_to_zoom = true;
            this.plot = LocusZoom.populate("#plot", this.datasources, this.layout);
            Q.all(this.plot.remap_promises).then(function(){
                assert.equal(typeof this.plot.panels.p.svg.container.node()["__onmousedown.zoom"], "function");
                done();
            }.bind(this));
        });
        it ("should pan along the x axis when dragging the background", function(done){
            this.layout.panels[0].interaction.drag_background_to_pan = true;
            this.plot = LocusZoom.populate("#plot", this.datasources, this.layout);
            Q.all(this.plot.remap_promises).then(function(){
                // Simulate click (mousedown) at [ 50, 50 ]
                d3.mouse = function(){ return [ 50, 50 ]; };
                this.plot.panels.p.svg.container.select(".lz-panel-background").node()["__onmousedown.plot.p.interaction.drag.background"]();
                this.plot.panels.p.interactions.should.be.an.Object;
                this.plot.panels.p.interactions.dragging.should.be.an.Object;
                this.plot.panels.p.interactions.dragging.method.should.be.exactly("background");
                this.plot.panels.p.interactions.dragging.start_x.should.be.exactly(50);
                this.plot.panels.p.interactions.dragging.start_y.should.be.exactly(50);
                this.plot.panels.p.interactions.dragging.dragged_x.should.be.exactly(0);
                this.plot.panels.p.interactions.dragging.dragged_y.should.be.exactly(0);
                // Simulate drag (mousemove) to [ 25, 50 ] (x -25)
                d3.mouse = function(){ return [ 25, 50 ]; };
                this.plot.svg.node()["__onmousemove.plot.p.interaction.drag"]();
                this.plot.panels.p.interactions.dragging.method.should.be.exactly("background");
                this.plot.panels.p.interactions.dragging.start_x.should.be.exactly(50);
                this.plot.panels.p.interactions.dragging.start_y.should.be.exactly(50);
                this.plot.panels.p.interactions.dragging.dragged_x.should.be.exactly(-25);
                this.plot.panels.p.interactions.dragging.dragged_y.should.be.exactly(0);
                assert.deepEqual(this.plot.panels.p.x_extent, [1,5]);
                assert.deepEqual(this.plot.panels.p.x_extent_shifted, [2,6]);
                // Simulate mouseup at new location
                this.plot.svg.node()["__onmouseup.plot.p.interaction.drag"]();
                this.plot.panels.p.interactions.dragging.should.be.false;
                this.plot.panels.p.data_layers.d.layout.x_axis.floor.should.be.exactly(2);
                this.plot.panels.p.data_layers.d.layout.x_axis.ceiling.should.be.exactly(6);
                done();
            }.bind(this));
        });
        it ("should scale along the x axis when dragging an x tick", function(done){
            this.layout.panels[0].interaction.drag_x_ticks_to_scale = true;
            this.plot = LocusZoom.populate("#plot", this.datasources, this.layout);
            Q.all(this.plot.remap_promises).then(function(){
                // Simulate click (mousedown) at [ 50, 0 ] (x tick probably doesn't exist there but that's okay)
                d3.mouse = function(){ return [ 50, 0 ]; };
                this.plot.panels.p.svg.container.select(".lz-axis.lz-x .tick text").node()["__onmousedown.plot.p.interaction.drag"]();
                this.plot.panels.p.interactions.should.be.an.Object;
                this.plot.panels.p.interactions.dragging.should.be.an.Object;
                this.plot.panels.p.interactions.dragging.method.should.be.exactly("x_tick");
                this.plot.panels.p.interactions.dragging.start_x.should.be.exactly(50);
                this.plot.panels.p.interactions.dragging.start_y.should.be.exactly(0);
                this.plot.panels.p.interactions.dragging.dragged_x.should.be.exactly(0);
                this.plot.panels.p.interactions.dragging.dragged_y.should.be.exactly(0);
                // Simulate drag (mousemove) to [ 25, 0 ] (x -25)
                d3.mouse = function(){ return [ 25, 0 ]; };
                this.plot.svg.node()["__onmousemove.plot.p.interaction.drag"]();
                this.plot.panels.p.interactions.dragging.method.should.be.exactly("x_tick");
                this.plot.panels.p.interactions.dragging.start_x.should.be.exactly(50);
                this.plot.panels.p.interactions.dragging.start_y.should.be.exactly(0);
                this.plot.panels.p.interactions.dragging.dragged_x.should.be.exactly(-25);
                this.plot.panels.p.interactions.dragging.dragged_y.should.be.exactly(0);
                assert.deepEqual(this.plot.panels.p.x_extent, [1,5]);
                assert.deepEqual(this.plot.panels.p.x_extent_shifted, [1,9]);
                // Simulate mouseup at new location
                this.plot.svg.node()["__onmouseup.plot.p.interaction.drag"]();
                this.plot.panels.p.interactions.dragging.should.be.false;
                this.plot.panels.p.data_layers.d.layout.x_axis.floor.should.be.exactly(1);
                this.plot.panels.p.data_layers.d.layout.x_axis.ceiling.should.be.exactly(9);
                done();
            }.bind(this));
        });
        it ("should pan along the x axis when shift+dragging an x tick", function(done){
            this.layout.panels[0].interaction.drag_x_ticks_to_scale = true;
            this.plot = LocusZoom.populate("#plot", this.datasources, this.layout);
            Q.all(this.plot.remap_promises).then(function(){
                var event = { shiftKey: true, preventDefault: function(){ return null; } };
                // Simulate shift+click (mousedown) at [ 50, 0 ] (x tick probably doesn't exist there but that's okay)
                d3.mouse = function(){ return [ 50, 0 ]; };
                this.plot.panels.p.svg.container.select(".lz-axis.lz-x .tick text").node()["__onmousedown.plot.p.interaction.drag"](event);
                this.plot.panels.p.interactions.should.be.an.Object;
                this.plot.panels.p.interactions.dragging.should.be.an.Object;
                this.plot.panels.p.interactions.dragging.method.should.be.exactly("x_tick");
                this.plot.panels.p.interactions.dragging.start_x.should.be.exactly(50);
                this.plot.panels.p.interactions.dragging.start_y.should.be.exactly(0);
                this.plot.panels.p.interactions.dragging.dragged_x.should.be.exactly(0);
                this.plot.panels.p.interactions.dragging.dragged_y.should.be.exactly(0);
                // Simulate drag (mousemove) to [ 25, 0 ] (x -25)
                d3.mouse = function(){ return [ 25, 0 ]; };
                this.plot.svg.node()["__onmousemove.plot.p.interaction.drag"](event);
                this.plot.panels.p.interactions.dragging.method.should.be.exactly("x_tick");
                this.plot.panels.p.interactions.dragging.start_x.should.be.exactly(50);
                this.plot.panels.p.interactions.dragging.start_y.should.be.exactly(0);
                this.plot.panels.p.interactions.dragging.dragged_x.should.be.exactly(-25);
                this.plot.panels.p.interactions.dragging.dragged_y.should.be.exactly(0);
                assert.deepEqual(this.plot.panels.p.x_extent, [1,5]);
                assert.deepEqual(this.plot.panels.p.x_extent_shifted, [2,6]);
                // Simulate mouseup at new location
                this.plot.svg.node()["__onmouseup.plot.p.interaction.drag"](event);
                this.plot.panels.p.interactions.dragging.should.be.false;
                this.plot.panels.p.data_layers.d.layout.x_axis.floor.should.be.exactly(2);
                this.plot.panels.p.data_layers.d.layout.x_axis.ceiling.should.be.exactly(6);
                done();
            }.bind(this));
        });
        it ("should scale along the y1 axis when dragging a y1 tick", function(done){
            this.layout.panels[0].interaction.drag_y1_ticks_to_scale = true;
            this.plot = LocusZoom.populate("#plot", this.datasources, this.layout);
            Q.all(this.plot.remap_promises).then(function(){
                // Simulate click (mousedown) at [ 0, 25 ] (y1 tick probably doesn't exist there but that's okay)
                d3.mouse = function(){ return [ 0, 25 ]; };
                this.plot.panels.p.svg.container.select(".lz-axis.lz-y1 .tick text").node()["__onmousedown.plot.p.interaction.drag"]();
                this.plot.panels.p.interactions.should.be.an.Object;
                this.plot.panels.p.interactions.dragging.should.be.an.Object;
                this.plot.panels.p.interactions.dragging.method.should.be.exactly("y1_tick");
                this.plot.panels.p.interactions.dragging.start_x.should.be.exactly(0);
                this.plot.panels.p.interactions.dragging.start_y.should.be.exactly(25);
                this.plot.panels.p.interactions.dragging.dragged_x.should.be.exactly(0);
                this.plot.panels.p.interactions.dragging.dragged_y.should.be.exactly(0);
                // Simulate drag (mousemove) to [ 0, 75 ] (x +50)
                d3.mouse = function(){ return [ 0, 75 ]; };
                this.plot.svg.node()["__onmousemove.plot.p.interaction.drag"]();
                this.plot.panels.p.interactions.dragging.method.should.be.exactly("y1_tick");
                this.plot.panels.p.interactions.dragging.start_x.should.be.exactly(0);
                this.plot.panels.p.interactions.dragging.start_y.should.be.exactly(25);
                this.plot.panels.p.interactions.dragging.dragged_x.should.be.exactly(0);
                this.plot.panels.p.interactions.dragging.dragged_y.should.be.exactly(50);
                assert.deepEqual(this.plot.panels.p.y1_extent, [2,6]);
                assert.deepEqual(this.plot.panels.p.y1_extent_shifted, [2,14]);
                // Simulate mouseup at new location
                this.plot.svg.node()["__onmouseup.plot.p.interaction.drag"]();
                this.plot.panels.p.interactions.dragging.should.be.false;
                this.plot.panels.p.data_layers.d.layout.y_axis.floor.should.be.exactly(2);
                this.plot.panels.p.data_layers.d.layout.y_axis.ceiling.should.be.exactly(14);
                done();
            }.bind(this));
        });
        it ("should pan along the y axis when shift+dragging a y tick", function(done){
            this.layout.panels[0].interaction.drag_y1_ticks_to_scale = true;
            this.plot = LocusZoom.populate("#plot", this.datasources, this.layout);
            Q.all(this.plot.remap_promises).then(function(){
                var event = { shiftKey: true, preventDefault: function(){ return null; } };
                // Simulate shift+click (mousedown) at [ 0, 25 ] (y1 tick probably doesn't exist there but that's okay)
                d3.mouse = function(){ return [ 0, 25 ]; };
                this.plot.panels.p.svg.container.select(".lz-axis.lz-y1 .tick text").node()["__onmousedown.plot.p.interaction.drag"](event);
                this.plot.panels.p.interactions.should.be.an.Object;
                this.plot.panels.p.interactions.dragging.should.be.an.Object;
                this.plot.panels.p.interactions.dragging.method.should.be.exactly("y1_tick");
                this.plot.panels.p.interactions.dragging.start_x.should.be.exactly(0);
                this.plot.panels.p.interactions.dragging.start_y.should.be.exactly(25);
                this.plot.panels.p.interactions.dragging.dragged_x.should.be.exactly(0);
                this.plot.panels.p.interactions.dragging.dragged_y.should.be.exactly(0);
                // Simulate drag (mousemove) to [ 0, 75 ] (x +50)
                d3.mouse = function(){ return [ 0, 75 ]; };
                this.plot.svg.node()["__onmousemove.plot.p.interaction.drag"](event);
                this.plot.panels.p.interactions.dragging.method.should.be.exactly("y1_tick");
                this.plot.panels.p.interactions.dragging.start_x.should.be.exactly(0);
                this.plot.panels.p.interactions.dragging.start_y.should.be.exactly(25);
                this.plot.panels.p.interactions.dragging.dragged_x.should.be.exactly(0);
                this.plot.panels.p.interactions.dragging.dragged_y.should.be.exactly(50);
                assert.deepEqual(this.plot.panels.p.y1_extent, [2,6]);
                assert.deepEqual(this.plot.panels.p.y1_extent_shifted, [4,8]);
                // Simulate mouseup at new location
                this.plot.svg.node()["__onmouseup.plot.p.interaction.drag"](event);
                this.plot.panels.p.interactions.dragging.should.be.false;
                this.plot.panels.p.data_layers.d.layout.y_axis.floor.should.be.exactly(4);
                this.plot.panels.p.data_layers.d.layout.y_axis.ceiling.should.be.exactly(8);
                done();
            }.bind(this));
        });
        it ("should zoom along x axis when scrolling", function(done){
            this.layout.panels[0].interaction.scroll_to_zoom = true;
            this.plot = LocusZoom.populate("#plot", this.datasources, this.layout);
            Q.all(this.plot.remap_promises).then(function(){
                // NOTE: d3 xoom behaviors are much more complicated than drag behaviors and as such are very
                // difficult to simulate programmatically in a node environment. This test therefore only checks
                // that the interaction object correctly tracks zoom start and end.
                this.plot.panels.p.zoom_listener.on("zoom")();
                this.plot.panels.p.interactions.should.be.an.Object;
                this.plot.panels.p.interactions.zooming.should.be.true;
                this.plot.panels.p.zoom_listener.on("zoomend")();
                this.plot.panels.p.interactions.zooming.should.be.false;
                done();
            }.bind(this));
        });
    });

});
