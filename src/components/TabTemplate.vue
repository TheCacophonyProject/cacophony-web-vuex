<template>
  <div>
    <span>{{ title }}</span>
    <b-spinner v-if="isLoading" type="border" small />
    <b-badge
      v-else-if="value"
      pill
      :variant="hasWarnings ? 'danger' : 'secondary'"
    >
      {{ value }}
    </b-badge>
  </div>
</template>

<script>
export default {
  name: "TabTemplate",
  props: {
    title: {
      type: String,
      required: true,
    },
    isLoading: {
      type: Boolean,
      default: false,
    },
    value: {
      type: [Number, String],
      default: 0,
    },
    hasWarnings: {
      type: Boolean,
      default: false,
    },
  },
};
</script>

<style></style>
