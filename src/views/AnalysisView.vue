<template>
  <b-container>
    <ScaleChoice v-if="!fetching" v-model="logarithmic" />
    <div class="chart-container">
      <Spinner :fetching="fetching" />
      <BarChart
        v-if="!fetching"
        :title="title"
        :data="data"
        :log="logarithmic"
        :message="introMessage"
        x-axis-label="Device Name"
        y-axis-label="Number of Recordings"
        @click.ctrl="gotoVisitsSearchPage($event, true)"
        @click="gotoVisitsSearchPage($event)"
      />
    </div>
    <b-row>
      <b-col>
        <DateRange v-model="dateRange" :vertical="vertical" />
      </b-col>
      <b-col>
        <RecordingType v-model="recordingType" :vertical="vertical" />
      </b-col>
      <b-col>
        <DeviceGroups v-model="showGroups" :all-groups="allGroups" />
      </b-col>
    </b-row>
    <div v-if="!fetching && unused.length > 0" class="mt-2">
      Devices with no recordings for the selected time period:
      <ul>
        <li v-for="(name, index) in unused" :key="index">
          {{ name }}
        </li>
      </ul>
    </div></b-container
  >
</template>

<script lang="ts">
import Spinner from "../components/Spinner.vue";
import api, { RecordingQuery } from "../api/Recording.api";
import DateRange from "../components/Analysis/DateRange.vue";
import RecordingType from "../components/Analysis/RecordingType.vue";
import DeviceGroups from "../components/Analysis/DeviceGroups.vue";
import ScaleChoice from "../components/Analysis/ScaleChoice.vue";
import BarChart from "../components/Chart/BarChart.vue";

export default {
  name: "AnalysisView",
  components: {
    BarChart,
    Spinner,
    DateRange,
    RecordingType,
    DeviceGroups,
    ScaleChoice,
  },
  props: {},
  data() {
    return {
      lastHue: -60,
      deviceCount: {},
      title: "",
      data: {},
      fetching: false,
      unused: [],
      width: window.innerWidth,
      showGroups: "all",
      logarithmic: false,
      introMessage: "",
    };
  },
  computed: {
    recordingType: {
      get() {
        return this.$store.state.User.recordingTypePref;
      },
      set(value) {
        this.$store.commit("User/updateRecordingTypePref", value);
      },
    },
    dateRange: {
      get() {
        return this.$store.state.User.analysisDatePref;
      },
      set(value) {
        this.$store.commit("User/updateAnalysisDatePref", value);
      },
    },
    devices: function () {
      let devices;
      if (this.showGroups === "all") {
        devices = this.$store.state.Devices.devices;
      } else {
        for (const group of this.allGroups) {
          if (group.id === this.showGroups) {
            devices = group.devices;
          }
        }
      }
      return devices.map((device) => {
        return {
          id: device.id,
          name: device.devicename,
        };
      });
    },
    allGroups: function () {
      return this.$store.state.Groups.groups.map((group) => {
        return {
          id: group.id,
          name: group.groupname,
          devices: group.Devices,
        };
      });
    },
    vertical: function () {
      // Change button orientation to vertical on small screen sizes
      return this.width < 576;
    },
  },
  watch: {
    dateRange: function () {
      this.getData();
    },
    recordingType: function () {
      this.getData();
    },
    showGroups: function () {
      this.getData();
    },
    logarithmic: function () {
      // Trigger a re-draw of the graph without fetching data again
      this.fetching = true;
      this.$nextTick(() => {
        this.fetching = false;
      });
    },
  },
  created: async function () {
    try {
      await this.$store.dispatch("Devices/GET_DEVICES");
      await this.$store.dispatch("Groups/GET_GROUPS");
      await this.getData();
      // eslint-disable-next-line no-empty
    } catch (e) {}
    window.addEventListener("resize", () => {
      this.width = window.innerWidth;
    });
  },
  methods: {
    getData: async function () {
      // Gets data to pass into chart js:
      this.fetching = true;
      this.introMessage = null;

      try {
        const limit = 1000;
        const searchParams: RecordingQuery = {
          type: this.recordingType,
          days: this.dateRange,
          limit: limit,
        };

        if (this.showGroups !== "all") {
          searchParams.group = [this.showGroups];
        }

        // Get all data (first 1000 rows)
        let { result: allData } = await api.query(searchParams);
        // Check whether all data was fetched
        // if not, run again with increased limit to get all rows
        if (allData.count > limit) {
          searchParams.limit = allData.count;
          ({ result: allData } = await api.query(searchParams));
        }
        // Count the number of recordings for each device
        this.devices.map((device) => (this.deviceCount[device.id] = 0));
        for (const row of allData.rows) {
          this.deviceCount[row.DeviceId] += 1;
        }
        // Create data and label variables
        const labels = [];
        const data = [];
        this.unused = [];
        for (const device of this.devices) {
          if (this.deviceCount[device.id] > 0) {
            data.push({
              id: device.id,
              count: this.deviceCount[device.id],
              devicename: device.name,
            });
            labels.push(device.name);
          } else {
            this.unused.push(device.name);
          }
        }

        // Create colors for bar graphs
        const colorPicker = () => {
          let hue;
          if (this.lastHue < 360) {
            hue = this.lastHue + 60;
            this.lastHue = hue;
          } else {
            hue = this.lastHue - 339;
            this.lastHue = hue;
          }
          const hsl = `hsl(${hue}, 80%, 80%)`;
          return hsl;
        };
        this.lastHue = -60; // reset starting hue
        const colors = data.map(() => colorPicker());
        // Create dataset suitable for ChartJS
        this.data = {
          labels: labels,
          datasets: [
            {
              data: data.map((item) => item.count),
              backgroundColor: colors,
              borderColor: colors,
              borderWidth: 1,
            },
          ],
        };
        const title = "Device Activity";
        if (this.dateRange === 0) {
          this.title = `${title} (All time)`;
        } else if (this.dateRange === 1) {
          this.title = `${title} (Last 24 Hours)`;
        } else {
          this.title = `${title} (Last ${this.dateRange} days)`;
        }
        // eslint-disable-next-line no-empty
      } catch (e) {}
      this.fetching = false;
    },
    padLeft(str, char, len) {
      while (str.toString().length < len) {
        str = `${char}${str}`;
      }
      return str;
    },
    gotoVisitsSearchPage(
      chartItems: string[],
      openInNewWindow: boolean = false
    ) {
      const deviceName = chartItems[0];
      const device = this.devices.find((device) => {
        return device.name === deviceName;
      });

      const searchParams: RecordingQuery = {
        type: this.recordingType,
        days: this.dateRange,
        device: [device.id],
      };

      if (!openInNewWindow) {
        this.$router.push({
          path: "visits",
          query: searchParams,
        });
      } else {
        // TODO Open in new window?
      }
    },
  },
};
</script>
<style scoped lang="scss">
.chart-container {
  height: 60vh;
  width: 100%;
}
</style>
