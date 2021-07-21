<template>
  <div :class="['query-recordings', { 'is-collapsed': isCollapsed }]">
    <b-button
      :class="['search-panel-toggle-btn', { 'is-collapsed': isCollapsed }]"
      variant="primary"
      @click="() => toggleSearchPanel()"
    >
      <span v-if="isCollapsed">
        <font-awesome-icon :icon="['fas', 'search']" />
        <span class="sr-only">Expand search panel</span>
      </span>
      <span v-else>
        <font-awesome-icon :icon="['fas', 'times']" />
        <span class="sr-only">Collapse search panel</span>
      </span>
    </b-button>
    <b-form-group>
      <h2>Search recordings</h2>
      <SelectDevice
        :selected-devices="selectedDevices"
        :selected-groups="selectedGroups"
        :selected-stations="selectedStations"
        @update-device-selection="updateDeviceSelection"
      />
      <div v-if="!onlyRecordingType">
        <SelectRecordingType v-model="recordingType" />
      </div>
      <SelectDateRange v-model="dates" />
      <b-form-row v-if="!simpleOnly">
        <b-col>
          <b-button
            variant="link"
            class="toggle-advanced-search-btn"
            @click="() => toggleAdvancedSearch()"
            data-cy="advanced-options"
          >
            Advanced search
            <font-awesome-icon v-if="!advanced" :icon="['fas', 'caret-down']" />
            <font-awesome-icon v-else :icon="['fas', 'caret-up']" />
          </b-button>
        </b-col>
      </b-form-row>
      <SelectDuration v-if="advanced" v-model="duration" />
      <SelectTags v-if="advanced" v-model="tagData" :isDisabled="isAudio" />
      <b-button :disabled="disabled" block variant="primary" @click="submit">
        <span v-if="!disabled">Search</span>
        <span v-else>Searching...</span>
      </b-button>
    </b-form-group>
  </div>
</template>

<script>
import SelectDevice from "./SelectDevice.vue";
import SelectTags from "./SelectTags.vue";
import SelectDuration from "./SelectDuration.vue";
import SelectRecordingType from "./SelectRecordingType.vue";
import SelectDateRange from "./SelectDateRange.vue";

export default {
  name: "QueryRecordings",
  components: {
    SelectDateRange,
    SelectDevice,
    SelectTags,
    SelectDuration,
    SelectRecordingType,
  },
  props: {
    disabled: {
      type: Boolean,
      required: true,
    },
    isCollapsed: {
      type: Boolean,
      required: true,
    },
    onlyRecordingType: {
      type: String,
      required: false,
    },
    simpleOnly: {
      type: Boolean,
      required: true,
    },
  },
  data() {
    return {
      lastQuery: null,
      query: {},
      rawAnimals: [],
      advanced: false,
      selectedDevices: [],
      selectedGroups: [],
      selectedStations: [],
      dates: {},
      dateDescription: "",
      duration: {},
      recordingType: "",
      tagData: {},
    };
  },
  computed: {
    isAudio: function () {
      return this.recordingType === "audio";
    },
    groups: function () {
      return this.$store.state.Groups;
    },
  },
  created() {
    this.resetToDefaultQuery();

    if (Object.keys(this.$route.query).length !== 0) {
      this.deserialiseQuery(this.$route.query);
    }
  },
  mounted() {
    this.onMountOrSubmit("mounted");
  },
  methods: {
    resetToDefaultQuery() {
      this.selectedDevices = [];
      this.selectedGroups = [];
      this.selectedStations = [];
      this.dates = {
        days: 7,
      };
      this.duration = {};
      this.recordingType = this.$store.state.User.recordingTypePref || "both";
      this.tagData = {
        tagMode: "any",
      };
    },
    setAdvancedInitialState() {
      if (this.simpleOnly) {
        this.advanced = false;
      } else {
        // If there was an advanced query, start with the advanced toggle area open.
        this.advanced =
          (this.tagData && this.tagData.tagMode !== "any") ||
          this.duration.hasOwnProperty("maxS") ||
          this.duration.hasOwnProperty("minS");
      }
    },
    deserialiseQuery(routeQuery) {
      setOnlyIfExists("tagMode", routeQuery, this.tagData);

      setOnlyIfExists("minS", routeQuery, this.duration);
      setOnlyIfExists("maxS", routeQuery, this.duration);

      if (routeQuery.hasOwnProperty("tag")) {
        this.tagData.tags = makeArray(routeQuery.tag);
      }

      if (routeQuery.hasOwnProperty("type")) {
        this.recordingType = routeQuery.type;
      }

      this.dates = {
        days: Number(routeQuery.days),
        to: routeQuery.to,
        from: routeQuery.from,
      };

      if (routeQuery.hasOwnProperty("group")) {
        this.selectedGroups = makeArray(routeQuery.group).map((item) =>
          Number(item)
        );
      }
      if (routeQuery.hasOwnProperty("device")) {
        this.selectedDevices = makeArray(routeQuery.device).map((item) =>
          Number(item)
        );
      }
      if (routeQuery.hasOwnProperty("stations")) {
        this.selectedStations = makeArray(routeQuery.stations).map((item) =>
          Number(item)
        );
      }

      this.setAdvancedInitialState();
    },
    serialiseQuery() {
      if (this.isAudio) {
        this.tagData = {
          tags: [],
          tagMode: "any",
        };
      }

      const query = {
        tagMode: this.tagData.tagMode,
        tag: this.tagData.tags,
        minS: this.duration.minS,
        maxS: this.duration.maxS,
        days: this.dates.days,
        from: this.dates.from,
        to: this.dates.to,
        type: this.recordingType,
        device: this.selectedDevices,
        group: this.selectedGroups,
        station: this.selectedStations,
      };

      for (const [key, value] of Object.entries(query)) {
        if (typeof value === "string" && Number(value).toString() === value) {
          query[key] = Number(value);
        }
      }
      return query;
    },

    submit: function () {
      if (!this.onlyRecordingType) {
        this.$store.commit("User/updateRecordingTypePref", this.recordingType);
      }

      // Every time we submit a new query, we need to clear the offset param, as if we are on page 2+ of the results,
      // we can end up with an offset that is greater than the number of results in the new query.
      this.onMountOrSubmit();
    },

    onMountOrSubmit: function (event = "submit") {
      this.lastQuery = this.serialiseQuery();
      this.$emit("description", this.makeSearchDescription());
      this.toggleSearchPanel();
      this.$emit(event, { ...this.lastQuery, offset: 0 });
    },
    toggleAdvancedSearch: function () {
      this.advanced = !this.advanced;
    },
    toggleSearchPanel: function () {
      this.$emit("toggled-search-panel");
    },
    devicesDescription() {
      const numDevices = this.selectedDevices.length;
      const numGroups = this.selectedGroups.length;
      const numStations = this.selectedStations.length;
      const total = numDevices + numGroups + numStations;

      const multipleSuffix = total > 1 ? "s" : "";

      if (total === 0) {
        return "All devices";
      } else if (numGroups && !numDevices && !numStations) {
        return `${total} group${multipleSuffix}`;
      } else if (numStations && !numDevices && !numGroups) {
        return `${total} station${multipleSuffix}`;
      } else if (numDevices && !numStations && !numGroups) {
        return `${total} device${multipleSuffix}`;
      } else {
        const items = [];
        if (numGroups) {
          items.push("groups");
        }
        if (numDevices) {
          items.push("devices");
        }
        if (numStations) {
          items.push("stations");
        }
        return `${total} ${items.join(" and ")}`;
      }
    },
    makeSearchDescription() {
      // Get the current search query, not the live updated one.
      const devices = this.devicesDescription();
      const tagsText = this.tagData.description || "";
      const timespan = this.dates.description || "";
      const durationStr = this.duration.description || "";

      const recordings =
        this.recordingType === "both" ? "audio and video" : this.recordingType;

      return (
        `<strong>${devices}</strong>, <strong>${recordings} recordings</strong> and <strong>${tagsText}</strong> ` +
        `${timespan}${durationStr}`
      );
    },

    updateDeviceSelection(eventData) {
      if (eventData.hasOwnProperty("devices")) {
        this.selectedDevices = eventData.devices;
      }
      if (eventData.hasOwnProperty("groups")) {
        this.selectedGroups = eventData.groups;
      }
      if (eventData.hasOwnProperty("stations")) {
        this.selectedStations = eventData.stations;
      }
    },
  },
};

function setOnlyIfExists(itemName, source, destination) {
  if (source.hasOwnProperty(itemName)) {
    destination[itemName] = source[itemName];
  }
}

function makeArray(value) {
  if (Array.isArray(value)) {
    return value;
  } else {
    return value ? [value] : [];
  }
}
</script>

<style scoped lang="scss">
@import "~bootstrap/scss/functions";
@import "~bootstrap/scss/variables";
@import "~bootstrap/scss/mixins";

$main-content-width: 640px;

.query-recordings {
  padding: 15px;
  overflow: auto;
  height: 100vh;
  @include media-breakpoint-up(lg) {
    max-height: calc(100vh - var(--navbar-height));
  }
  h2 {
    font-size: 1.2rem;
    color: $gray-700;
    margin: 1rem 0 0.8rem;
  }
}

.search-filter-wrapper {
  background: $gray-100;
  position: relative;
  border-right: 1px solid $gray-200;
}

@include media-breakpoint-down(md) {
  .search-filter-wrapper {
    position: fixed;
    top: 0;
    left: 0;
    transform: translate(0);
    width: var(--search-panel-width);
    z-index: 2;
    transition: transform 0.2s;
    &.is-collapsed {
      transform: translate(var(--search-panel-offset));
    }
  }
}

@include media-breakpoint-up(md) {
  .search-filter-wrapper {
    flex: 0 0 320px;
  }
  .search-content-wrapper {
    flex: 1 1 $main-content-width;
    position: relative;
    overflow: hidden;
    overflow-y: scroll;
    margin: 0;
    max-height: calc(100vh - var(--navbar-height));
  }
}
.search-panel-toggle-btn {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  transition: transform 0.2s;
  @include media-breakpoint-down(lg) {
    position: fixed;
    top: 55px;
    left: 0;
    transform: translate(var(--search-panel-width));
    &.is-collapsed {
      transform: translate(var(--search-panel-width));
    }
  }
  @include media-breakpoint-up(lg) {
    display: none;
  }
}

.toggle-advanced-search-btn {
  margin-left: -0.75rem;
  margin-bottom: 1rem;
}
</style>
