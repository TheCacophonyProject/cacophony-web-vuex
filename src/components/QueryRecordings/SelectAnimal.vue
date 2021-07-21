<template>
  <b-form-group v-b-tooltip.hover="tooltipTitle">
    <label>Animals</label>
    <multiselect
      :value="value"
      :options="options"
      :multiple="true"
      :placeholder="placeholder"
      :disabled="disabled"
      label="text"
      track-by="value"
      @input="$emit('input', $event)"
      data-cy="animal-select"
    />
  </b-form-group>
</template>
<script>
import DefaultLabels from "../../const.ts";

export default {
  name: "AnimalSelect",
  props: {
    value: {
      type: Array,
      required: true,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    canHaveSubTags: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      options: DefaultLabels.searchLabels(),
    };
  },
  computed: {
    placeholder: function () {
      if (this.value.length > 0) {
        return "add more animals";
      } else if (this.canHaveSubTags) {
        return "anything";
      } else {
        return "";
      }
    },
    tooltipTitle: function () {
      if (this.disabled) {
        return "Disabled when recording type includes audio";
      } else {
        return "";
      }
    },
  },
};
</script>

<style src="vue-multiselect/dist/vue-multiselect.min.css"></style>
