<template>
  <b-container fluid>
    <h1>Animal activity timeline</h1>
    <div class="timeline">
      <div class="scroll-container">
        <canvas ref="heatMap" width="100" height="100"></canvas>
        <ul>
          <li v-for="tag in tagSummary" :key="tag[0]">
            <span>{{ tag[1] }}</span
            >x <span>{{ tag[0] }}</span>
          </li>
        </ul>
      </div>
    </div>
  </b-container>
</template>

<script lang="ts">
/**
 * So a monitoring timeline can be across a single station/device, or it can be across a group.
 */
import api from "@/api/index";
import { NewVisit } from "@/api/Monitoring.api";

const allVisits: NewVisit[] = [];

export default {
  name: "MonitoringTimeline",
  created() {
    if (this.$route.query.perPage) {
      this.perPage = Number(this.$route.query.perPage);
    }
    if (this.$route.query.page) {
      this.currentPage = Number(this.$route.query.page);
    }
  },
  data() {
    return {
      visitsByDevice: {},
      cursor: new Date("2021-05-16T13:29:16.526Z"),
      zoomLevel: 1,
      visitsByTag: {},
    };
  },
  computed: {
    items() {
      return this.visits;
    },
    tagSummary() {
      return Object.entries(this.visitsByTag).sort(
        // eslint-disable-next-line no-unused-vars,@typescript-eslint/no-unused-vars
        ([_a, av]: [string, number], [_b, bv]: [string, number]) => {
          return bv - av;
        }
      );
    },
  },
  methods: {
    drawHeatMap(start, end) {
      //console.log("Draw heatmap", start, end);
      const canvas = this.$refs.heatMap;
      const screenSize = canvas.getBoundingClientRect();
      canvas.width = screenSize.width * devicePixelRatio;
      canvas.height = screenSize.height * devicePixelRatio;
      const context = canvas.getContext("2d");
      const s = start.getTime();
      const e = end.getTime();
      const r = e - s;
      if (context) {
        context.fillStyle = "white";
        const width = context.canvas.width;
        const height = context.canvas.height;
        context.clearRect(0, 0, width, height);
        const paddingY = 1;

        // TODO(jon): Split into different slices for each tag

        // TODO(jon): Draw in daylight hours, moon-rise etc, temperature etc.

        // TODO(jon): Quantize results into buckets, and show histogram style results per night?

        // TODO(jon): Snip out daytime hours from timespan?
        for (const visit of allVisits) {
          const startP = (new Date(visit.timeStart).getTime() - s) / r;
          const endP = (new Date(visit.timeEnd).getTime() - s) / r;
          const startX = startP * width;
          //const w = (endP - startP) * width;
          const w = Math.max(0.5, (endP - startP) * width);
          context.fillRect(startX, paddingY, w, height - paddingY * 2);
        }
        // Draw stuff
      }
    },
    updateVisits(results) {
      const params = results.result.params;
      const visits = results.result.visits;
      for (const visit of visits) {
        if (!this.visitsByTag.hasOwnProperty(visit.classification)) {
          this.$set(this.visitsByTag, visit.classification, 0);
        }
        this.visitsByTag[visit.classification] += 1;
      }
      allVisits.push(...visits);
      this.drawHeatMap(
        new Date(params.searchFrom),
        new Date(params.searchUntil)
      );
    },
  },
  async mounted() {
    const query = {
      tagMode: "any",
      days: "135",
      type: "video",
      device: [1187],
      group: [],
      perPage: 100,
      page: 1,
    };
    const results = await api.monitoring.queryVisitPage(query);
    const params = results.result.params;
    const totalPages = params.pagesEstimate;
    this.updateVisits(results);
    let page = 1;
    while (page < totalPages) {
      const request = api.monitoring.queryVisitPage({
        ...query,
        page: ++page,
      });
      request.then(this.updateVisits);
    }
    //Promise.all(allRequests).then(this.allRequestsLoaded);
    // Maintain a map of deviceId/StationId => visit start and end times.
    // As we request more pages, update it.

    // Handle jumping in at some random offset, and give the ability to infinitely scroll forwards and backwards, and lazy load more visits.

    // Create a heatmap over time of visit intensity

    // Basically we want a cursor in time, and a zoom level.

    // We could also have a mini-map view that lazily loads.

    // Cursor can start with the time of the most recent recording.
  },
};
</script>

<style scoped lang="scss">
canvas {
  background: black;
  width: 100%;
  height: 100px;
  border-radius: 5px;
}
.timeline {
  //position: relative;
  //height: 80vh;
}
.scroll-container {
  //position: absolute;
  //top: 0;
  //bottom: 0;
  //left: 0;
  //right: 0;
}
</style>
