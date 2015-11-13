"use strict";

/**

  LocusZoom.Datum Class

  A datum is an object modeling a single record in a response from a data endpoint.

*/

LocusZoom.Datum = function() { 
    return this;
};


/*****************
  Position Datum
*/

LocusZoom.PositionDatum = function(d){

    LocusZoom.Datum.apply(this, arguments);

    this.id            = d.id;
    this.chr           = +d.chr;
    this.analysis      = +d.analysis;
    this.position      = +d.position;
    this.pvalue        = +d.pvalue;
    this.refAllele     = d.refAllele;
    this.refAlleleFreq = +d.refAlleleFreq;
    this.scoreTestStat = d.scoreTestStat;
    this.log10pval     = -Math.log(this.pvalue) / Math.LN10;

    return this;
};

LocusZoom.PositionDatum.prototype = new LocusZoom.Datum();
