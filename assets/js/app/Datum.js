"use strict"

/**

  Datum Class

  An object representing a single data point displayed in LocusZoom.

*/

var Datum = function(d) { 
  this.id            = d.id;
  this.chr           = +d.chr;
  this.analysis      = +d.analysis;
  this.position      = +d.position;
  this.pvalue        = +d.pvalue;
  this.refAllele     = d.refAllele;
  this.refAlleleFreq = +d.refAlleleFreq;
  this.scoreTestStat = d.scoreTestStat;
  this.log10pval = -Math.log(this.pvalue) / Math.LN10;
}
