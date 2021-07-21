<template>
  <b-container fluid>
    <b-row>
      <div
        :class="[
          'search-filter-wrapper',
          { 'is-collapsed': searchPanelIsCollapsed },
        ]"
      >
        <QueryRecordings
          ref="queryRec"
          :disabled="queryPending"
          :onlyRecordingType="'video'"
          :is-collapsed="searchPanelIsCollapsed"
          :simple-only="true"
          @mounted="querysMounted"
          @submit="submitNewQuery"
          @description="saveNextQueryDescription"
          @toggled-search-panel="
            searchPanelIsCollapsed = !searchPanelIsCollapsed
          "
        />
      </div>
      <div :class="['search-content-wrapper']">
        <b-alert
          v-model="showInfo"
          variant="info"
          dismissible
          @dismissed="infoDismissed"
        >
          <p>{{ infoMessage }}</p>
          <table>
            <tr>
              <td>Unidentifiable</td>
              <td>Humanly confirmed as unidentifiable (Unknown)</td>
            </tr>
            <tr>
              <td>Unidentified</td>
              <td>
                AI is sure there is an animal but doesn't know what it is
                (Unidentified)
              </td>
            </tr>
            <tr>
              <td>Probably not an Animal</td>
              <td>AI is not sure if this is an animal or not (No Tags)</td>
            </tr>
            <tr>
              <td>Conflicting Tags</td>
              <td>Human tags differ in tagged animal</td>
            </tr>
          </table>
        </b-alert>

        <div class="search-results">
          <div class="results-summary">
            <div style="display: flex">
              <h1 style="flex-grow: 100">Visits</h1>
              <div style="align-self: flex-end">
                <b-button variant="link" @click="showInfo = true">
                  <font-awesome-icon icon="question-circle" size="sm" />
                  Help</b-button
                >
              </div>
            </div>
            <h5 v-if="queryPending">Loading...</h5>
            <h5 v-else-if="noQueryYet">
              This query takes a long time to run. Please select your group and
              then press search.
            </h5>
            <h2 v-else>
              {{ countMessage }}
            </h2>
            <div
              v-if="!queryPending && !noQueryYet && visits.length > 0"
              class="results"
            >
              <h1>
                <span v-if="canLoadMore">(Incomplete)</span> Visit Summary Per
                Device
              </h1>
              <div class="scrollable">
                <div v-for="devMap in deviceSummary" :key="devMap.id">
                  <div v-if="Object.entries(devMap).length > 0">
                    <b-row>
                      <b-col>
                        <h2>
                          {{ Object.values(devMap)[0].deviceName }}
                        </h2>
                      </b-col>
                    </b-row>
                    <b-table
                      class="device-table"
                      :items="Object.entries(devMap)"
                      :fields="fields"
                      striped
                    >
                      <template v-slot:cell(what)="row">
                        <span v-b-tooltip.hover="whatToolTip(row.item[0])">{{
                          summaryWhat(row.item[0])
                        }}</span>
                      </template>
                      <template v-slot:cell(start)="row">
                        {{ formatDate(row.item[1].start, tableDateTimeFormat) }}
                      </template>
                      <template v-slot:cell(end)="row">
                        {{ formatDate(row.item[1].end, tableDateTimeFormat) }}
                      </template>
                      <template v-slot:cell(visits)="row">
                        {{ row.item[1].visitCount }}
                      </template>
                    </b-table>
                  </div>
                </div>
              </div>
              <div v-if="visits.length > 0" class="scrollable">
                <div
                  v-for="(dayVisits, index_a) in visitsByDayAndHour"
                  :key="index_a"
                >
                  <h4 class="recordings-day">
                    <div class="event-recording">
                      <span v-if="dayVisits.audioBaitDay">
                        <font-awesome-icon icon="volume-up" size="xs" />
                      </span>
                      {{ dayVisits.relativeDay() }}
                    </div>
                  </h4>
                  <div
                    v-for="(hourVisits, index_b) in dayVisits.visitsByHour"
                    :key="index_b"
                  >
                    <h5 class="recordings-hour">{{ hourVisits.getHour() }}</h5>
                    <b-table
                      class="visits-table"
                      :items="hourVisits.visits"
                      :fields="visitFields"
                      @row-clicked="expandAdditionalInfo"
                      striped
                    >
                      <template v-slot:cell(what)="row">
                        <span class="audio-bait" v-if="row.item.audioBaitVisit">
                          <font-awesome-icon icon="volume-up" size="xs" />
                        </span>
                        <div class="what-cell">
                          <img
                            onerror="this.src='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=='"
                            :src="imgSrc(row.item.what)"
                            class="tag-img"
                          />
                          <span class="what-text">
                            {{ visitWhat(row.item.what) }}
                          </span>
                        </div>
                      </template>
                      <template v-slot:cell(device)="row">
                        <div class="device-cell">
                          {{ row.item.deviceName }}
                        </div>
                      </template>
                      <template v-slot:cell(date)="deviceVisits">
                        {{
                          formatDate(
                            deviceVisits.item.events[
                              deviceVisits.item.events.length - 1
                            ].start,
                            tableDateFormat
                          )
                        }}
                      </template>

                      <template v-slot:cell(start)="row">
                        {{
                          formatDate(
                            row.item.events[row.item.events.length - 1].start,
                            tableTimeFormat
                          )
                        }}
                      </template>
                      <template v-slot:cell(end)="row">
                        {{
                          formatDate(row.item.events[0].end, tableTimeFormat)
                        }}
                      </template>
                      <template v-slot:cell(events)="row">
                        {{ row.item.events.length }}
                      </template>
                      <template v-slot:row-details="row">
                        <div
                          v-for="(visitEvents, index_e) in sortEventsByRec(
                            row.item
                          )"
                          :key="index_e"
                          class="rec-events"
                        >
                          <div class="event-recording">
                            <font-awesome-icon
                              :icon="['far', 'file-video']"
                              size="xs"
                            />
                            {{
                              formatDate(
                                visitEvents.recStart,
                                tableDateTimeFormat
                              )
                            }}
                          </div>
                          <b-container>
                            <div
                              v-for="(item, index) in visitEvents.events"
                              :key="index"
                            >
                              <AudioSummary
                                v-if="isAudioBait(item)"
                                :item="item"
                              />
                              <EventSummary
                                v-else
                                :item="item"
                                :trackNumber="
                                  visitEvents.tracks - item.trackNumber
                                "
                                :key="index"
                                :deviceId="row.item.deviceId"
                              />
                            </div>
                          </b-container>
                        </div>
                      </template>
                    </b-table>
                  </div>
                </div>
              </div>
              <div class="load-more">
                <div v-if="loadingMore">Loading...</div>
                <div v-else>
                  <b-button v-if="canLoadMore" @click="loadMoreVisits()">
                    <span v-if="loadingMore"> Loading... </span>
                    <span v-else>
                      {{ loadText }}
                    </span>
                  </b-button>
                </div>
              </div>
            </div>
            <div v-else class="results loading">
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
          <div
            v-if="!queryPending && !noQueryYet && visits.length == 0"
            class="no-results"
          >
            <h6 class="text-muted">No recordings found</h6>
            <p class="small text-muted">Try modifying your search criteria.</p>
          </div>
        </div>
      </div>
    </b-row>
  </b-container>
</template>
<script lang="ts">
import * as moment from "moment";
import { Visit, DayVisits } from "../api/visits";
import DefaultLabels, { imgSrc } from "../const";
import EventSummary from "../components/EventSummary.vue";
import AudioSummary from "../components/AudioBaitSummary.vue";
import QueryRecordings from "../components/QueryRecordings/QueryRecordings.vue";
import api from "../api/index";
import { RecordingQuery, VisitsQueryResult } from "../api/Recording.api";
export default {
  name: "VisitsView",
  components: { QueryRecordings, EventSummary, AudioSummary },
  data() {
    return {
      queryParams: {},
      showInfo: this.isInfoShown(),
      infoMessage: `A "visit" is multiple thermal video tracks that have been combined because they are likely to be due to the appearance of a single animal. Each visit can be expanded by clicking on it to show the tracks which it is made up from.`,
      unknownHelp: `Humanly confirmed as unidentifiable`,
      nothingHelp: `AI is not sure if this is an animal or not`,
      unidentifiedHelp: `AI is sure there is an animal but doesn't know what it is`,
      tableDateTimeFormat: "L LTS",
      tableDateFormat: "DD MMM",
      tableTimeFormat: "LTS",
      currentQueryDescription: null,
      nextQueryDescription: null,
      eventMaxTimeSeconds: 60 * 10,
      searchPanelIsCollapsed: true,
      queryPending: false,
      deviceSummary: {},
      visits: [],
      loadingMore: false,
      fields: [
        { key: "what", label: "Animal" },
        { key: "start", label: "First Visit" },
        { key: "end", label: "Last Visit" },
        { key: "visits", label: "Visits" },
      ],
      visitFields: [
        {
          key: "what",
          label: "",
        },
        { key: "device", label: "Device" },
        { key: "date", label: "Date" },
        { key: "start", label: "Visit Start" },
        { key: "end", label: "End" },
        { key: "events", label: "#" },
      ],
      visitEventFields: [
        { key: "recording", label: "Recording" },
        { key: "track", label: "Track" },
        { key: "start", label: "Event Start" },
        { key: "confidence", label: "Confidence" },
        { key: "unidentified", label: "Assumed" },
      ],
      offset: 0,
      loadText: "Load More Visits",
      canLoadMore: true,
      visitLimit: 300,
      noQueryYet: true,
    };
  },
  computed: {
    countMessage() {
      if (this.visits.length > 0) {
        let visit_s;
        if (this.visits.length > 1) {
          visit_s = "visits";
        } else {
          visit_s = "visit";
        }
        const end = this.canLoadMore
          ? "found so far.  (There are more within search period)"
          : "found";
        return `${this.visits.length} ${visit_s} ${end}`;
      } else {
        return "No Visits";
      }
    },
    visitsByDayAndHour() {
      const visitsByDay = [];
      let currentDay = null;

      for (const item of this.visits) {
        if (!currentDay || !currentDay.isSameDay(item)) {
          currentDay = new DayVisits(item);
          visitsByDay.push(currentDay);
        } else {
          currentDay.addVisit(item);
        }
      }
      return visitsByDay;
    },
  },
  methods: {
    imgSrc,
    visitWhat(what: string): string {
      return this.capitalizeFirst(what);
    },
    whatToolTip(what: string): string {
      if (what == "null") {
        return this.nothingHelp;
      } else if (what == DefaultLabels.unidentifiedLabel.value) {
        return this.unidentifiedHelp;
      } else if (what == DefaultLabels.unknownLabel.value) {
        return this.unknownHelp;
      }
      return `Track has been tagged as ${what}`;
    },
    summaryWhat(what: string): string {
      if (what == "null") {
        return "Probably not an Animal";
      } else if (what == DefaultLabels.unidentifiedLabel.value) {
        return "( Unidentified ) Animal";
      }
      return this.capitalizeFirst(what);
    },
    capitalizeFirst(value: string) {
      if (value) {
        return value.charAt(0).toUpperCase() + value.substring(1);
      } else {
        return "Probably Nothing";
      }
    },
    formatDate(date: string, formatStr: string): string {
      return moment(date).format(formatStr);
    },
    isInfoShown() {
      return localStorage.getItem("visitInfo") != "0";
    },
    infoDismissed() {
      localStorage.setItem("visitInfo", "0");
    },
    isAudioBait(event: any) {
      return event.hasOwnProperty("DeviceId");
    },
    // sorts in descending order visit events (audio bait and tracks) grouped by recordings
    sortEventsByRec(visit: Visit) {
      const eventsByRec = [];
      let recEvent;
      let recID;

      var audioBaitEvents = visit.audioBaitEvents.slice();
      audioBaitEvents.sort(function (a, b) {
        return moment(a.dateTime) > moment(b.dateTime) ? 1 : -1;
      });
      let audioevent = audioBaitEvents.pop();
      let audioTime;
      if (audioevent) {
        audioTime = moment(audioevent.dateTime);
      }
      let audioBaitBefore = false;
      let trackNum = 0;
      for (const item of visit.events) {
        audioBaitBefore = audioTime && audioTime.isAfter(moment(item.start));
        // new recording
        if (!recID || item.recID != recID) {
          recID = item.recID;
          recEvent = { recStart: item.recStart, tracks: 0, events: [] };
          eventsByRec.push(recEvent);
          trackNum = 0;
        }

        // add all audio bait events before this recording
        while (audioBaitBefore) {
          recEvent.events.push(audioevent);
          audioevent = audioBaitEvents.pop();
          audioTime = null;
          if (audioevent) {
            audioTime = moment(audioevent.dateTime);
          }
          audioBaitBefore = audioTime && audioTime.isAfter(moment(item.start));
        }
        item.trackNumber = trackNum;
        recEvent.events.push(item);
        recEvent.tracks += 1;
        trackNum += 1;
      }

      // add remaining events
      if (audioevent) {
        audioBaitEvents.push(audioevent);
      }
      recEvent.events.splice(recEvent.events.length, 0, ...audioBaitEvents);
      return eventsByRec;
    },
    expandAdditionalInfo(row) {
      this.$set(row, "_showDetails", !row._showDetails);
    },
    setQuery(query: RecordingQuery) {
      this.$router
        .push({
          path: "visits",
          query,
        })
        .catch(() => {});
    },
    querysMounted(query: RecordingQuery) {
      this.setQuery(query);
      if (query && query.device && query.device.length !== 0) {
        this.searchPanelIsCollapsed = true;
        this.submitNewQuery(query);
      }
    },
    submitNewQuery(whereQuery: RecordingQuery) {
      this.setQuery(whereQuery);
      this.getVisits(whereQuery, true);
    },
    saveNextQueryDescription(description) {
      this.nextQueryDescription = description;
    },
    loadMoreVisits() {
      this.loadingMore = true;
      const query: RecordingQuery = this.queryParams;
      query.offset = this.offset;
      this.getVisits(query, false);
      this.loadingMore = false;
    },
    getVisits: async function (whereQuery: RecordingQuery, newQuery: boolean) {
      // Extract query information
      this.noQueryYet = false;
      if (newQuery) {
        this.offset = 0;
        this.queryPending = true;
      }

      whereQuery.limit = this.visitLimit;
      const { result, success } = await api.recording.queryVisits(whereQuery);
      this.currentQueryDescription = this.nextQueryDescription;
      if (!success) {
        result.messages &&
          result.messages.forEach((message) => {
            this.$store.dispatch("Messaging/WARN", message);
          });
        return;
      }
      this.currentQueryDescription = this.nextQueryDescription;
      if (newQuery) {
        this.visits = [];
        this.deviceSummary = {};
        this.offset = 0;
        this.canLoadMore = true;
        this.queryPending = false;
      }
      this.processVisits(result);
    },
    processVisits(result: VisitsQueryResult) {
      if (result.numRecordings == 0) {
        this.canLoadMore = false;
        return;
      }
      this.offset = result.queryOffset;
      this.canLoadMore = result.hasMoreVisits;

      const summary = result.summary;
      const filtered = result.visits.filter(
        (visit: Visit): boolean =>
          visit.events.length > 0 &&
          visit.what != DefaultLabels.birdLabel.value &&
          visit.what != DefaultLabels.falsePositiveLabel.value
      );

      this.visits.push(...filtered);
      for (const devId of Object.keys(summary)) {
        const newSummary = summary[devId];
        if (newSummary.hasOwnProperty(DefaultLabels.birdLabel.value)) {
          delete newSummary[DefaultLabels.birdLabel.value];
        }
        if (newSummary.hasOwnProperty(DefaultLabels.falsePositiveLabel.value)) {
          delete newSummary[DefaultLabels.falsePositiveLabel.value];
        }
        // filter out bird and false positive
        if (!(devId in this.deviceSummary)) {
          this.deviceSummary[devId] = newSummary;
          continue;
        }
        const existingSummary = this.deviceSummary[devId];
        for (const [animal, animalSummary] of Object.entries(newSummary)) {
          if (animal in existingSummary) {
            // merge
            const existingAnimalSummary = existingSummary[animal];
            existingAnimalSummary.visitCount += animalSummary.visitCount;
            existingAnimalSummary.eventCount += animalSummary.eventCount;
            if (animalSummary.start < existingAnimalSummary.start) {
              existingAnimalSummary.start = animalSummary.start;
            }
            if (animalSummary.end > existingAnimalSummary.end) {
              existingAnimalSummary.end = animalSummary.end;
            }
          } else {
            existingSummary[animal] = animalSummary;
          }
        }
      }

      this.visits = this.visits.sort(function (a, b) {
        if (a.start == b.start) {
          return a.id - b.id;
        }
        return a.start < b.start ? 1 : -1;
      });
    },
  },
};
</script>

<style lang="scss">
.b-table-details {
  background-color: white !important;
  cursor: default;
}

.visits-table > tbody > tr td:first-child {
  position: relative;
}

.visits-table > tbody > tr td:first-child {
  position: relative;
}

.visits-table table > tbody > tr:not(.b-table-details) {
  cursor: pointer;
  height: 48px;
}
</style>

<style scoped lang="scss">
@import "~bootstrap/scss/functions";
@import "~bootstrap/scss/variables";
@import "~bootstrap/scss/mixins";

$main-content-width: 640px;

.device-cell {
  width: 151px;
  height: 28px;
  overflow-x: hidden;
  overflow-y: hidden;
}

@include media-breakpoint-down(sm) {
  .scrollable {
    max-width: calc(100vw - 3em);
    overflow: auto;
  }

  .device-table {
    min-width: 640px;
  }

  .visits-table {
    min-width: 640px;
  }
}

.search-content-wrapper {
  margin: 0 auto;
  flex-basis: $main-content-width;
  padding: 0 1em;
  h1 {
    margin: 2rem 0 1.2rem;
  }
  h2 {
    font-size: 1.2rem;
    margin-bottom: 0.8rem;
    color: $gray-700;
  }

  .search-results {
    max-width: $main-content-width;
    margin: 0 auto;
  }

  .rec-events {
    margin-top: 2px;
    margin-bottom: 2px;
  }

  .recordings-hour {
    position: sticky;
    font-size: 0.9em;
    font-weight: 600;
  }

  .recordings-day {
    position: sticky;
    top: 0;
    background: transparentize($white, 0.15);
    padding: 0.5rem 0;
    font-size: 1em;
    font-weight: 600;
  }

  @include media-breakpoint-down(sm) {
    .recordings-hour {
      padding: 0.7rem 0;
      float: left;
    }
  }

  @include media-breakpoint-up(sm) {
    .recordings-hour {
      display: inline-block;
      position: sticky;
      float: left;
      top: 40px;
      margin-left: -60px;
      margin-top: 15px;
    }
  }

  .event-recording {
    padding: 0.5rem 0;
    font-size: 1em;
    font-weight: 600;
  }
}

.no-results {
  display: flex;
  flex-flow: column nowrap;
  margin-top: 20vh;
  text-align: center;
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

.what-cell {
  display: flex;
  margin-left: 0.4rem;
}
.tag-img {
  width: 30px;
  max-width: 30px;
  max-height: 30px;
  background: transparent;
  margin-right: 0.2rem;
}

.audio-bait {
  position: absolute;
  top: 0px;
  left: 4px;
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
.display-toggle {
  margin-right: 5px;
}

.load-more {
  margin-bottom: 0;
  text-align: center;
  justify-content: center;
}
</style>
