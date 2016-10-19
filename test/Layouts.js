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
    it("creates an object for its name space", function() {
        should.exist(LocusZoom.Layouts);
    });

    describe("Should implement a merge function", function() {
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
