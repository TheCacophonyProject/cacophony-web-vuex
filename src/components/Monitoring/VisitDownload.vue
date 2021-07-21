<template>
  <b-button
    type="submit"
    variant="secondary"
    class="btn-sm"
    @click="click"
    data-cy="export"
  >
    <font-awesome-icon icon="download" class="fa-1x" />
    Export
  </b-button>
</template>

<script lang="ts">
import api from "@/api/index";
import { toNZDateString } from "@/helpers/datetime";
import { getTrapNzSpecies } from "@/const";
import { NewVisitQuery } from "@/api/Monitoring.api";

export default {
  name: "VisitDownload",
  props: {
    params: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      queryPending: false,
    };
  },
  methods: {
    async click() {
      this.queryPending = true;
      // Call API and process results
      const results = await api.monitoring.getAllVisits(
        this.params as unknown as NewVisitQuery
      );
      const rows = results.filteredVisits.map((visit) => [
        visit.stationId ? visit.station : visit.device,
        formatDate(visit.timeStart),
        formatDate(visit.timeEnd),
        visit.classification,
        visit.classificationAi,
        visit.classFromUserTag,
        getTrapNzSpecies(visit.classification),
        "cacophony",
        `${visit.classFromUserTag ? "User tagged: " : "AI tagged: "} ${
          visit.classification
        }`,
      ]);
      const header =
        "station,start_date,end_date,class,ai_class,is_ai_tagged,species,recorded_by,notes\n";
      const csvVisits = rows.map((e) => e.join(",")).join("\n");
      this.createExport(header + csvVisits);
    },
    createExport(csvFormattedString) {
      const blob = new Blob([csvFormattedString], {
        type: "text/csv;charset=utf-8;",
      });
      const link = document.createElement("a");
      if (link.download !== undefined) {
        // feature detection
        // Browsers that support HTML5 download attribute
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "visits.csv");
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    },
  },
};

function formatDate(value) {
  const date = new Date(value);
  return `${toNZDateString(date)} ${date.toTimeString().substring(0, 8)}`;
}
</script>
