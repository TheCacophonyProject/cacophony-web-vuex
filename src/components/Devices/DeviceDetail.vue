<template>
  <b-container>
    <b-tabs
      card
      class="device-tabs"
      nav-class="device-tabs-container container"
      v-model="currentTabIndex"
    >
      <b-tab title="About" lazy>
        <DeviceSoftware :software="software" />
      </b-tab>
      <b-tab title="Users" lazy>
        <template #title>
          <TabTemplate
            title="Users"
            :isLoading="!device"
            :value="device && device.Users ? device.Users.length : 0"
          />
        </template>
        <DeviceUsers
          :device="device"
          :user="user"
          @reload-device="$emit('reload-device')"
        />
      </b-tab>
      <b-tab title="All Events" lazy>
        <DeviceEvents :device="device" />
      </b-tab>
      <b-tab title="Recordings" lazy>
        <template #title>
          <TabTemplate
            title="Recordings"
            :isLoading="recordingsCountLoading"
            :value="recordingsCount"
          />
        </template>
        <RecordingsTab
          :group-name="groupName"
          :device-name="deviceName"
          :recordings-query="recordingQuery()"
        />
      </b-tab>
      <b-tab
        title="Visits"
        lazy
        v-if="!deviceType || deviceType === 'VideoRecorder'"
      >
        <template #title>
          <TabTemplate
            title="Visits"
            :isLoading="visitsCountLoading"
            :value="visitsCount"
          />
        </template>
        <MonitoringTab
          :group-name="groupName"
          :device-name="deviceName"
          :visits-query="staticVisitsQuery"
        />
      </b-tab>
      <!--      <b-tab title="Schedule">-->
      <!--        <template #title>-->
      <!--          <TabTemplate title="Schedule" />-->
      <!--        </template>-->
      <!--        <DeviceSchedule />-->
      <!--      </b-tab>-->
    </b-tabs>
  </b-container>
</template>

<script>
import DeviceUsers from "./DeviceUsers.vue";
import DeviceSoftware from "./DeviceSoftware.vue";
import DeviceEvents from "./DeviceEvents.vue";
import TabTemplate from "@/components/TabTemplate.vue";
import RecordingsTab from "@/components/RecordingsTab.vue";
import MonitoringTab from "@/components/MonitoringTab.vue";
import api from "@/api";
// import DeviceSchedule from "@/components/Devices/DeviceSchedule";

export default {
  name: "DeviceDetail",
  components: {
    // DeviceSchedule,
    RecordingsTab,
    DeviceUsers,
    DeviceSoftware,
    DeviceEvents,
    TabTemplate,
    MonitoringTab,
  },
  props: {
    device: {
      type: Object,
      required: true,
    },
    user: {
      type: Object,
      required: true,
    },
    software: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      tabNames: [
        "about",
        "users",
        "events",
        "recordings",
        "visits",
        "schedule",
      ],
      recordingsCount: 0,
      recordingsCountLoading: false,
      visitsCount: 0,
      visitsCountLoading: false,
      deviceType: null,
    };
  },
  async created() {
    this.deviceType = await api.device.getType(this.device.id);
    const nextTabName = this.tabNames[this.currentTabIndex];
    if (nextTabName !== this.currentTabName) {
      await this.$router.replace({
        name: "device",
        params: {
          groupName: this.groupName,
          deviceName: this.deviceName,
          tabName: nextTabName,
        },
      });
    }
    this.currentTabIndex = this.tabNames.indexOf(this.currentTabName);
    await Promise.all([this.fetchRecordingCount(), this.fetchVisitsCount()]);
  },
  computed: {
    staticVisitsQuery() {
      return this.visitsQuery();
    },
    groupName() {
      return this.$route.params.groupName;
    },
    deviceName() {
      return this.$route.params.deviceName;
    },
    currentTabName() {
      return this.$route.params.tabName;
    },
    currentTabIndex: {
      get() {
        return Math.max(0, this.tabNames.indexOf(this.currentTabName));
      },
      set(tabIndex) {
        const nextTabName = this.tabNames[tabIndex];
        if (nextTabName !== this.currentTabName) {
          this.$router.push({
            name: "device",
            params: {
              groupName: this.groupName,
              deviceName: this.deviceName,
              tabName: nextTabName,
            },
          });
        }
      },
    },
  },
  methods: {
    recordingQuery() {
      return {
        tagMode: "any",
        offset: 0,
        limit: 10,
        days: "all",
        device: [this.device.id],
      };
    },
    visitsQuery() {
      return {
        page: 1,
        perPage: 100,
        days: "all",
        // TODO(jon): This should really be chunked into a per-day type thing.

        device: [this.device.id],
      };
    },
    async fetchRecordingCount() {
      this.recordingsCountLoading = true;
      try {
        const { result } = await api.recording.queryCount(
          this.recordingQuery()
        );
        this.recordingsCount = result.count;
      } catch (e) {
        this.recordingsCountLoading = false;
      }
      this.recordingsCountLoading = false;
    },
    async fetchVisitsCount() {
      this.visitsCountLoading = true;
      try {
        const { result } = await api.monitoring.queryVisitPage({
          page: 1,
          perPage: 1,
          days: "all",
          device: [this.device.id],
        });
        this.visitsCount = result.params.pagesEstimate;
      } catch (e) {
        this.visitsCountLoading = false;
      }
      this.visitsCountLoading = false;
    },
  },
};
</script>
<style lang="scss">
.device-tabs {
  .card-header {
    // Same color as the jumbotron component abutting above the tabs.
    background-color: #f8f9fa;
    .card-header-tabs {
      margin-left: auto;
      margin-right: auto;
    }
  }
}
</style>
