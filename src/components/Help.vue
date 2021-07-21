<template>
  <span v-b-tooltip.hover="helpTip" class="help">
    <font-awesome-icon icon="question-circle" size="xs" />
  </span>
</template>

<script>
export default {
  name: "Help",
  data() {
    return {
      helpTip: {
        html: true,
        title: this.$slots.default[0].text,
      },
    };
  },
};
</script>
<style lang="scss">
.help {
  vertical-align: top;
}
</style>
