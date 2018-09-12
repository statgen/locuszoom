<script>
    export default {
        name: "TabixOptions",
        props: ['params'],
        data() {
            return {
                delimiters: [
                    ['\t', 'Tab'],
                    [' ', 'Space'],
                    [',', 'Comma']
                ]
            }
        }
    }


    // marker_col: 4, pvalue_col: 5, is_log_p: false, delimiter: '\t'
</script>

<template>
  <div class="row">
    <label>Marker column: <input v-model="params.marker_col" type="number" min="0" step="1" placeholder="0" class="number-field"></label><br>
    <label>P-value column: <input v-model="params.pvalue_col" type="number" min="0" step="1" placeholder="1" class="number-field"></label> <label>
    <input v-model="params.is_log_p" type="checkbox">Uses -log(p)</label><br>
    <label>Delimiter: <select v-model="params.delimiter">
      <option v-for="delimiter in delimiters" :key="delimiter[0]" :value="delimiter[0]">{{delimiter[1]}}</option>
    </select></label>
  </div>
</template>


<style scoped>
  .number-field {
    width: 4em;
  }
</style>
