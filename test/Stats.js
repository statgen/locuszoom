"use strict";

/**
  Stats.js Tests
  Test statistical distribution functions
*/

var jsdom = require('mocha-jsdom');
var fs = require("fs");
var should = require("should");

describe('Stats', function(){

    jsdom({
        src: [ fs.readFileSync('./assets/js/vendor/should.min.js'),
               fs.readFileSync('./assets/js/vendor/d3.min.js'),
               fs.readFileSync('./assets/js/vendor/q.min.js'),
               fs.readFileSync('./assets/js/app/LocusZoom.js'),
               fs.readFileSync('./assets/js/app/Rstats.js'),
             ]
    });
    var stats;
    beforeEach(function() {
        stats = LocusZoom.Stats;
    });

    describe("pnorm", function() {
        it("should have pnorm function", function(){
           stats.should.have.property("pnorm");
           stats.pnorm.should.be.a.Function;
        });
        it("should check boundaries", function() {
            var inf = Number.POSITIVE_INFINITY;
            stats.pnorm(null).should.be.NaN;
            stats.pnorm(NaN).should.be.NaN;
            stats.pnorm(inf).should.be.NaN;
            stats.pnorm(inf,inf).should.be.NaN;
            //negative sigma
            stats.pnorm(0,0, -5).should.be.NaN;
            //zero sigma
            stats.pnorm(-1,0,0).should.equal(0);
            stats.pnorm(1,0,0).should.equal(1);

        }),
        it("should default to mean=0, sd=1, lower, non-log", function() {
            stats.pnorm(.2).should.equal(stats.pnorm(.2, 0, 1, true, false));
        });
        describe("should get same values as R", function() {
            var eps = 1e-8;
            var tests = [
                //upper, non-log
                [[0,0,1, true, false], 0.5],
                [[0.5,0,1, true, false], 0.691462461274013],
                [[1,0,1, true, false], 0.841344746068543],
                [[8,0,1, true, false], 0.999999999999999],
                [[9,0,1, true, false], 1],
                [[-38,0,1, true, false], 0],
                //upper, log 
                [[0,0,1, true, true],  -0.693147180559945],
                [[0.5,0,1, true, true], -0.368946415288657],
                [[1,0,1, true, true], -0.17275377902345],
                [[8,0,1, true, true], -6.22096057427179e-16],
                [[9,0,1, true, true], -1.12858840595384e-19],
                [[-38,0,1, true, true], -726.55721601882],
                //lower, non-log
                [[0,0,1,false], 0.5],
                [[0.5,0,1,false], 0.308537538725987],
                [[1,0,1,false], 0.158655253931457],
                [[8,0,1,false], 6.22096057427178e-16],
                [[9,0,1,false], 1.12858840595384e-19],
                [[-38,0,1,false], 1],
                //lower, log
                [[0,0,1,false,true], -0.693147180559945],
                [[0.5,0,1,false,true], -1.17591176159362],
                [[1,0,1,false,true], -1.84102164500926],
                [[8,0,1,false, true], -35.0134371599146],
                [[9,0,1,false, true], -43.6281491133321],
                [[-38,0,1,false, true], -2.88542835100396e-316]
            ];
            tests.forEach(function(test) {
                it("pnorm(" + test[0] + ")", function() {
                    stats.pnorm.apply(this, test[0]).should.be.approximately(test[1], eps);
                })
            });
        });
    });
    describe("pchisq", function() {
        it("should have a pchisq function", function() {
            stats.should.have.property("pchisq");
            stats.pchisq.should.be.a.Function;
        });
        it("should check boundaries", function() {
            stats.pchisq(null).should.be.NaN;
            stats.pchisq(NaN).should.be.NaN;
            stats.pchisq(1,0, true, true).should.equal(0);
            stats.pchisq(1,0, false, true).should.equal(Number.NEGATIVE_INFINITY);
            stats.pchisq(1,0, true, false).should.equal(1);
            stats.pchisq(1,0, false, false).should.equal(0);
        });
        it("should match values of pgamma", function() {
            var eps = 1e-8;
            //pchisq is basically a wrapper for pgamma so there are not many tests here
            stats.pchisq(5,3).should.be.approximately(0.828202855703267, eps)
            stats.pchisq(5,3,true,false).should.be.approximately(0.828202855703267, eps)
            stats.pchisq(5,3,true,true).should.be.approximately(-0.188497159792496, eps)
            stats.pchisq(5,3,false,false).should.be.approximately(0.171797144296733, eps)
            stats.pchisq(5,3,false,true).should.be.approximately(-1.76144089182431, eps)

        });
    });
    describe("pgamma", function() {
        it("should have a pgamma function", function() {
            stats.should.have.property("pgamma");
            stats.pgamma.should.be.a.Function;
        });
        it("should check boundaries", function() {
            stats.pgamma(NaN).should.be.NaN;
            stats.pgamma(1, -1).should.be.NaN;
            stats.pgamma(1, 1, -1).should.be.NaN;
            stats.pgamma(1, 0).should.equal(1);
            stats.pgamma(-1, 0).should.equal(0);

        });
        it("should default to lower, non-log", function() {
            stats.pgamma(.1,1,1).should.equal(stats.pgamma(.1,1,1,true,false));
        });
        describe("should match values from R", function() {
            var eps = 1e-8;
            var tests = [
                //lower, non-log
                [[.1, 1, 1,  true, false], 0.0951625819640404],
                [[1.5, 3, 1, true, false], 0.191153169461942],
                [[1.5, 2, 1, true, false], 0.442174599628925],
                [[1,.9,1, true, false], 0.675392441674053],
                [[250,250,1, true, false], 0.508410626968991],
                //lower, log
                [[.1,1,1, true, true], -2.35216846104409],
                [[1.5,3,1, true, true], -1.65468023795734],
                [[1.5,2,1, true, true], -0.816050453120104],
                [[1,.9,1, true, true], -0.392461361981572],
                [[250,250,1, true, true], -0.676465837113876],
                //upper, non-log
                [[.1,1,1, false, false], 0.90483741803596],
                [[1.5,3,1, false, false], 0.808846830538058],
                [[1.5,2,1, false, false], 0.557825400371075],
                [[1,.9,1, false, false], 0.324607558325947],
                [[250,250,1, false, false], 0.491589373031009],
                //upper, log
                [[.1,1,1, false, true], -0.1],
                [[1.5,3,1, false, true], -0.212145711693362],
                [[1.5,2,1, false, true], -0.583709268125845],
                [[1,.9,1, false, true], -1.12513833912669],
                [[250,250,1, false, true], -0.710111518629262]
            ];
            tests.forEach(function(test) {
                it("pgamma(" + test[0] + ")", function() {
                    stats.pgamma.apply(this, test[0]).should.be.approximately(test[1], eps);
                })
            });
        });

    });
    describe("dpois", function() {
        it("should have a dpois function", function() {
            stats.should.have.property("dpois");
            stats.dpois.should.be.a.Function;
        });
        it("should check boundary values", function() {
            stats.dpois(1,-1).should.be.NaN;
            stats.dpois(.2,1).should.be.NaN;
            stats.dpois(-1,1).should.equal(0);
            stats.dpois(-1,1,true).should.equal(Number.NEGATIVE_INFINITY);

        });
        it("should match values from R", function() {
            var eps = 1e-8;
            stats.dpois(1,1).should.be.approximately(0.367879441171442, eps);
            stats.dpois(30,1).should.be.approximately(1.38690094211206e-33, eps);
        });
    });
    describe("dnorm", function() {
        it("should have a dnorm function", function() {
            stats.should.have.property("dnorm").which.is.a.Function;
        });
        it("should check boundary values", function() {
            var inf = Number.POSITIVE_INFINITY;
            stats.dnorm(NaN).should.be.NaN;
            stats.dnorm(1,NaN).should.be.NaN;
            stats.dnorm(1,0,NaN).should.be.NaN;
            stats.dnorm(0,0,inf).should.equal(0);
            stats.dnorm(inf, inf).should.be.NaN;
            stats.dnorm(0,0, -1).should.be.NaN;
            stats.dnorm(0,0, 0).should.be.NaN;
            stats.dnorm(1,0, 0).should.be.Infinity;
            stats.dnorm(inf, 0).should.equal(0);
            stats.dnorm(2.7e154).should.equal(0);
        });
        describe("should match values from R", function() {
            var eps = 1e-8;
            var tests = [
                [[.25, 0, 1, false], 0.386668116802849],
                [[.25, 0, 1, true], -0.950188533204673]

            ];
            tests.forEach(function(test) {
                it("dnorm(" + test[0] + ")", function() {
                    stats.dnorm.apply(this, test[0]).should.be.approximately(test[1], eps);
                })
            });

        });
    });
});
