<template>
  <div class="container visits-container">
    <h2>
      All visits
      <help>
        All visits ever recorded for this
        {{ `${deviceName ? "device" : stationName ? "station" : "group"}` }}
      </help>
    </h2>
    <VisitsList
      :query-pending="loading"
      :visits="visits"
      :all-loaded="allLoaded"
      :view-visits-query="visitsQuery"
      @load-more="() => requestVisitsUntilBeginningOfEarliestDay()"
    />
    <div v-if="!loading && visits.length === 0">
      No visits found for this
      {{ `${deviceName ? "device" : stationName ? "station" : "group"}` }}
    </div>
  </div>
</template>

<script lang="ts">
import Help from "@/components/Help.vue";
import api from "@/api";
import VisitsList from "@/components/VisitsList.vue";
import { startOfEvening } from "@/helpers/datetime";
import SunCalc from "suncalc";
const LOAD_PER_PAGE_CARDS = 10;

// TODO(jon): A histogram of activity by hour of the night.  Total visits, and by species.

const extraVisits = [];
const currentVisits = [];

interface DateSortable {
  sortDate: Date;
}

const addSupplementaryEvents = (
  visits: DateSortable[],
  devicePowerEvents: DateSortable[],
  location?: [number, number]
): DateSortable[] => {
  // Get the days for visits, work out the days covered:
  const daysCovered = new Set();
  for (const visit of visits) {
    const start = startOfEvening(visit.sortDate);
    daysCovered.add(start.toISOString());
    start.setDate(start.getDate() + 1);
    daysCovered.add(start.toISOString());
  }
  const latestVisitDay = startOfEvening(visits[0].sortDate);
  latestVisitDay.setDate(latestVisitDay.getDate() + 1);
  const earliestVisitDay = startOfEvening(visits[visits.length - 1].sortDate);
  // console.log(
  //   "Earliest visit day",
  //   earliestVisitDay.toLocaleDateString(),
  //   earliestVisitDay
  // );
  // console.log(
  //   "Latest visit day",
  //   latestVisitDay.toLocaleDateString(),
  //   latestVisitDay
  // );
  for (const powerEvent of devicePowerEvents) {
    const eventDay = startOfEvening(powerEvent.sortDate);
    if (eventDay > earliestVisitDay) {
      const eventDate = eventDay.toISOString();
      if (!daysCovered.has(eventDate)) {
        // No visits during this day, but the device was powered on, so add a dummy event.
        visits.push(powerEvent);
        // console.log("Adding power event for", eventDay.toLocaleDateString());
        daysCovered.add(eventDate);
      }
    }
  }
  // console.log(
  //   Array.from(daysCovered.keys())
  //     .map((i) => new Date(i).getTime())
  //     .sort()
  //     .map((d) => new Date(d).toLocaleDateString())
  //     .reverse()
  // );

  // FIXME(jon): We should still push "no activity" events for days where we don't have a device location?
  //  If I only get this done today, that will be fine.

  if (location !== undefined) {
    // Add sunrise and set events for each day that has visits
    const now = new Date();
    //now.setHours(17);
    //debugger;
    const thisAfternoon = startOfEvening(now);
    //thisAfternoon.setDate(thisAfternoon.getDate() + 1);
    if (now > thisAfternoon) {
      thisAfternoon.setDate(thisAfternoon.getDate() + 1);
    }

    const duskDawn = [];
    for (const day of daysCovered.keys()) {
      const dayDate = new Date(day as string);
      if (
        dayDate >= earliestVisitDay &&
        //dayDate <= latestVisitDay &&
        dayDate < thisAfternoon
      ) {
        const times = SunCalc.getTimes(dayDate, location[0], location[1]);
        duskDawn.push({
          sortDate: times.sunsetStart,
          timeStart: times.sunsetStart,
          timeEnd: times.sunset,
          classification: "Sunset",
        } as DateSortable);
      }
      const nextDayDate = new Date(day as string);
      nextDayDate.setDate(nextDayDate.getDate() + 1);
      if (
        nextDayDate > earliestVisitDay &&
        //nextDayDate <= latestVisitDay &&
        nextDayDate <= thisAfternoon
      ) {
        const times = SunCalc.getTimes(nextDayDate, location[0], location[1]);
        duskDawn.push({
          sortDate: times.sunrise,
          timeStart: times.sunrise,
          timeEnd: times.sunriseEnd,
          classification: "Sunrise",
        } as DateSortable);
      }
    }
    // for (const d of duskDawn) {
    //   daysCovered.add(startOfEvening(d.sortDate).toISOString());
    // }
    // console.log(
    //   Array.from(daysCovered.keys())
    //     .map((i) => new Date(i).getTime())
    //     .sort()
    //     .map((d) => new Date(d).toLocaleDateString())
    //     .reverse()
    // );
    visits.push(...duskDawn);
  }

  return visits;
};

const getPowerEventsAndLocationForDevice = async (
  device: number,
  isFirstPage: boolean
): Promise<{
  devicePowerEvents: DateSortable[];
  location: [number, number] | undefined;
}> => {
  const devicePowerEvents = [];
  let location;
  if (currentVisits.length && device) {
    let nextDay = new Date(currentVisits[0].timeEnd);

    // If it's the first page, go up till now
    if (isFirstPage) {
      nextDay = new Date();
    }
    nextDay.setDate(nextDay.getDate() + 1);

    const endOfCurrentDay = startOfEvening(nextDay);
    const beginningOfDayOfEarliestDay = startOfEvening(
      new Date(currentVisits[currentVisits.length - 1].timeStart)
    );

    const eventParams = {
      type: ["daytime-power-off", "rpi-power-on", "powered-off"],
      endTime: endOfCurrentDay.toISOString(),
      startTime: beginningOfDayOfEarliestDay.toISOString(),
    };
    const [latestRecording, powerEvents] = await Promise.all([
      // Calculate dusk/dawn, moonrise/set events for range.
      api.recording.latestForDevice(device),
      api.device.getLatestEvents(device, eventParams),
    ]);
    devicePowerEvents.push(
      ...powerEvents.result.rows.map((row) => ({
        ...row,
        sortDate: new Date(row.dateTime),
        timeStart: row.dateTime,
        timeEnd: row.dateTime,
      }))
    );
    location = latestRecording.result.rows[0].location?.coordinates;
  }
  return {
    devicePowerEvents,
    location,
  };
};

export default {
  name: "MonitoringTab",
  components: {
    VisitsList,
    Help,
  },
  props: {
    groupName: { type: String, required: true },
    deviceName: { type: String, required: false, default: null },
    stationName: { type: String, required: false, default: null },
    visitsQuery: { type: Object, required: true },
  },
  data() {
    return {
      visits: [],
      totalVisitsCount: null,
      totalVisitsPages: null,
      loading: true,
      allLoaded: false,
      currentPage: 1,
      startDateOfQuery: Date,
    };
  },
  async mounted() {
    while (extraVisits.length) {
      extraVisits.pop();
    }
    while (currentVisits.length) {
      currentVisits.pop();
    }
    await this.fetchVisits();
  },
  methods: {
    async requestVisitsUntilBeginningOfEarliestDay() {
      if (
        this.totalVisitsPages === null ||
        this.currentPage < this.totalVisitsPages
      ) {
        try {
          this.loading = true;
          if (!currentVisits.length) {
            const { result } = await api.monitoring.queryVisitPage({
              ...this.visitsQuery,
              page: this.currentPage,
            });

            if (!this.totalVisitsCount) {
              this.totalVisitsPages = result.params.pagesEstimate;
              this.totalVisitsCount =
                result.params.pagesEstimate * LOAD_PER_PAGE_CARDS;
            }

            this.currentPage += 1;
            // Visits ordered newest to oldest.
            currentVisits.push(...result.visits);
          } else if (extraVisits.length) {
            while (currentVisits.length) {
              currentVisits.pop();
            }
            while (extraVisits.length) {
              currentVisits.push(extraVisits.shift());
            }
          }
          // eslint-disable-next-line no-console
          console.assert(
            this.visitsQuery.device.length === 1,
            "Should only have one device"
          );
          const { location, devicePowerEvents } =
            await getPowerEventsAndLocationForDevice(
              this.visitsQuery.device[0],
              this.currentPage === 2
            );
          const oldestVisit = currentVisits[currentVisits.length - 1];
          const oldestVisitDay = startOfEvening(
            new Date(oldestVisit.timeStart)
          );
          // Now request again until we get a day that is less than oldestVisitDay.  Split the remaining array into before and after.
          while (
            extraVisits.length === 0 &&
            this.currentPage <= this.totalVisitsPages
          ) {
            const { result } = await api.monitoring.queryVisitPage({
              ...this.visitsQuery,
              page: this.currentPage,
            });
            this.currentPage += 1;
            const v = result.visits;
            while (
              v.length &&
              startOfEvening(new Date(v[0].timeStart)) >= oldestVisitDay
            ) {
              //console.log("Grabbing additional visits", v[0]);
              currentVisits.push(v.shift());
            }
            //console.log("Breaking at", v[0]);

            if (this.currentPage >= this.totalVisitsPages) {
              // On the last page, so use all the extraVisits now.
              while (v.length) {
                //console.log("Grabbing additional visits", v[0]);
                currentVisits.push(v.shift());
              }
            } else {
              // Otherwise, save them for the next loaded page.
              extraVisits.push(...v);
            }
          }
          const supplementaryEvents = addSupplementaryEvents(
            currentVisits.map((visit) => ({
              ...visit,
              sortDate: new Date(visit.timeStart),
            })),
            devicePowerEvents,
            location
          )
            .sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime())
            .map((o) => Object.freeze(o));
          this.visits.push(...supplementaryEvents);
          this.loading = false;
          // Now merge these in with day
        } catch (e) {
          return;
        }
      } else {
        // At end of search
        this.allLoaded = true;
      }
    },
    async fetchVisits() {
      if (
        (this.visitsQuery.group &&
          this.visitsQuery.group.length &&
          this.visitsQuery.group[0] !== null) ||
        (this.visitsQuery.device &&
          this.visitsQuery.device.length &&
          this.visitsQuery.device[0] !== null) ||
        (this.visitsQuery.station &&
          this.visitsQuery.station.length &&
          this.visitsQuery.station[0] !== null)
      ) {
        await this.requestVisitsUntilBeginningOfEarliestDay();
      }
    },
  },
  watch: {
    visitsQuery() {
      // TODO(jon): Make sure we allow inactive devices to show recordings.
      this.fetchVisits();
    },
  },
  beforeDestroy() {
    while (extraVisits.length) {
      extraVisits.pop();
    }
    while (currentVisits.length) {
      currentVisits.pop();
    }
  },
};
</script>

<style lang="scss">
@import "~bootstrap/scss/functions";
@import "~bootstrap/scss/variables";
@import "~bootstrap/scss/mixins";

@include media-breakpoint-down(sm) {
  .container.visits-container {
    padding: 0;
  }
}
</style>
