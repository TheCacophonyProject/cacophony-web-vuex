<template>
  <div
    :class="[
      'visit-item',
      { 'small-gap': smallGapOfInactivity },
      { 'big-gap': !smallGapOfInactivity },
    ]"
    v-if="item.kind === 'noActivity'"
  />
  <div
    v-else-if="item.kind === 'powerEvent'"
    :class="['visit-item', 'power-event']"
  >
    <span>
      <font-awesome-icon
        v-if="item.name === 'rpi-power-on'"
        icon="bolt"
        size="xs"
      />
      <font-awesome-icon v-else icon="power-off" size="xs" />
    </span>
    <span>&nbsp;{{ item.name }}</span>
  </div>
  <div
    v-else-if="item.kind === 'duskDawn'"
    :class="['visit-item', 'dusk-dawn']"
  >
    <div class="icon-name">
      <div class="visit-badge">
        <svg
          viewBox="0 0 32 32"
          width="48"
          fill="currentColor"
          v-if="name === 'Sunrise'"
        >
          <path
            d="M 15 15 L 15 19.09375 C 13.816406 19.265625 12.726563 19.722656 11.8125 20.40625 L 8.9375 17.5 L 7.5 18.9375 L 10.40625 21.8125 C 9.722656 22.726563 9.265625 23.816406 9.09375 25 L 5 25 L 5 27 L 27 27 L 27 25 L 22.90625 25 C 22.734375 23.816406 22.277344 22.726563 21.59375 21.8125 L 24.5 18.9375 L 23.0625 17.5 L 20.1875 20.40625 C 19.273438 19.722656 18.183594 19.265625 17 19.09375 L 17 15 Z M 16 21 C 18.425781 21 20.441406 22.714844 20.90625 25 L 11.09375 25 C 11.558594 22.714844 13.574219 21 16 21 Z"
          ></path>
          <path
            d="M 15 5 L 15 9 L 12 9 L 16 13 L 20 9 L 17 9 L 17 5 Z"
            transform="rotate(180), translate(0, 15)"
            transform-origin="center"
          ></path>
        </svg>
        <svg viewBox="0 0 32 32" fill="currentColor" v-else width="48">
          <path
            d="M 15 15 L 15 19.09375 C 13.816406 19.265625 12.726563 19.722656 11.8125 20.40625 L 8.9375 17.5 L 7.5 18.9375 L 10.40625 21.8125 C 9.722656 22.726563 9.265625 23.816406 9.09375 25 L 5 25 L 5 27 L 27 27 L 27 25 L 22.90625 25 C 22.734375 23.816406 22.277344 22.726563 21.59375 21.8125 L 24.5 18.9375 L 23.0625 17.5 L 20.1875 20.40625 C 19.273438 19.722656 18.183594 19.265625 17 19.09375 L 17 15 Z M 16 21 C 18.425781 21 20.441406 22.714844 20.90625 25 L 11.09375 25 C 11.558594 22.714844 13.574219 21 16 21 Z"
          ></path>
          <path d="M 15 5 L 15 9 L 12 9 L 16 13 L 20 9 L 17 9 L 17 5 Z"></path>
        </svg>
      </div>
      <div class="name-time">
        <span>
          {{ name }}
        </span>
        <span>
          {{ startTime }}
        </span>
      </div>
    </div>
  </div>
  <div v-else :class="['visit-item', 'visit', item.name]">
    <div class="icon-name">
      <div class="visit-badge">
        <img
          :src="imgSrc"
          onerror="this.src='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=='"
          width="48"
          height="auto"
          :alt="name"
        />
        <span class="recording-count">{{ item.item.recordings.length }}</span>
      </div>
      <div class="name-time">
        <span>
          {{ name }}
        </span>
        <span>
          {{ startTime }}
        </span>
      </div>
    </div>
    <div class="duration-view">
      <span class="duration">
        <font-awesome-icon :icon="['far', 'clock']" size="xs" />
        {{ visitLength }}
      </span>
      <a
        class="recordings-link"
        :href="recordingsListLink"
        @click="gotoRecordingsForVisit"
        >View recording<span v-if="item.item.recordings.length > 1">s</span></a
      >
    </div>
  </div>
</template>

<script lang="ts">
import { imgSrc } from "@/const";
import { formatName } from "./VisitsListDayItem.vue";

const timeElapsed = (start: Date, end: Date): string => {
  const seconds = Math.round((end.getTime() - start.getTime()) / 1000);
  if (seconds < 60) {
    return `${seconds} second${seconds > 1 ? "s" : ""}`;
  } else if (seconds < 60 * 60) {
    const minutes = Math.round(seconds / 60);
    return `${minutes} minute${minutes > 1 ? "s" : ""}`;
  } else if (seconds < 60 * 60 * 60) {
    const hours = (seconds / 60 / 60).toFixed(2);
    return `${hours} hour${Math.round(seconds / 60 / 60) > 1 ? "s" : ""}`;
  }
  return seconds.toString();
};

const timeFormat = (fromDate: Date): string => {
  const fromHours = fromDate && fromDate.getHours();
  const minutes = fromDate.getMinutes().toString().padStart(2, "0");
  if (fromHours === 0) {
    return `12:${minutes}am`;
  } else {
    return `${fromHours <= 12 ? fromHours : fromHours - 12}:${minutes}${
      fromHours < 12 ? "am" : "pm"
    }`;
  }
};

export default {
  name: "VisitSummary",
  props: {
    item: {
      type: Object,
      required: true,
    },
    futureSearchQuery: {
      type: Object,
      required: true,
    },
  },
  computed: {
    imgSrc() {
      if (this.item.name === "none" || this.item.name === "conflicting-tags") {
        return imgSrc("unidentified");
      }
      return imgSrc(this.item.name);
    },
    visitLength(): string {
      return timeElapsed(this.item.fromDate, this.item.toDate);
    },
    smallGapOfInactivity(): boolean {
      return (
        Math.abs(this.item.fromDate.getTime() - this.item.toDate.getTime()) <
        1000 * 60 * 16
      );
    },
    name() {
      return formatName(this.item.name);
    },
    startTime() {
      return timeFormat(this.item.fromDate);
    },
    recordingsListLink() {
      const firstRecordingId = this.item.item.recordings[0].recId;
      const remainingIds = this.item.item.recordings.map(
        ({ recId }) => `id=${recId}`
      );
      let remainingIdsQuery = "";
      if (remainingIds.length > 1) {
        remainingIdsQuery = `?${remainingIds.join("&")}`;
      }
      return `/recording/${firstRecordingId}${remainingIdsQuery}`;
    },
  },
  methods: {
    gotoRecordingsForVisit(e) {
      if (!e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.$router.push({
          path: this.recordingsListLink,
        });
      }
    },
  },
};
</script>

<style scoped lang="scss">
@import "~bootstrap/scss/functions";
@import "~bootstrap/scss/variables";
@import "~bootstrap/scss/mixins";

.visit-item {
  .icon-name {
    display: flex;
    flex-direction: row;
  }
  .duration-view {
    .recordings-link {
      margin-left: 30px;
    }
  }

  min-height: 50px;
  width: 100%;
  display: flex;
  align-items: center;
  font-size: 14px;
  color: #444;
  .name-time {
    min-width: 120px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    > span:last-child {
      font-size: 90%;
    }
  }
  .duration {
    display: inline-block;
    min-width: 120px;
  }
  .recordings-link {
    text-decoration: underline;
  }

  &.dusk-dawn {
    color: #ccc;
    .name-time {
      > span:first-child {
        font-style: italic;
      }
    }
  }

  > * {
    //outline: 1px solid red;
  }
  > .over-period {
    padding-left: 63px;
  }

  border-left: 6px solid white;
  &.mustelid {
    border-color: red;
  }
  &.bird {
    border-color: #28a745;
  }
  &.rodent,
  &.hedgehog {
    border-color: lighten(coral, 20%);
  }
  &.possum,
  &.cat {
    border-color: #b53326;
  }

  .visit-badge {
    position: relative;
    border-radius: 50%;
    margin-right: 15px;
    .recording-count {
      position: absolute;
      bottom: 0;
      right: 0;
      color: white;
      background: darkred;
      border-radius: 50%;
      min-width: 15px;
      height: 15px;
      display: inline-block;
      line-height: 15px;
      text-align: center;
      font-size: 10px;
      font-weight: bold;
      box-shadow: 0.5px 0.5px 2px #444;
    }
  }
  img {
    display: inline-block;
    padding: 5px;
  }
  &.small-gap,
  &.big-gap {
    background: #fefefe;
  }
  &.small-gap {
    min-height: 3px;
  }
  &.big-gap {
    min-height: 10px;
  }
}

@include media-breakpoint-down(sm) {
  .visit-item {
    .duration-view {
      display: flex;
      flex-direction: column;
      .duration {
        display: inline;
      }
      .recordings-link {
        margin-left: 0;
      }
    }
  }
}
</style>
