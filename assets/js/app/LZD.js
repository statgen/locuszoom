var LZD = function(){
  
  this.getData = function(state, fields){
    
    var chr   = 10;
    var start = state.start;
    var stop  = state.stop;

    return new Promise(function(resolve, reject){

      var csv = mockCSV(state, fields);

      var resp = {
        header: '1',
        body: d3.csv.parse(csv, function(d) {
          return new Datum(d);
        })
      };
      
      resolve(resp);

    });
    
  };

}

// mockCSV(): Simple method for mocking quasi-realistic data for more rapid development
// Written with extremely poor working knowledge of the actual shape and behavior of such data. =P
var mockCSV = function(state, fields){

  var csv = fields.join(',');
  var random_nuc = function(exclude){
    var nucs = 'GATC';
    if (typeof exclude != 'undefined'){
      nucs = nucs.replace(exclude, '');
    }
    return nucs[Math.floor(Math.random()*nucs.length)];
  }

  var range = state.stop - state.start;
  var points = Math.max(Math.round(Math.random()*Math.min(range, 4000)), 1);
  var step = range / (points * 1.1);

  for (var p = 1; p <= points; p++){

    var data = {};

    // Analysis (TODO: mock something more realistic)
    data.analysis = 1;
    // Chromosome
    data.chr = 10;
    // Position
    data.position = state.start + Math.ceil(p * step);
    // P-Value
    data.pvalue = Math.max(Math.pow(Math.random(), 1.2), 0.0001).toFixed(4);
    // Reference / Variant Allele
    data.ref_allele = random_nuc();
    data.var_allele = random_nuc(data.ref_allele);
    if (Math.random() < 0.04){
      var ref_length = Math.ceil(Math.random() * 14);
      for (var n = 0; n < ref_length; n++){ data.ref_allele += random_nuc(); }
    }
    if (Math.random() < 0.04 && data.ref_allele.length == 1){
      var var_length = Math.ceil(Math.random() * 14);
      for (var n = 0; n < var_length; n++){ data.var_allele += random_nuc(); }
    }
    // Reference Allele Frequency
    data.ref_allele_freq = Math.pow(Math.random(), 0.1).toFixed(4);
    // Score Test Stat (TODO: ???)
    data.score_test_stat = '';
    // ID
    data.id = data.chr + ":" + data.position + "_" + data.ref_allele  + '/' + data.var_allele
    if (Math.random() < 0.1 && data.ref_allele.length == 1 && data.var_allele.length == 1){
      data.id += '_';
      if (Math.random() > 0.5){
        data.id += 'SNP' + data.chr + '-' + (data.position + Math.ceil(Math.random() * 100));
      } else {
        data.id += 'rs' + Math.round(Math.random() * Math.pow(10, 8));
      }
    }

    // Append the completed line
    var line = '';
    for (var idx in fields){
      var field = fields[idx];
      line += (line.length > 0 ? ',' : '') + data[field];
    }
    csv += "\n" + line;

  }

  return csv;

}
