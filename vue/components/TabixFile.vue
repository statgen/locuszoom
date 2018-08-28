<script type="application/javascript">
    /* global blobReader */
    /**
     * Create a reader instance by picking files from a local machine
     */
    import TabixOptions from './TabixOptions';

    export default {
        components: {
            TabixOptions
        },
        data() {
            return {
                validationMessage: "",
                parseOptions: {  // TODO: 2-way binding usage is redundant and a bit ugly
                    marker_col: 4,
                    pvalue_col: 5,
                    is_log_p: false,
                    delimiter: '\t'
                }
            }
        },
        methods: {
            addSource(event) {
                let self = this;
                self.validationMessage = "";
                const files = event.target.files;

                let tabix_file;
                let gwas_file;
                for (let i = 0; i < files.length; i++) {
                    let f = files.item(i);
                    if (f.name.endsWith('.tbi')) {
                        tabix_file = f;
                    } else {
                        gwas_file = f;
                    }
                }
                if (files.length !== 2 || !tabix_file) {
                    self.validationMessage = "Must select two files: gzipped data and accompanying tabix index";
                    return;
                }
                blobReader(gwas_file, tabix_file).then((reader) => {
                    self.$emit('connect-tabix', reader, Object.assign({}, self.parseOptions));
                }).catch((err) => {
                    self.validationMessage = err;
                });
            }
        }
    }
</script>

<template>
  <div class="row">
    <div class="twelve columns">
      <div>
        <label>Select a file...
          <input id="file-picker" type="file" multiple accept="application/gzip,.tbi" @change="addSource($event)">
        </label>
        <p id="validation-message">{{validationMessage}}</p>
        <tabix-options :params.sync="parseOptions"></tabix-options>
      </div>
    </div>
  </div>
</template>

<style>
</style>
