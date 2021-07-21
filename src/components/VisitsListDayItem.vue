<template>
  <div :class="['day-wrapper', { 'has-visits': hasVisits }]">
    <h4 class="recordings-day" @click="toggleExpanded">
      <span v-html="relativeDay" />
      <span>
        <font-awesome-icon
          v-if="hasVisits"
          icon="chevron-right"
          :rotation="expanded ? 270 : 90"
        />
      </span>
    </h4>
    <div class="day-summary" v-if="!expanded" @click="toggleExpanded">
      <span class="no-activity" v-if="visitClasses.length === 0"
        >No activity</span
      >
      <div v-else class="visit-badges">
        <span
          v-for="([name, count], i) in visitClasses"
          :key="i"
          :class="['summary-badge', name]"
        >
          <img
            :key="i"
            :class="['summary-image', name]"
            :src="imgSrc(name)"
            width="24"
            height="auto"
            :alt="name"
            onerror="this.src='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=='"
          />
          {{ formatNameAndCount(name, count) }}
        </span>
      </div>
    </div>
    <div v-else>
      <div v-for="(item, index) in reversedItems" :key="index">
        <VisitSummary
          :key="`${index}_card_a`"
          :item="item"
          :future-search-query="futureSearchQuery"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import VisitSummary from "@/components/VisitSummary.vue";
import { toStringTodayYesterdayOrDateInNights } from "@/helpers/datetime";
import { NewVisit } from "@/api/Monitoring.api";
import { imgSrc } from "@/const";

export interface ItemData {
  kind: "dataRow" | "dataSeparator" | "noActivity" | "powerEvent" | "duskDawn";
  name: string;
  fromDate: Date;
  toDate: Date;
  time: string;
  item: NewVisit;
}

// NOTE: Sorting precedence for visit tags displayed as small summary icons
const tagPrecedence = [
  "conflicting tags",
  "unidentified",
  "none",
  "mustelid",
  "cat",
  "possum",
  "hedgehog",
  "rodent",
  "leporidae",
];

export const formatName = (name: string): string => {
  return name
    .substr(0, 1)
    .toUpperCase()
    .concat(name.slice(1))
    .replace(/-/g, " ");
};

export default {
  components: {
    VisitSummary,
  },
  name: "VisitsListDayItem",
  props: {
    items: {
      type: Array,
      required: true,
    },
    futureSearchQuery: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      expanded: false,
    };
  },
  methods: {
    reverse(arr) {
      return [...arr].reverse();
    },
    imgSrc(what: string) {
      if (what === "none" || what === "conflicting-tags") {
        return imgSrc("unidentified");
      }
      return imgSrc(what);
    },
    formatNameAndCount(name: string, count: number): string {
      const formattedName = formatName(name);
      if (count > 1) {
        // Find the display name for the tag, pluralise it:
        return `${count} ${formattedName}${
          count !== 1 &&
          !formattedName.endsWith("s") &&
          !formattedName.endsWith("ae") // Leporidae
            ? "s"
            : ""
        }`;
      }
      return formattedName;
    },
    toggleExpanded() {
      if (this.hasVisits) {
        this.expanded = !this.expanded;
      }
    },
  },
  computed: {
    hasVisits(): boolean {
      return this.visitClasses.length !== 0;
    },
    relativeDay() {
      const dayChunk = this.reversedItems as ItemData[];
      const fromDate = dayChunk[0].fromDate;
      return toStringTodayYesterdayOrDateInNights(fromDate);
    },
    reversedItems(): Array<ItemData[]> {
      return [...this.items].reverse();
    },
    visitClasses(): [string, number][] {
      const dayChunk = this.items as ItemData[];
      return Object.entries(
        dayChunk
          .filter((item) => item.name && item.kind === "dataRow")
          .map((item) => {
            const name = item.name.replace(/ /g, "-");
            return {
              name,
              priority: tagPrecedence.indexOf(name),
            };
          })
          .sort((a, b) => {
            if (a.priority === -1 && b.priority > -1) {
              return 1;
            } else if (b.priority === -1 && a.priority > -1) {
              return -1;
            } else if (a.priority === -1 && b.priority === -1) {
              if (a.name === b.name) {
                return 0;
              }
              return a.name > b.name ? 1 : -1;
            }
            return a.priority - b.priority;
          })
          .reduce((acc, item) => {
            const name = item.name;
            acc[name] = acc[name] || 0;
            acc[name]++;
            return acc;
          }, {})
      );
    },
  },
};
</script>

<style scoped lang="scss">
@import "~bootstrap/scss/functions";
@import "~bootstrap/scss/variables";
@import "~bootstrap/scss/mixins";

.has-visits {
  > .day-summary,
  > .recordings-day {
    cursor: pointer;
  }
  > .day-summary > .visit-badges {
    padding: 0 5px;
  }
}

.summary-badge {
  font-size: 14px;
  background: #f2f2f2;
  line-height: 30px;
  padding: 0 10px;
  margin: 0 5px 10px 5px;
  border-radius: 3px;
  display: inline-block;
  border: 2px solid transparent;
  &.mustelid {
    border-color: red;
  }
  &.possum,
  &.cat {
    border-color: #b53326;
  }
  &.rodent,
  &.hedgehog {
    border-color: lighten(coral, 20%);
  }
}

.recordings-day {
  position: sticky;
  top: 0;
  display: flex;
  justify-content: space-between;
  background: transparentize($white, 0.15);
  > span {
    display: inline-block;
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

.day-wrapper {
  border: 1px solid #eee;
  margin: 20px 0;
}
.day-wrapper > div > div:last-child > div.visit-item:last-child {
  padding-bottom: 10px;
}
.no-activity {
  font-style: italic;
  color: #ccc;
  font-size: 14px;
  padding: 0 0 10px 10px;
  display: inline-block;
}
</style>
