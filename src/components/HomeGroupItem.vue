<template>
  <b-list-group-item
    :to="{ path: 'recordings', query: recordingsPageQuery }"
    class="d-flex justify-content-between align-items-center"
  >
    {{ group.groupname }}
    <b-badge v-if="count > 0" pill variant="primary" class="ml-auto">
      {{ count }}
    </b-badge>
  </b-list-group-item>
</template>

<script>
import { mapState } from "vuex";
import recordingsApi from "../api/Recording.api";

export default {
  name: "HomeGroupItem",
  props: {
    group: {
      type: Object,
      required: true,
    },
  },
  data: function () {
    return {
      count: 0,
    };
  },
  computed: {
    ...mapState({
      groups: (state) => state.Groups.groups,
    }),
    recordingsPageQuery() {
      return {
        group: this.group.id,
        days: 30,
      };
    },
  },
  async mounted() {
    const params = {
      days: 1,
      group: [this.group.id],
    };
    try {
      const { result: allData } = await recordingsApi.queryCount(params);
      this.count = allData.count;
      // eslint-disable-next-line no-empty
    } catch (e) {}
  },
};
</script>

<style scoped></style>
