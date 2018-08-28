<script type="application/javascript">
    /* global urlReader */

    // Given a url, create a reader
    export default {
        data() {
            return {
                url: "http://127.0.0.1:8080/fritsche_2015_amd.epacts.gz",
                validationMessage: ""
            }
        },
        methods: {
            addSource() {
                this.validationMessage = "";

                const indexUrl = `${this.url}.tbi`;
                urlReader(this.url, indexUrl).then((reader) => {
                    this.$emit('connect-tabix', reader);
                }).catch(function (err) {
                    this.validationMessage = err;
                });
            }
        }
    }
</script>

<template>
  <!-- TODO: Expose styles within shadow DOM -->
  <div class="row">
    <div class="twelve columns">
      <div>
        <input type="url" v-model.trim="url">
        <button class="button-primary" @click="addSource">Add</button>
        <p id="validation-message">{{validationMessage}}</p>
      </div>
    </div>
  </div>
</template>

<style>
</style>
