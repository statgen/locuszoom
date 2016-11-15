/* global require, describe, d3, LocusZoom, beforeEach, afterEach, it */

"use strict";

/**
  layouts.js Tests
  Test composition of the LocusZoom.Layouts object
*/

var jsdom = require("mocha-jsdom");
var fs = require("fs");
var assert = require("assert");
var should = require("should");
var files = require("../files.js");

describe("Layouts", function(){

    // Load all javascript files
    var src = [];
    files.test_include.forEach(function(file){ src.push(fs.readFileSync(file)); });
    jsdom({ src: src });

    // Reset DOM after each test
    afterEach(function(){
        d3.select("body").selectAll("*").remove();
    });

    // Tests
    describe("Should implement a Layouts namespace", function() {

        it("Creates an object for its name space", function() {
            should.exist(LocusZoom.Layouts);
        });

        // list()
        describe("Provides a method to list current layouts by type", function(){
            it ("Implements as list()", function(){
                LocusZoom.Layouts.list.should.be.a.Function;
            });
            it ("No argument: returns an object, keys are layout types and values are arrays of layout names", function(){
                var list = LocusZoom.Layouts.list();
                list.should.be.an.Object;
                list.plot.should.be.an.Array;
                list.plot[0].should.be.a.String;
                list.panel.should.be.an.Array;
                list.panel[0].should.be.a.String;
                list.data_layer.should.be.an.Array;
                list.data_layer[0].should.be.a.String;
                list.dashboard.should.be.an.Array;
                list.dashboard[0].should.be.a.String;
            });
            it ("Passed a valid type: returns array of layout names matching that type", function(){
                var list = LocusZoom.Layouts.list();
                var plots = LocusZoom.Layouts.list("plot");
                var panels = LocusZoom.Layouts.list("panel");
                var data_layers = LocusZoom.Layouts.list("data_layer");
                var dashboards = LocusZoom.Layouts.list("dashboard");
                plots.should.be.an.Array;
                panels.should.be.an.Array;
                data_layers.should.be.an.Array;
                dashboards.should.be.an.Array;
                assert.deepEqual(plots, list.plot);
                assert.deepEqual(panels, list.panel);
                assert.deepEqual(data_layers, list.data_layer);
                assert.deepEqual(dashboards, list.dashboard);
            });
            it ("Passed an invalid type: returns same as no argument", function(){
                var list = LocusZoom.Layouts.list();
                assert.deepEqual(LocusZoom.Layouts.list(0), list);
                assert.deepEqual(LocusZoom.Layouts.list("invalid_type"), list);
                assert.deepEqual(LocusZoom.Layouts.list({ plot: "panel" }), list);
                assert.deepEqual(LocusZoom.Layouts.list(function(){ return "foo"; }), list);
                assert.deepEqual(LocusZoom.Layouts.list(null), list);
            });
        });

        // add()
        describe("Provides a method to add new layouts", function(){
            it ("Implements as add()", function(){
                LocusZoom.Layouts.add.should.be.a.Function;
            });
            it ("Requires arguments as (string, string, object) or throws an exception", function(){
                (function(){
                    LocusZoom.Layouts.add();
                }).should.throw();
                (function(){
                    LocusZoom.Layouts.add("foo");
                }).should.throw();
                (function(){
                    LocusZoom.Layouts.add("foo","bar");
                }).should.throw();
                (function(){
                    LocusZoom.Layouts.add("foo",0,{ bar: "baz" });
                }).should.throw();
                (function(){
                    LocusZoom.Layouts.add("foo","bar","baz");
                }).should.throw();
                (function(){
                    LocusZoom.Layouts.add("foo",{ bar: "baz" },{ bar: "baz" });
                }).should.throw();
            });
            it ("Passed valid arguments with existing type: stores layout, adds to type list", function(){
                LocusZoom.Layouts.add("plot","foo", { foo: "bar" });
                assert.notEqual(LocusZoom.Layouts.list("plot").indexOf("foo"), -1);
                assert.deepEqual(LocusZoom.Layouts.get("plot","foo"), { foo: "bar" });
            });
            it ("Passed valid arguments with new type: stores layout, creates type list, adds to type list", function(){
                LocusZoom.Layouts.add("new_type","foo", { foo: "bar" });
                assert.deepEqual(LocusZoom.Layouts.list("new_type"), ["foo"]);
                assert.deepEqual(LocusZoom.Layouts.get("new_type","foo"), { foo: "bar" });
            });
        });

        // get()
        describe("Provides a method to get layout objects", function(){
            it ("Implements as get()", function(){
                LocusZoom.Layouts.get.should.be.a.Function;
            });
            it("Requires arguments as (string, string) or throws an exception", function(){
                (function(){
                    LocusZoom.Layouts.get();
                }).should.throw();
                (function(){
                    LocusZoom.Layouts.get("foo");
                }).should.throw();
                (function(){
                    LocusZoom.Layouts.get("bar", 0);
                }).should.throw();
                (function(){
                    LocusZoom.Layouts.get({ foo: "bar" }, "baz");
                }).should.throw();
                (function(){
                    LocusZoom.Layouts.get(null, "foo");
                }).should.throw();
            });
            it ("Returns layout object when type and name match", function(){
                LocusZoom.Layouts.add("plot", "foo", { foo: 123 });
                LocusZoom.Layouts.add("panel", "baz", { foo: "bar" });
                assert.deepEqual(LocusZoom.Layouts.get("plot","foo"), { foo: 123 });
                assert.deepEqual(LocusZoom.Layouts.get("panel","baz"), { foo: "bar" });
            });
            it ("Accepts a modifications object for the third argument to alter the returned layout", function(){
                var base_layout = {
                    scalar_1: 123,
                    scalar_2: "foo",
                    array_of_scalars: [ 4, 5, 6 ],
                    nested_object: {
                        property_1: {
                            alpha: 0,
                            bravo: "foo",
                            charlie: ["delta", "echo"],
                            foxtrot: {
                                golf: "bar",
                                hotel: ["india", "juliet", "kilo"]
                            }
                        },
                        property_2: false,
                        property_3: true
                    }
                };
                var mods = {
                    scalar_1: 456,
                    array_of_scalars: [ 1, 2, 3 ],
                    nested_object: {
                        property_1: {
                            foxtrot: {
                                golf: 789,
                                new_value: "foo"
                            }
                        },
                        property_3: false,
                        new_value: "bar"
                    },
                    new_value: "baz"
                };
                var expected_layout = {
                    scalar_1: 456,
                    scalar_2: "foo",
                    array_of_scalars: [ 1, 2, 3 ],
                    nested_object: {
                        property_1: {
                            alpha: 0,
                            bravo: "foo",
                            charlie: ["delta", "echo"],
                            foxtrot: {
                                golf: 789,
                                hotel: ["india", "juliet", "kilo"],
                                new_value: "foo"
                            }
                        },
                        property_2: false,
                        property_3: false,
                        new_value: "bar"
                    },
                    new_value: "baz"
                };
                LocusZoom.Layouts.add("test", "test", base_layout);
                assert.deepEqual(LocusZoom.Layouts.get("test","test", mods), expected_layout);
            });
            it ("Allows for namespacing arbitrary keys and values at all nesting levels", function(){
                var base_layout = {
                    scalar_0: 123,
                    "{{namespace}}scalar_1": "aardvark",
                    "{{namespace[dingo]}}scalar_2": "{{namespace[1]}}albacore",
                    namespace_scalar: "{{namespace}}badger",
                    namespace_0_scalar: "{{namespace[0]}}crocodile",
                    namespace_dingo_scalar: "{{namespace[dingo]}}emu",
                    namespace_1_scalar: "{{namespace[1]}}ferret",
                    array_of_scalars: [ 4, 5, 6 ],
                    nested_object: {
                        property_0: {
                            scalar_0: 0,
                            scalar_1: "grackle",
                            namespace_scalar: "{{{{namespace}}hog}} and {{{{namespace[1]}}yak}} and {{{{namespace[jackal]}}zebu}}",
                            namespace_0_scalar: "{{namespace[0]}}iguana",
                            namespace_jackal_scalar: "{{namespace[jackal]}}kangaroo",
                            namespace_dingo_scalar: "{{namespace[dingo]}}lemur",
                            namespace_1_scalar: "{{namespace[1]}}moose",
                            array: ["nematoad", "{{namespace}}oryx", "{{namespace[1]}}pigeon", "{{namespace[jackal]}}quail"],
                            object: {
                                scalar: "rhea",
                                array: ["serpent", "{{namespace[0]}}tortoise", "{{namespace[upapa]}}vulture", "{{namespace}}xerus"]
                            }
                        },
                        property_1: false,
                        property_2: true
                    }
                };
                LocusZoom.Layouts.add("test", "test", base_layout);
                // Explicit directive to NOT apply namespaces: no changes
                var unnamespaced_layout = LocusZoom.Layouts.get("test","test",{ unnamespaced: true });
                assert.deepEqual(unnamespaced_layout, base_layout);
                // No defined namespaces: drop all namespaces
                var no_namespace_layout = LocusZoom.Layouts.get("test","test");
                no_namespace_layout["scalar_1"].should.be.exactly("aardvark");
                no_namespace_layout["scalar_2"].should.be.exactly("albacore");
                no_namespace_layout.namespace_scalar.should.be.exactly("badger");
                no_namespace_layout.namespace_0_scalar.should.be.exactly("crocodile");
                no_namespace_layout.namespace_dingo_scalar.should.be.exactly("emu");
                no_namespace_layout.namespace_1_scalar.should.be.exactly("ferret");
                no_namespace_layout.nested_object.property_0.namespace_scalar.should.be.exactly("{{hog}} and {{yak}} and {{zebu}}");
                no_namespace_layout.nested_object.property_0.namespace_0_scalar.should.be.exactly("iguana");
                no_namespace_layout.nested_object.property_0.namespace_jackal_scalar.should.be.exactly("kangaroo");
                no_namespace_layout.nested_object.property_0.namespace_dingo_scalar.should.be.exactly("lemur");
                no_namespace_layout.nested_object.property_0.namespace_1_scalar.should.be.exactly("moose");
                no_namespace_layout.nested_object.property_0.array[1].should.be.exactly("oryx");
                no_namespace_layout.nested_object.property_0.array[2].should.be.exactly("pigeon");
                no_namespace_layout.nested_object.property_0.array[3].should.be.exactly("quail");
                no_namespace_layout.nested_object.property_0.object.array[1].should.be.exactly("tortoise");
                no_namespace_layout.nested_object.property_0.object.array[2].should.be.exactly("vulture");
                no_namespace_layout.nested_object.property_0.object.array[3].should.be.exactly("xerus");
                // Single namespace string: use in place of all namespace placeholders
                var single_namespace_layout = LocusZoom.Layouts.get("test","test", { namespace: "ns" });
                single_namespace_layout["ns:scalar_1"].should.be.exactly("aardvark");
                single_namespace_layout["ns:scalar_2"].should.be.exactly("ns:albacore");
                single_namespace_layout.namespace_scalar.should.be.exactly("ns:badger");
                single_namespace_layout.namespace_0_scalar.should.be.exactly("ns:crocodile");
                single_namespace_layout.namespace_dingo_scalar.should.be.exactly("ns:emu");
                single_namespace_layout.namespace_1_scalar.should.be.exactly("ns:ferret");
                single_namespace_layout.nested_object.property_0.namespace_scalar.should.be.exactly("{{ns:hog}} and {{ns:yak}} and {{ns:zebu}}");
                single_namespace_layout.nested_object.property_0.namespace_0_scalar.should.be.exactly("ns:iguana");
                single_namespace_layout.nested_object.property_0.namespace_jackal_scalar.should.be.exactly("ns:kangaroo");
                single_namespace_layout.nested_object.property_0.namespace_dingo_scalar.should.be.exactly("ns:lemur");
                single_namespace_layout.nested_object.property_0.namespace_1_scalar.should.be.exactly("ns:moose");
                single_namespace_layout.nested_object.property_0.array[1].should.be.exactly("ns:oryx");
                single_namespace_layout.nested_object.property_0.array[2].should.be.exactly("ns:pigeon");
                single_namespace_layout.nested_object.property_0.array[3].should.be.exactly("ns:quail");
                single_namespace_layout.nested_object.property_0.object.array[1].should.be.exactly("ns:tortoise");
                single_namespace_layout.nested_object.property_0.object.array[2].should.be.exactly("ns:vulture");
                single_namespace_layout.nested_object.property_0.object.array[3].should.be.exactly("ns:xerus");
                // Array of namespaces: replace number-indexed namespace holders,
                // resolve {{namespace}} and any named namespaces to {{namespace[0]}}.
                var array_namespace_layout = LocusZoom.Layouts.get("test","test", { namespace: [ "ns_0", "ns_1" ] });
                array_namespace_layout["ns_0:scalar_1"].should.be.exactly("aardvark");
                array_namespace_layout["ns_0:scalar_2"].should.be.exactly("ns_1:albacore");
                array_namespace_layout.namespace_scalar.should.be.exactly("ns_0:badger");
                array_namespace_layout.namespace_0_scalar.should.be.exactly("ns_0:crocodile");
                array_namespace_layout.namespace_dingo_scalar.should.be.exactly("ns_0:emu");
                array_namespace_layout.namespace_1_scalar.should.be.exactly("ns_1:ferret");
                array_namespace_layout.nested_object.property_0.namespace_scalar.should.be.exactly("{{ns_0:hog}} and {{ns_1:yak}} and {{ns_0:zebu}}");
                array_namespace_layout.nested_object.property_0.namespace_0_scalar.should.be.exactly("ns_0:iguana");
                array_namespace_layout.nested_object.property_0.namespace_jackal_scalar.should.be.exactly("ns_0:kangaroo");
                array_namespace_layout.nested_object.property_0.namespace_dingo_scalar.should.be.exactly("ns_0:lemur");
                array_namespace_layout.nested_object.property_0.namespace_1_scalar.should.be.exactly("ns_1:moose");
                array_namespace_layout.nested_object.property_0.array[1].should.be.exactly("ns_0:oryx");
                array_namespace_layout.nested_object.property_0.array[2].should.be.exactly("ns_1:pigeon");
                array_namespace_layout.nested_object.property_0.array[3].should.be.exactly("ns_0:quail");
                array_namespace_layout.nested_object.property_0.object.array[1].should.be.exactly("ns_0:tortoise");
                array_namespace_layout.nested_object.property_0.object.array[2].should.be.exactly("ns_0:vulture");
                array_namespace_layout.nested_object.property_0.object.array[3].should.be.exactly("ns_0:xerus");
                // first defined key to any non-matching namespaces.
                var object_namespace_layout = LocusZoom.Layouts.get("test","test", { namespace: { dingo: "ns_dingo", jackal: "ns_jackal", 1: "ns_1", "default": "ns_default" } });
                object_namespace_layout["ns_default:scalar_1"].should.be.exactly("aardvark");
                object_namespace_layout["ns_dingo:scalar_2"].should.be.exactly("ns_1:albacore");
                object_namespace_layout.namespace_scalar.should.be.exactly("ns_default:badger");
                object_namespace_layout.namespace_0_scalar.should.be.exactly("ns_default:crocodile");
                object_namespace_layout.namespace_dingo_scalar.should.be.exactly("ns_dingo:emu");
                object_namespace_layout.namespace_1_scalar.should.be.exactly("ns_1:ferret");
                object_namespace_layout.nested_object.property_0.namespace_scalar.should.be.exactly("{{ns_default:hog}} and {{ns_1:yak}} and {{ns_jackal:zebu}}");
                object_namespace_layout.nested_object.property_0.namespace_0_scalar.should.be.exactly("ns_default:iguana");
                object_namespace_layout.nested_object.property_0.namespace_jackal_scalar.should.be.exactly("ns_jackal:kangaroo");
                object_namespace_layout.nested_object.property_0.namespace_dingo_scalar.should.be.exactly("ns_dingo:lemur");
                object_namespace_layout.nested_object.property_0.namespace_1_scalar.should.be.exactly("ns_1:moose");
                object_namespace_layout.nested_object.property_0.array[1].should.be.exactly("ns_default:oryx");
                object_namespace_layout.nested_object.property_0.array[2].should.be.exactly("ns_1:pigeon");
                object_namespace_layout.nested_object.property_0.array[3].should.be.exactly("ns_jackal:quail");
                object_namespace_layout.nested_object.property_0.object.array[1].should.be.exactly("ns_default:tortoise");
                object_namespace_layout.nested_object.property_0.object.array[2].should.be.exactly("ns_default:vulture");
                object_namespace_layout.nested_object.property_0.object.array[3].should.be.exactly("ns_default:xerus");
            });
            it ("Allows for inheriting namespaces", function(){
                var layout_0 = {
                    namespace: { dingo: "ns_dingo", jackal: "ns_jackal", default: "ns_0" },
                    "{{namespace[dingo]}}scalar_1": "aardvark",
                    "{{namespace[dingo]}}scalar_2": "{{namespace[jackal]}}albacore",
                    scalar_3: "{{namespace}}badger"
                };
                LocusZoom.Layouts.add("test", "layout_0", layout_0);
                var layout_1 = {
                    namespace: { ferret: "ns_ferret", default: "ns_1" },
                    "{{namespace}}scalar_1": "emu",
                    "{{namespace[ferret]}}scalar_2": "{{namespace}}kangaroo",
                    nested_layout: LocusZoom.Layouts.get("test", "layout_0", { unnamespaced: true })
                };
                LocusZoom.Layouts.add("test", "layout_1", layout_1);
                var ns_layout_1 = LocusZoom.Layouts.get("test", "layout_1", { namespace: { dingo: "ns_dingo_mod", default: "ns_mod" } });
                ns_layout_1["ns_mod:scalar_1"].should.exist;
                ns_layout_1["ns_mod:scalar_1"].should.be.exactly("emu");
                ns_layout_1["ns_ferret:scalar_2"].should.exist;
                ns_layout_1["ns_ferret:scalar_2"].should.be.exactly("ns_mod:kangaroo");
                ns_layout_1.nested_layout.should.be.an.Object;
                ns_layout_1.nested_layout["ns_dingo_mod:scalar_1"].should.exist;
                ns_layout_1.nested_layout["ns_dingo_mod:scalar_1"].should.be.exactly("aardvark");
                ns_layout_1.nested_layout["ns_dingo_mod:scalar_2"].should.exist;
                ns_layout_1.nested_layout["ns_dingo_mod:scalar_2"].should.be.exactly("ns_jackal:albacore");
                ns_layout_1.nested_layout.scalar_3.should.be.exactly("ns_mod:badger");                
            });
        });

        describe("Provides a method to merge layout objects", function() {
            beforeEach(function(){
                this.default_layout = {
                    scalar_1: 123,
                    scalar_2: "foo",
                    array_of_scalars: [ 4, 5, 6 ],
                    nested_object: {
                        property_1: {
                            alpha: 0,
                            bravo: "foo",
                            charlie: ["delta", "echo"],
                            foxtrot: {
                                golf: "bar",
                                hotel: ["india", "juliet", "kilo"]
                            }
                        },
                        property_2: false,
                        property_3: true
                    }
                };
            });
            it("should have a method for merging two layouts", function(){
                LocusZoom.Layouts.merge.should.be.a.Function;
            });
            it("should throw an exception if either argument is not an object", function(){
                (function(){
                    LocusZoom.Layouts.merge();
                }).should.throw();
                (function(){
                    LocusZoom.Layouts.merge({});
                }).should.throw();
                (function(){
                    LocusZoom.Layouts.merge({}, "");
                }).should.throw();
                (function(){
                    LocusZoom.Layouts.merge(0, {});
                }).should.throw();
                (function(){
                    LocusZoom.Layouts.merge(function(){}, {});
                }).should.throw();
            });
            it("should return the passed default layout if provided an empty layout", function(){
                var returned_layout = LocusZoom.Layouts.merge({}, this.default_layout);
                assert.deepEqual(returned_layout, this.default_layout);
            });
            it("should copy top-level values", function(){
                var custom_layout = { custom_property: "foo" };
                var expected_layout = JSON.parse(JSON.stringify(this.default_layout));
                expected_layout.custom_property = "foo";
                var returned_layout = LocusZoom.Layouts.merge(custom_layout, this.default_layout);
                assert.deepEqual(returned_layout, expected_layout);
            });
            it("should copy deeply-nested values", function(){
                var custom_layout = { nested_object: { property_1: { foxtrot: { sierra: "tango" } } } };
                var expected_layout = JSON.parse(JSON.stringify(this.default_layout));
                expected_layout.nested_object.property_1.foxtrot.sierra = "tango";
                var returned_layout = LocusZoom.Layouts.merge(custom_layout, this.default_layout);
                assert.deepEqual(returned_layout, expected_layout);
            });
            it("should not overwrite array values in the first with any values from the second", function(){
                var custom_layout = {
                    array_of_scalars: [ 4, 6 ],
                    nested_object: {
                        property_1: {
                            charlie: ["whiskey", "xray"]
                        },
                        property_2: true
                    }
                };
                var expected_layout = JSON.parse(JSON.stringify(this.default_layout));
                expected_layout.array_of_scalars = [ 4, 6 ];
                expected_layout.nested_object.property_1.charlie = ["whiskey", "xray"];
                expected_layout.nested_object.property_2 = true;
                var returned_layout = LocusZoom.Layouts.merge(custom_layout, this.default_layout);
                assert.deepEqual(returned_layout, expected_layout);
            });
            it("should allow for the first layout to override any value in the second regardless of type", function(){
                var custom_layout = {
                    array_of_scalars: "number",
                    nested_object: {
                        property_1: {
                            foxtrot: false
                        },
                        property_3: {
                            nested: {
                                something: [ "foo" ]
                            }
                        }
                    }
                };
                var expected_layout = JSON.parse(JSON.stringify(this.default_layout));
                expected_layout.array_of_scalars = "number";
                expected_layout.nested_object.property_1.foxtrot = false;
                expected_layout.nested_object.property_3 = { nested: { something: [ "foo" ] } };
                var returned_layout = LocusZoom.Layouts.merge(custom_layout, this.default_layout);
                assert.deepEqual(returned_layout, expected_layout);
            });
        });    

    });
});
