<template>
  <div
    :class="['results', { 'display-rows': !showCards }]"
    ref="list-container"
  >
    <div v-if="showCards">
      <div
        v-for="(itemsByDay, index_a) in recordingsChunkedByDayAndHour"
        :key="index_a"
      >
        <h4 class="recordings-day">{{ relativeDay(itemsByDay) }}</h4>
        <div v-for="(itemsByHour, index_b) in itemsByDay" :key="index_b">
          <h5 class="recordings-hour">{{ hour(itemsByHour) }}</h5>
          <RecordingSummary
            v-for="(item, index) in itemsByHour"
            :item="item"
            :key="`${index}_card`"
            :ref="item.id"
            :futureSearchQuery="viewRecordingQuery"
            display-style="card"
          />
        </div>
      </div>
      <div v-if="queryPending" class="results loading">
        <div
          v-for="i in 10"
          :style="{
            background: `rgba(240, 240, 240, ${1 / i}`,
          }"
          :key="i"
          class="recording-placeholder"
        />
      </div>
    </div>
    <div v-else-if="tableItems && tableItems.length !== 0" class="all-rows">
      <div class="results-header">
        <div>
          <span>ID</span>
          <span>Type</span>
          <span>Device</span>
          <span>Date</span>
          <span>Time</span>
          <span>Duration</span>
          <span>Tags</span>
          <span>Group</span>
          <span>Station</span>
          <span>Location</span>
          <span>Battery</span>
        </div>
      </div>
      <div class="results-rows">
        <RecordingSummary
          v-for="(item, index) in tableItems"
          :item="item"
          :ref="item.id"
          :is-even-row="index % 2 === 1"
          :key="`${index}_row`"
          display-style="row"
          :futureSearchQuery="viewRecordingQuery"
        />

        <div
          v-for="i in queryPending ? 20 : 0"
          :key="i"
          class="recording-summary-row"
          :style="{
            background: `rgba(240, 240, 240, ${1 / i}`,
          }"
        >
          <span>&nbsp;</span>
          <span>&nbsp;</span>
          <span>&nbsp;</span>
          <span>&nbsp;</span>
          <span>&nbsp;</span>
          <span>&nbsp;</span>
          <span>&nbsp;</span>
          <span>&nbsp;</span>
          <span>&nbsp;</span>
          <span>&nbsp;</span>
          <span>&nbsp;</span>
        </div>
      </div>
    </div>
    <div v-if="allLoaded || atEnd" class="all-loaded">
      <span>That's all! No more recordings to load for the current query.</span>
    </div>
  </div>
</template>

<script lang="ts">
import {
  Location,
  RecordingInfo,
  RecordingType,
  Tag,
  Track,
  TrackTag,
} from "@/api/Recording.api";
import RecordingSummary from "@/components/RecordingSummary.vue";
import {
  toNZDateString,
  startOfDay,
  startOfHour,
  toStringTodayYesterdayOrDate,
} from "@/helpers/datetime";

const parseLocation = (location: Location): string => {
  if (location && typeof location === "object") {
    const latitude = location.coordinates[0];
    const longitude = location.coordinates[1];
    return latitude.toFixed(5) + ", " + longitude.toFixed(5);
  } else {
    return "(unknown)";
  }
};

const parseProcessingState = (result: string): string => {
  const string = result.toLowerCase();
  return string.charAt(0).toUpperCase() + string.slice(1);
};

interface IntermediateDisplayTag {
  taggerIds: number[];
  automatic: boolean;
  human: boolean;
}

interface DisplayTag {
  taggerIds: number[];
  automatic: boolean;
  class: "human" | "automatic" | "automatic human";
  human: boolean;
  order: number;
}

const addToListOfTags = (
  allTags: Record<string, IntermediateDisplayTag>,
  tagName: string,
  isAutomatic: boolean,
  taggerId: number | null
) => {
  const tag = allTags[tagName] || {
    taggerIds: [],
    automatic: false,
    human: false,
  };
  if (taggerId && !tag.taggerIds.includes(taggerId)) {
    tag.taggerIds.push(taggerId);
  }
  if (isAutomatic) {
    tag.automatic = true;
  } else {
    tag.human = true;
  }
  allTags[tagName] = tag;
};

const collateTags = (tags: Tag[], tracks: Track[]): DisplayTag[] => {
  // Build a collection of tagItems - one per animal
  const tagItems: Record<string, DisplayTag> = {};
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    const tagName = tag.animal === null ? tag.event : tag.animal;
    const taggerId = tag.taggerId;
    addToListOfTags(tagItems, tagName, tag.automatic, taggerId);
  }

  if (tracks) {
    for (let j = 0; j < tracks.length; j++) {
      const track = tracks[j];
      // For track tags, pick the best one, which is the "master AI" tag.
      const aiTag: TrackTag = track.TrackTags.find(
        (tag) =>
          tag.data &&
          (tag.data === "Master" ||
            (typeof tag.data === "object" && tag.data.name === "Master"))
      );
      const humanTags = track.TrackTags.filter((tag) => !tag.automatic);
      // If the same track has one or more human tags, and none of them agree with the AI just show that:
      let humansDisagree = false;
      if (aiTag && humanTags.length !== 0) {
        humansDisagree =
          humanTags.find((tag) => tag.what === aiTag.what) === undefined;
      }

      if (aiTag && !humansDisagree) {
        addToListOfTags(tagItems, aiTag.what, aiTag.automatic, aiTag.UserId);
      }

      // Also add human tags:
      for (const tag of humanTags) {
        addToListOfTags(tagItems, tag.what, tag.automatic, tag.UserId);
      }
    }
  }

  // Use automatic and human status to create an ordered array of objects
  // suitable for parsing into coloured spans
  const result = [];
  for (let animal of Object.keys(tagItems).sort()) {
    const tagItem = tagItems[animal];
    let subOrder = 0;
    if (animal === "false positive") {
      animal = "false positive";
      subOrder = 3;
    } else if (animal === "multiple animals") {
      animal = "multiple";
      subOrder = 2;
    } else if (animal === "unidentified") {
      animal = "?";
      subOrder = 1;
    }

    if (tagItem.automatic && tagItem.human) {
      result.push({
        text: animal,
        class: "automatic human",
        taggerIds: tagItem.taggerIds,
        order: subOrder,
      });
    } else if (tagItem.human) {
      result.push({
        text: animal,
        class: "human",
        taggerIds: tagItem.taggerIds,
        order: 10 + subOrder,
      });
    } else if (tagItem.automatic) {
      result.push({
        text: animal,
        class: "automatic",
        order: 20 + subOrder,
      });
    }
  }
  // Sort the result array
  result.sort((a, b) => {
    return a.order - b.order;
  });
  return result;
};

interface ItemData {
  kind: "dataRow" | "dataSeparator";
  id: number;
  type: RecordingType;
  deviceName: string;
  groupName: string;
  stationName?: string;
  location: string;
  dateObj: Date;
  date: string;
  time: string;
  duration: number;
  tags: DisplayTag[];
  batteryLevel: number | null;
  trackCount: number;
  processingState: string;
}

export default {
  name: "RecordingsList",
  components: { RecordingSummary },
  props: {
    recordings: {
      type: Array,
      required: true,
    },
    showCards: {
      type: Boolean,
      default: true,
    },
    queryPending: {
      type: Boolean,
      required: true,
    },
    viewRecordingQuery: {
      type: Object,
      default: () => ({}),
    },
    allLoaded: {
      type: Boolean,
      default: false,
    },
  },
  watch: {
    recordings() {
      let prevDate = null;
      const recordings = this.recordings as RecordingInfo[];
      if (recordings.length === 0) {
        this.tableItems = [];
        this.recordingsChunkedByDayAndHour = [];
        this.loadedRecordingsCount = 0;
        return;
      }
      // Slice from last recordings count, so we're only processing new recordings.
      const newRecordings = recordings.slice(this.loadedRecordingsCount);
      this.loadedRecordingsCount = this.recordings.length;
      const items = [];

      for (const recording of newRecordings) {
        const thisDate = new Date(recording.recordingDateTime);
        if (
          prevDate === null ||
          startOfDay(thisDate, true).getTime() !==
            startOfDay(prevDate, true).getTime()
        ) {
          const item = {
            kind: "dataSeparator",
            hour: thisDate,
            date: thisDate,
          };
          items.push(item);
          prevDate = thisDate;
        } else if (
          startOfHour(thisDate, true).getTime() !==
          startOfHour(prevDate, true).getTime()
        ) {
          const item = {
            kind: "dataSeparator",
            hour: thisDate,
          };
          items.push(item);
          prevDate = thisDate;
        }
        const itemData: ItemData = {
          kind: "dataRow",
          id: recording.id,
          type: recording.type,
          deviceName: recording.Device.devicename,
          groupName: recording.Group.groupname,
          location: parseLocation(recording.location),
          dateObj: thisDate,
          date: toNZDateString(thisDate),
          time: thisDate.toLocaleTimeString(),
          duration: recording.duration,
          tags: collateTags(recording.Tags, recording.Tracks),
          batteryLevel: recording.batteryLevel,
          trackCount: recording.Tracks.length,
          processingState: parseProcessingState(recording.processingState),
        };
        if (recording.Station) {
          itemData.stationName = recording.Station.name;
        }
        items.push(itemData);
      }
      this.tableItems.push(...items);

      // Now calculate chunks of days and hour groupings
      {
        const chunks = [];
        let current = chunks;
        for (const item of items) {
          if (item.kind === "dataSeparator") {
            if (item.hasOwnProperty("date")) {
              chunks.push([]);
              current = chunks[chunks.length - 1];
            }
            if (item.hasOwnProperty("hour")) {
              current.push([]);
            }
          } else {
            current[current.length - 1].push(item);
          }
        }
        if (chunks.length === 0) {
          // We've reached the end of the recordings.
          this.atEnd = true;
          // console.log("At end of recordings");
        }
        if (
          this.recordingsChunkedByDayAndHour.length !== 0 &&
          chunks.length !== 0
        ) {
          // We need to be careful joining these here:
          const lastDay =
            this.recordingsChunkedByDayAndHour[
              this.recordingsChunkedByDayAndHour.length - 1
            ];
          const lastHour =
            lastDay[lastDay.length - 1][lastDay[lastDay.length - 1].length - 1];
          const firstDay = chunks[0];
          const firstHour = firstDay[0][0];

          if (lastHour.date === firstHour.date) {
            // We're going to push firstDay into lastDay
            if (lastHour.time.split(":")[0] === firstHour.time.split(":")[0]) {
              lastDay[lastDay.length - 1].push(...firstDay[0]);
              lastDay.push(...firstDay.slice(1));
            } else {
              lastDay.push(...firstDay);
            }
            this.recordingsChunkedByDayAndHour.push(...chunks.slice(1));
          } else {
            this.recordingsChunkedByDayAndHour.push(...chunks);
          }
        } else {
          // If lastDay/Hour is the same as previous, join them.
          this.recordingsChunkedByDayAndHour.push(...chunks);
        }
      }
    },
  },
  beforeDestroy() {
    this.observer && this.observer.disconnect();
  },
  beforeUpdate() {
    this.observer && this.observer.disconnect();
  },
  updated() {
    // Setup next intersection observer to see the page has scrolled enough to load more items
    this.observer = new IntersectionObserver(this.intersectionChanged);
    // Observe intersections of cards
    const maxY = [];
    // Just observe the nth to last item, and when it comes into view, we load more, and disconnect the observer.
    const n = 3;
    for (const ref of Object.values(this.$refs)) {
      if ((ref as any[]).length !== 0) {
        if (ref[0] && ref[0].$el) {
          const bounds = ref[0].$el.getBoundingClientRect();
          maxY.push([bounds.y, ref[0].$el]);
          maxY.sort((a, b) => b[0] - a[0]);
          if (maxY.length > n) {
            maxY.pop();
          }
        }
      }
    }
    if (maxY.length) {
      const observerTrigger = maxY[maxY.length - 1][1];
      this.$refs["list-container"].style.height = `${maxY[0][0]}px`;
      this.observer && this.observer.observe(observerTrigger);
    }
  },
  methods: {
    intersectionChanged(entries: IntersectionObserverEntry[]) {
      for (const intersectionEvent of entries) {
        if (intersectionEvent.isIntersecting) {
          this.observer.unobserve(intersectionEvent.target);
          this.$emit("load-more");
        }
      }
    },
    relativeDay(itemDate) {
      itemDate = itemDate[0][0].dateObj;
      return toStringTodayYesterdayOrDate(itemDate);
    },
    hour(itemDate) {
      itemDate = itemDate.length && itemDate[0].dateObj;
      const hours = itemDate && itemDate.getHours();
      if (hours === 0) {
        return "12am";
      }
      return `${hours <= 12 ? hours : hours - 12}${hours < 12 ? "am" : "pm"}`;
    },
  },
  data() {
    return {
      recordingsChunkedByDayAndHour: [],
      tableItems: [],
      atEnd: false,
      loadedRecordingsCount: 0,
    };
  },
};
</script>

<style scoped lang="scss">
@import "~bootstrap/scss/functions";
@import "~bootstrap/scss/variables";
@import "~bootstrap/scss/mixins";

.recordings-day {
  position: sticky;
  top: 0;
  background: transparentize($white, 0.15);
  padding: 0.5rem 0;
  font-size: 1em;
  font-weight: 600;
  border-bottom: 1px solid $gray-200;
}

.recordings-hour {
  font-size: 0.9em;
  font-weight: 600;
}

@include media-breakpoint-down(md) {
  .recordings-hour {
    position: sticky;
    top: 0;
    right: 0;
    text-align: right;
    margin-top: -1rem;
    margin-bottom: 0;
    padding: 0.7rem 0;
  }
  .recordings-day + div .recordings-hour {
    margin-top: -2.8rem;
    margin-bottom: 11px;
  }
}

@include media-breakpoint-up(md) {
  .recordings-hour {
    display: inline-block;
    position: sticky;
    float: left;
    top: 40px;
    margin-left: -60px;
    margin-top: 15px;
  }
}

.recording-placeholder {
  height: 110px;
  margin-bottom: 15px;
}

.results {
  max-width: 640px;
}

.results.display-rows {
  overflow-x: auto;
  //overflow-y: unset;
  max-width: unset;

  .results-rows {
    display: table-row-group;
  }
  .all-rows {
    display: table;
    width: 100%;
    border-top: 1px solid $border-color;
    border-left: 1px solid $border-color;
  }

  .results-header {
    margin-bottom: 0;
    display: table-header-group;
    > div {
      display: table-row;

      > span {
        position: sticky;
        top: 0;
        background: transparentize($white, 0.15);
        padding: 5px;
        font-weight: 700;
        vertical-align: middle;
        display: table-cell;
        border-right: 1px solid $border-color;
        border-bottom: 2px solid $border-color;
      }
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
  > * {
    display: table-cell;
    vertical-align: middle;
    padding: 5px;
    border-right: 1px solid $border-color;
    &:last-child {
      padding-right: 5px;
    }
  }
}
.all-loaded {
  text-align: center;
  padding-top: 20px;
  padding-bottom: 30px;
  color: #aaa;
  > span {
    padding: 5px 10px;
    border-radius: 15px;
    background: $gray-100;
    font-weight: bold;
  }
}
</style>
