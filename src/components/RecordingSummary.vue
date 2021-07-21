<template>
  <a
    v-if="displayStyle === 'card'"
    :href="getRecordingPath(item.id)"
    class="recording-summary"
    @click="(event) => navigateToRecording(event, item.id)"
  >
    <div class="recording-type">
      <span v-if="item.type === 'audio'">
        <font-awesome-icon :icon="['far', 'file-audio']" size="2x" />
      </span>
      <span v-else-if="item.type === 'thermalRaw'">
        <font-awesome-icon :icon="['far', 'file-video']" size="2x" />
      </span>
    </div>
    <div class="recording-main">
      <div class="recording-details">
        <span class="recording-group">
          <font-awesome-icon icon="users" size="xs" />
          <span class="label">
            <b-link
              :to="{
                name: 'group',
                params: {
                  groupName: item.groupName,
                  tabName: 'recordings',
                },
              }"
            >
              {{ item.groupName }}
            </b-link>
          </span>
        </span>
        <span class="recording-station" v-if="item.stationName">
          <font-awesome-icon icon="map-marker-alt" size="xs" />
          <span class="label">
            <b-link
              :to="{
                name: 'station',
                params: {
                  groupName: item.groupName,
                  stationName: item.stationName,
                  tabName: 'recordings',
                },
              }"
            >
              {{ item.stationName }}
            </b-link>
          </span>
        </span>
        <span class="recording-device">
          <font-awesome-icon icon="microchip" size="xs" />
          <span class="label">
            <b-link
              :to="{
                name: 'device',
                params: {
                  groupName: item.groupName,
                  deviceName: item.deviceName,
                  tabName: 'recordings',
                },
              }"
            >
              {{ item.deviceName }}
            </b-link>
          </span>
        </span>
        <span class="recording-tracks">
          <b-spinner small v-if="queuedForProcessing" />
          <font-awesome-icon icon="stream" size="xs" v-else />
          <span class="label" v-if="queuedForProcessing">Queued</span>
          <span
            class="label"
            v-else-if="item.type === 'thermalRaw' && item.trackCount !== 0"
          >
            {{ item.trackCount }} track<span v-if="item.trackCount > 1">s</span>
          </span>
          <span class="label" v-else-if="item.type === 'thermalRaw'"
            >No tracks</span
          >
        </span>
      </div>
      <div v-if="item.tags.length !== 0" class="recording-tags">
        <TagBadge v-for="(tag, index) in item.tags" :key="index" :tag="tag" />
      </div>
      <div class="recording-time-duration">
        <div class="recording-time">
          <font-awesome-icon :icon="['far', 'calendar']" size="xs" />
          <span class="label">{{ item.date }} {{ item.time }}</span>
        </div>
        <div class="recording-duration">
          <font-awesome-icon :icon="['far', 'clock']" size="xs" />
          <span class="label">{{ Math.round(item.duration) }} seconds</span>
        </div>
        <div v-if="hasBattery" class="recording-battery">
          <BatteryLevel :battery-level="item.batteryLevel" />
        </div>
      </div>
    </div>
    <div v-if="item.location !== '(unknown)'" class="recording-location">
      <b-modal
        v-model="showingLocation"
        hide-footer
        :title="`${item.deviceName}: #${item.id}`"
        lazy
      >
        <MapWithPoints :points="itemLocation" />
      </b-modal>
      <a
        @click.stop.prevent="showLocation"
        title="View location"
        class="location-link"
      >
        <font-awesome-icon
          icon="map-marker-alt"
          size="3x"
          style="color: #bbb"
        />
      </a>
    </div>
  </a>
  <div v-else-if="item && item.id" class="recording-summary-row">
    <a :href="getRecordingPath(item.id)" target="_blank">
      {{ item.id }}
    </a>
    <span v-if="item.type === 'audio'">
      <font-awesome-icon :icon="['far', 'file-audio']" size="2x" />
    </span>
    <span v-else-if="item.type === 'thermalRaw'">
      <font-awesome-icon :icon="['far', 'file-video']" size="2x" />
    </span>

    <span>
      <b-link
        :to="{
          name: 'device',
          params: {
            groupName: item.groupName,
            deviceName: item.deviceName,
            tabName: 'recordings',
          },
        }"
      >
        {{ item.deviceName }}
      </b-link>
    </span>
    <span>{{ item.date }}</span>
    <span class="recording-time">{{ item.time }}</span>
    <span>{{ Math.round(item.duration) }}s</span>
    <span>
      <TagBadge v-for="(tag, index) in item.tags" :key="index" :tag="tag" />
    </span>
    <span>
      <b-link
        :to="{
          name: 'group',
          params: {
            groupName: item.groupName,
            tabName: 'recordings',
          },
        }"
      >
        {{ item.groupName }}
      </b-link>
    </span>
    <span>
      <b-link
        v-if="item.stationName"
        :to="{
          name: 'station',
          params: {
            groupName: item.groupName,
            stationName: item.stationName,
            tabName: 'recordings',
          },
        }"
      >
        {{ item.stationName }}
      </b-link>
    </span>
    <b-modal
      v-model="showingLocation"
      hide-footer
      :title="`${item.deviceName}: #${item.id}`"
      lazy
    >
      <MapWithPoints :points="[itemLocation]" />
    </b-modal>
    <span @click="showLocation">{{ item.location }}</span>
    <BatteryLevel v-if="item.batteryLevel" :battery-level="item.batteryLevel" />
    <span v-else />
  </div>
</template>

<script lang="ts">
import BatteryLevel from "./BatteryLevel.vue";
import TagBadge from "./TagBadge.vue";
import MapWithPoints from "@/components/MapWithPoints.vue";

export default {
  name: "RecordingSummary",
  components: { MapWithPoints, TagBadge, BatteryLevel },
  props: {
    item: {
      type: Object,
      required: true,
    },
    displayStyle: {
      type: String,
      required: true,
      default: "cards",
    },
    futureSearchQuery: {
      type: Object,
    },
  },
  data() {
    return {
      showingLocation: false,
    };
  },
  computed: {
    hasBattery() {
      return this.item.batteryLevel;
    },
    window: {
      get() {
        return window;
      },
    },
    queuedForProcessing(): boolean {
      return this.item.processingState === "Analyse";
    },
    processing(): boolean {
      return (
        this.item.processingState === "Analyse" && this.item.processingStartTime
      );
    },
    itemLocation(): { name: string; location: string }[] {
      return [
        {
          name: `${this.item.deviceName}, #${this.item.id}`,
          location: this.item.location,
        },
      ];
    },
  },
  methods: {
    showLocation() {
      this.showingLocation = true;
    },
    navigateToRecording(event, recordingId) {
      if (event.target !== event.currentTarget && event.target.href) {
        // Clicking a link inside the outer card link
        return;
      }
      if (!(event.metaKey || event.ctrlKey || event.shiftKey)) {
        // Don't change the route if we're ctrl-clicking
        event.preventDefault();
        this.$router.push({
          path: `/recording/${recordingId}`,
          query: this.futureSearchQuery,
        });
      }
    },
    getRecordingPath(recordingId) {
      return this.$router.resolve({
        path: `/recording/${recordingId}`,
        query: this.futureSearchQuery,
      }).href;
    },
  },
};
</script>

<style scoped lang="scss">
@import "~bootstrap/scss/functions";
@import "~bootstrap/scss/variables";
@import "~bootstrap/scss/mixins";

$recording-side-padding: 0.9rem;

.svg-inline--fa,
.spinner-border-sm {
  color: $gray-600;
}

// the wrapper of the recording
.recording-summary {
  display: flex;
  flex-flow: row nowrap;
  border: 1px solid $border-color;
  margin-bottom: 1rem;
  cursor: pointer;
  transition: box-shadow 0.2s;
  color: unset;
  a:visited {
    color: purple;
  }
  div {
    color: inherit;
  }
  &:hover {
    box-shadow: 0 1px 3px $gray-400;
    text-decoration: unset;
  }
  &:visited {
    border: 1px solid rgb(245, 245, 245);
    a:visited {
      color: #b314b3;
    }
  }
}

// Row view variant
.recording-summary-row {
  width: 100%;
  &:nth-child(odd) {
    background-color: #eee;
  }
  border-top: 1px solid $border-color;
  display: table-row;
  a:visited {
    color: purple;
  }
  > * {
    display: table-cell;
    vertical-align: middle;
    padding: 5px;
    border-right: 1px solid $border-color;
    &:last-child {
      padding-right: 5px;
    }
  }
  .svg-inline--fa.fa-2x {
    font-size: 1.2em;
  }
  .recording-time {
    white-space: nowrap;
  }
}

// wrapper of the icon on the left
.recording-type {
  padding: 0.8rem $recording-side-padding;
  background: $gray-100;
  @include media-breakpoint-up(sm) {
    padding: 1rem 1.1rem;
  }
  flex: 0 1 auto;
  .fa-2x {
    font-size: 1.5em;
  }
}

// main content in the middle
.recording-main {
  flex: 1 1 auto;
  display: flex;
  flex-flow: column nowrap;
  min-height: 110px;
  .svg-inline--fa {
    // set a fixed width on fontawesome icons so they align neatly when stacked
    width: 16px;
  }
  .recording-details {
    flex: 1 1 auto;
    padding: 0.7rem $recording-side-padding;
    .recording-station,
    .recording-group,
    .recording-device {
      // all elements that are the direct descendants of this div
      display: inline-block;
      word-break: break-word;
      margin-right: 0.5rem;
      @include media-breakpoint-down(xs) {
        display: block;
      }
    }
  }
  .label {
    vertical-align: middle;
  }

  .recording-tags {
    padding: 0 $recording-side-padding 0.9rem;
    margin-top: -0.4rem;
  }
  .recording-time-duration {
    display: flex;
    flex-flow: row wrap;
    border-top: 1px solid $border-color;
    > div {
      padding: 0.5rem $recording-side-padding;
      font-size: 85%;
    }
    .recording-duration,
    .recording-battery {
      border-left: 1px solid $border-color;
    }
    .recording-duration {
      margin-right: auto;
    }
    @include media-breakpoint-down(xs) {
      .recording-time {
        width: 100%;
        border-bottom: 1px solid $border-color;
      }
      .recording-duration {
        border-left: none;
      }
    }
  }
}

// map
.recording-location {
  display: flex;
  flex: 0 1 110px;
  min-width: 109px;
  text-align: center;
  align-items: center;
  justify-content: center;
  background: $gray-100;
  @include media-breakpoint-between(xs, sm) {
    display: none;
  }
}
.recording-tracks {
  display: inline-block;
}
.location-link {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
