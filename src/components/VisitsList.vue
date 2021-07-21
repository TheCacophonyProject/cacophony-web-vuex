<template>
  <div :class="['results']" ref="list-container">
    <div>
      <VisitsListDayItem
        v-for="(itemsByDay, index) in visitsChunkedByDay"
        :key="index"
        :items="itemsByDay"
        :future-search-query="viewVisitsQuery"
        :ref="`day_${index}`"
      />
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
    <div v-if="allLoaded || atEnd" class="all-loaded">
      <span>That's all! No more visits to load for the current query.</span>
    </div>
  </div>
</template>

<script lang="ts">
import { startOfEvening } from "@/helpers/datetime";
import { NewVisit } from "@/api/Monitoring.api";
import VisitsListDayItem, {
  ItemData,
} from "@/components/VisitsListDayItem.vue";

interface VisitsListData {
  visitsChunkedByDay: Array<Array<ItemData[]>>;
  atEnd: boolean;
  loadedVisitsCount: number;
}

export default {
  name: "VisitsList",
  components: {
    VisitsListDayItem,
  },
  props: {
    visits: {
      type: Array,
      required: true,
    },
    queryPending: {
      type: Boolean,
      required: true,
    },
    viewVisitsQuery: {
      type: Object,
      default: () => ({}),
    },
    allLoaded: {
      type: Boolean,
      default: false,
    },
  },
  watch: {
    visits() {
      // TODO(jon): Chunk this by "night" of recording, so that I can easily see what happened in
      //  the previous night from dusk till dawn.
      // For each day, have a summary of species at the top.
      // Keep lazy loading until we have each day, so that we can display proper summaries for each day.

      // Should I show periods of "no activity"? Yes, I think that makes things clearer.
      let prevFromDate = null;
      let prevDate = null;
      const visits = this.visits as NewVisit[];
      if (visits.length === 0) {
        this.visitsChunkedByDay = [];
        this.loadedRecordingsCount = 0;
        return;
      } else {
        prevFromDate = new Date(visits[visits.length - 1].timeStart);
        prevDate = prevFromDate;
      }
      // Slice from last recordings count, so we're only processing new recordings.
      const newVisits = visits.slice(this.loadedVisitsCount);
      const items = [];
      // TODO(jon): Intersperse power-on/power-off events and dusk/dawn times
      if (newVisits.length && this.loadedVisitsCount !== 0) {
        items.push({
          kind: "dataSeparator",
          hour: prevFromDate,
          date: prevFromDate,
        });
      }

      for (const visit of newVisits) {
        const fromDate = new Date(visit.timeStart);
        const toDate = new Date(visit.timeEnd);
        if (
          (newVisits.length === 1 && this.loadedVisitsCount === 0) ||
          prevFromDate === null ||
          startOfEvening(fromDate).getTime() !==
            startOfEvening(prevFromDate).getTime()
        ) {
          const item = {
            kind: "dataSeparator",
            hour: fromDate,
            date: fromDate,
          };
          items.push(item);
          prevFromDate = fromDate;
        }

        if (
          prevDate &&
          Math.abs(prevDate.getTime() - toDate.getTime()) < 1000 * 60 * 60 * 8
        ) {
          // Push "no activity block" if less than 8 eight hours of inactivity
          items.push({
            kind: "noActivity",
            name: "no activity",
            fromDate: toDate,
            toDate: prevDate,
            time: toDate.toLocaleTimeString(),
            item: { recordings: [] },
          });
        }
        const duskDawn = ["Sunset", "Sunrise"];
        const itemData: ItemData = {
          kind: duskDawn.includes(visit.classification)
            ? "duskDawn"
            : "dataRow",
          name: visit.classification,
          fromDate,
          toDate,
          time: fromDate.toLocaleTimeString(),
          item: visit,
        };
        prevDate = fromDate;
        items.push(itemData);
      }
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
          } else {
            current.push(item);
          }
        }
        if (current.length === 0) {
          chunks.pop();
        }
        if (chunks.length === 0) {
          // We've reached the end of the recordings.
          this.atEnd = true;
        }
        this.visitsChunkedByDay.push(
          ...chunks.filter((chunk) => chunk.length !== 0)
        );
      }
    },
  },
  beforeDestroy() {
    this.unload();
  },
  beforeUpdate() {
    this.unload();
  },
  updated() {
    if (this.visits.length !== this.loadedVisitsCount) {
      this.loadedVisitsCount = this.visits.length;
      // Setup next intersection observer to see the page has scrolled enough to load more items
      this.observer = new IntersectionObserver(this.intersectionChanged);
      // Observe intersections of cards
      const maxY = [];
      // Just observe the nth to last item, and when it comes into view, we load more, and disconnect the observer.
      const n = 3;
      for (const ref of Object.values(this.$refs)) {
        if ((ref as any[]).length !== 0) {
          if (ref[0] && ref[0].$el) {
            const bounds =
              ref[0].$el.getBoundingClientRect &&
              ref[0].$el.getBoundingClientRect();
            if (bounds) {
              maxY.push([bounds.y, ref[0].$el]);
              maxY.sort((a, b) => b[0] - a[0]);
              if (maxY.length > n) {
                maxY.pop();
              }
            }
          }
        }
      }
      if (maxY.length) {
        const observerTrigger = maxY[maxY.length - 1][1];
        this.$refs["list-container"].style.height = `${maxY[0][0]}px`;
        //console.log("Observing", observerTrigger);
        this.observer && this.observer.observe(observerTrigger);
      }
    }
  },
  methods: {
    intersectionChanged(entries: IntersectionObserverEntry[]) {
      for (const intersectionEvent of entries) {
        if (intersectionEvent.isIntersecting) {
          this.observer.unobserve(intersectionEvent.target);
          //console.log("Emitting load more", intersectionEvent);
          this.$emit("load-more");
        }
      }
    },
    reverse(arr) {
      return [...arr].reverse();
    },
    unload() {
      this.observer && this.observer.disconnect();
    },
  },
  data(): VisitsListData {
    return {
      visitsChunkedByDay: [],
      atEnd: false,
      loadedVisitsCount: 0,
    };
  },
};
</script>

<style scoped lang="scss">
@import "~bootstrap/scss/functions";
@import "~bootstrap/scss/variables";
@import "~bootstrap/scss/mixins";

.day-summary {
  cursor: pointer;
}

.summary-badge {
  font-size: 14px;
  background: #eee;
  line-height: 30px;
  padding: 0 10px;
  margin: 0 0 0 10px;
  border-radius: 3px;
  display: inline-block;
}

.recordings-day {
  position: sticky;
  cursor: pointer;
  top: 0;
  display: flex;
  justify-content: space-between;
  > span {
    display: inline-block;
    background: transparentize($white, 0.15);
    padding: 0.5rem 15px 0.5rem 10px;
  }
  font-size: 1.1em;
  font-weight: 600;
  padding-bottom: 10px;
  margin-bottom: 0;
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
    min-width: 100px;
    position: sticky;
    float: left;
    top: 40px;
    text-align: right;
    margin-left: -110px;
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
