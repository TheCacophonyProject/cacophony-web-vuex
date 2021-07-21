<template>
  <div class="container">
    <h2>
      All recordings
      <help>
        All recordings ever made for this
        {{ `${deviceName ? "device" : stationName ? "station" : "group"}` }}
      </help>
    </h2>
    <RecordingsList
      :query-pending="loading"
      :recordings="recordings"
      :all-loaded="allLoaded"
      :view-recording-query="recordingsQuery"
      @load-more="requestRecordings"
    />
    <div v-if="!loading && recordings && recordings.length === 0">
      No recordings found for this
      {{ `${deviceName ? "device" : stationName ? "station" : "group"}` }}
    </div>
  </div>
</template>

<script lang="ts">
import Help from "@/components/Help.vue";
import RecordingsList from "@/components/RecordingsList.vue";
import api from "@/api";
const LOAD_PER_PAGE_CARDS = 10;
export default {
  name: "RecordingsTab",
  components: {
    RecordingsList,
    Help,
  },
  props: {
    groupName: { type: String, required: true },
    deviceName: { type: String, required: false, default: null },
    stationName: { type: String, required: false, default: null },
    recordingsQuery: { type: Object, required: true },
  },
  data() {
    return {
      recordings: [],
      totalRecordingCount: 0,
      loading: true,
      allLoaded: false,
      currentPage: 1,
    };
  },
  async mounted() {
    await this.fetchRecordings();
  },
  methods: {
    async requestRecordings() {
      // Keep track of the offset of the page.
      const nextQuery = { ...this.recordingsQuery };
      nextQuery.limit = LOAD_PER_PAGE_CARDS;
      nextQuery.offset = Math.max(0, this.currentPage * LOAD_PER_PAGE_CARDS);
      // Make sure the request wouldn't go past the count?
      const totalPages =
        Math.ceil(this.totalRecordingCount / LOAD_PER_PAGE_CARDS) + 1;
      if (this.currentPage < totalPages) {
        this.currentPage += 1;
        this.loading = true;
        try {
          const { result } = await api.recording.query(nextQuery);

          // TODO: It's possible that more recordings have come in since we loaded the page,
          //  in which case our offsets are wrong. So check for duplicate recordings here.
          this.recordings.push(...result.rows);
          // eslint-disable-next-line no-empty
        } catch (e) {}
        this.loading = false;
      } else {
        // At end of search
        this.allLoaded = true;
      }
    },
    async fetchRecordings() {
      if (
        (this.recordingsQuery.group &&
          this.recordingsQuery.group.length &&
          this.recordingsQuery.group[0] !== null) ||
        (this.recordingsQuery.device &&
          this.recordingsQuery.device.length &&
          this.recordingsQuery.device[0] !== null) ||
        (this.recordingsQuery.station &&
          this.recordingsQuery.station.length &&
          this.recordingsQuery.station[0] !== null)
      ) {
        this.loading = true;
        try {
          const { result } = await api.recording.query(this.recordingsQuery);
          this.totalRecordingCount = result.count;
          this.recordings = result.rows;
        } catch (e) {
          //
        }
        this.loading = false;
      }
    },
  },
  watch: {
    recordingsQuery() {
      // TODO(jon): Make sure we allow inactive devices to show recordings.
      this.fetchRecordings();
    },
  },
};
</script>

<style lang="scss">
.device-health {
  color: darkgray;
  &.healthy {
    color: #dc3545;
  }
}
.table-okay {
  border-left: 10px solid #cff1d7;
}
.table-warn {
  border-left: 10px solid #eecccf;
}
</style>
