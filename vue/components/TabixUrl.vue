<script type="application/javascript">
   /* global urlReader */
    /**
    * Given a URL, connect and create a reader instance. Also returns config options that can be used with the reader
    *  instance.
    */
    import TabixOptions from './TabixOptions';

    export default {
        components: {
            TabixOptions
        },
        data() {
            return {
                url: "http://127.0.0.1:8080/fritsche_2015_amd.epacts.gz",
                validationMessage: "",
                parseOptions: {  // TODO: 2-way binding usage is redundant and a bit ugly
                    marker_col: 4,
                    pvalue_col: 5,
                    is_log_p: false,
                    delimiter: '\t'
                },
            }
        },
        methods: {
            addSource() {
                let self = this;
                self.validationMessage = "";

                const indexUrl = `${this.url}.tbi`;
                urlReader(this.url, indexUrl).then((reader) => {
                    self.$emit('connect-tabix', reader, Object.assign({}, this.parseOptions));
                }).catch((err) => {
                    self.validationMessage = err;
                });
            },
        }
    }
</script>

<template>
  <!--
    TODO: Validate request before sending (and validate for dev mode)
  -->
  <div class="row">
    <div class="twelve columns">
      <div>
        <input type="url" v-model.trim="url" size="100">
        <button class="button-primary" @click="addSource">Add</button>
        <p id="validation-message">{{validationMessage}}</p>
        <tabix-options :params.sync="parseOptions"></tabix-options>
      </div>
    </div>
  </div>
</template>

<style>
  /* TODO: Expose styles within shadow DOM */
</style>
