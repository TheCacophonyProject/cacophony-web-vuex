<template>
  <div class="container" v-if="!loading">
    <h2>
      Devices
      <help>
        Devices specify which group they belong to when they first register.
        They can't be edited here.
      </help>
    </h2>
    <div>
      <p v-if="groupHasDevices">
        Devices associated with <strong>{{ groupName }}</strong
        >:
      </p>
      <p v-else class="description-and-button-wrapper">
        There are currently no devices associated with&nbsp;<strong>{{
          groupName
        }}</strong
        >.
      </p>
    </div>
    <b-table
      v-if="groupHasDevices"
      :items="tableItems"
      :fields="[
        {
          key: 'deviceName',
          label: 'Device Name',
          sortable: true,
        },
        {
          key: 'deviceHealth',
          label: 'Device Health',
          sortable: true,
          formatter: sortBool,
          sortByFormatted: true,
        },
        {
          key: 'type',
          label: 'Device Type',
          sortable: true,
        },
      ]"
      sort-by="deviceName"
      hover
      outlined
      responsive
      data-cy="devices-table"
    >
      <template v-slot:cell(deviceName)="row">
        <b-link
          :to="{
            name: 'device',
            params: {
              deviceName: row.item.deviceName,
              groupName,
              tabName:
                row.item.type === 'VideoRecorder' ? 'visits' : 'recordings',
            },
          }"
        >
          {{ row.item.deviceName }}
        </b-link>
      </template>
      <template v-slot:cell(type)="row">
        <span>
          <b-spinner
            v-if="!row.item.type"
            class="spinner"
            type="border"
            small
          />
          <font-awesome-icon
            v-if="row.item.type === 'VideoRecorder'"
            icon="video"
            class="icon"
          />
          <font-awesome-icon
            v-else-if="row.item.type === 'AudioRecorder'"
            icon="music"
            class="icon"
          />
          <font-awesome-icon
            v-else-if="row.item.type === 'UnknownDeviceType'"
            icon="question"
            class="icon"
          />
        </span>
      </template>
      <template v-slot:cell(deviceHealth)="row">
        <span
          :class="[{ healthy: row.item.isHealthy }, 'device-health']"
          v-if="row.item.type === 'VideoRecorder'"
        >
          <font-awesome-icon
            v-if="row.item.isHealthy"
            icon="heart"
            class="icon"
          />
          <font-awesome-icon v-else icon="heart-broken" class="icon" />
        </span>
        <b-spinner v-if="!row.item.type" type="border" small />
        <font-awesome-icon
          v-else-if="row.item.type !== 'VideoRecorder'"
          icon="question"
          class="icon"
        />
      </template>
    </b-table>
    <div class="bottom-buttons">
      <b-modal v-model="isExportingCSV" title="Export Visits CSV" hide-footer>
        <div v-if="!exportInProgress">
          <label for="export-from-date">Export from</label>
          <b-form-datepicker
            id="export-from-date"
            v-model="exportFrom"
            :max="new Date()"
            class="mb-2"
          ></b-form-datepicker>
          <label for="export-to-date">Until</label>
          <b-form-datepicker
            id="export-to-date"
            :min="minDate"
            :max="new Date()"
            v-model="exportTo"
            class="mb-2"
          ></b-form-datepicker>
          <b-btn
            :disabled="exportTo === null || exportFrom === null"
            @click="exportCSV"
          >
            Export
          </b-btn>
        </div>
        <div v-else>
          <b-progress :value="exportProgress * 100" :max="100" />
        </div>
      </b-modal>
      <b-button
        v-if="groupHasDevices"
        class="export-visits"
        @click="exportVisits"
      >
        <font-awesome-icon icon="download" class="fa-1x" />
        <span>Export TrapNZ Visits for devices</span>
      </b-button>
    </div>
  </div>
</template>

<script lang="ts">
import Help from "@/components/Help.vue";
import { getTrapNzSpecies } from "@/const";
import api from "@/api";
import { toNZDateString, startOfDay, startOfEvening } from "@/helpers/datetime";

const formatDate = (value) => {
  const date = new Date(value);
  return `${toNZDateString(date)} ${date.toTimeString().substring(0, 8)}`;
};

export default {
  name: "DevicesTab",
  components: {
    Help,
  },
  props: {
    isGroupAdmin: { type: Boolean, default: false },
    devices: { type: Array, required: true },
    loading: { type: Boolean, default: false },
    groupName: { type: String, required: true },
  },
  data() {
    return {
      isExportingCSV: false,
      exportFrom: null,
      exportTo: null,
      exportInProgress: false,
      exportProgress: 0,
    };
  },
  methods: {
    async exportCSV() {
      this.exportInProgress = true;
      this.exportProgress = 0;

      // Call API and process results
      const exportTo = new Date(this.exportTo);
      exportTo.setHours(12);
      const to = startOfEvening(exportTo);
      const exportFrom = new Date(this.exportFrom);
      exportFrom.setHours(12);
      const from = startOfEvening(exportFrom);
      const results = await api.monitoring.getAllVisits(
        {
          device: this.devices.map(({ id }) => id),
          from: from.toISOString(),
          to: to.toISOString(),
        },
        undefined,
        (val) => (this.exportProgress = val)
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
      this.createExport(
        header + csvVisits,
        `visits-${
          this.groupName
        }-${from.toLocaleDateString()}-${to.toLocaleDateString()}.csv`
      );
      this.isExportingCSV = false;
      this.exportInProgress = false;
      this.exportProgress = 0;
    },
    createExport(csvFormattedString: string, fileName: string) {
      const blob = new Blob([csvFormattedString], {
        type: "text/csv;charset=utf-8;",
      });
      const link = document.createElement("a");
      if (link.download !== undefined) {
        // feature detection
        // Browsers that support HTML5 download attribute
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", fileName);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    },
    sortBool(_v, _k, i) {
      return `${i.type}_${i.isHealthy}`;
    },
    exportVisits() {
      this.isExportingCSV = true;
      return;
    },
  },
  computed: {
    minDate(): Date {
      const oneDayAfterFrom = startOfDay(new Date(this.exportFrom));
      oneDayAfterFrom.setDate(oneDayAfterFrom.getDate() + 1);
      return this.exportFrom && oneDayAfterFrom;
    },
    groupHasDevices() {
      return this.devices.length !== 0;
    },
    tableItems() {
      return this.devices.map((device) => ({
        ...device,
        _rowVariant:
          device.type === "VideoRecorder"
            ? device.isHealthy
              ? "okay"
              : "warn"
            : "empty",
      }));
    },
  },
};
</script>

<style lang="scss">
@import "~bootstrap/scss/functions";
@import "~bootstrap/scss/variables";
@import "~bootstrap/scss/mixins";

.device-health {
  color: #dc3545;
  &.healthy {
    color: #555;
  }
}
.table-okay {
  border-left: 10px solid #cff1d7;
}
.table-warn {
  border-left: 10px solid #eecccf;
}
.table-empty {
  border-left: 10px solid #ddd;
}
.spinner {
  color: #ccc;
}

@include media-breakpoint-up(md) {
  .bottom-buttons {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  }
}
@include media-breakpoint-down(sm) {
  .bottom-buttons {
    display: flex;
    flex-direction: column;
    > * {
      margin-bottom: 10px;
    }
  }
}
</style>
