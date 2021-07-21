<template>
  <b-container fluid class="admin">
    <b-jumbotron class="group-jumbotron" fluid>
      <div>
        <b-link class="back-link" :to="{ name: 'groups' }">
          <font-awesome-icon icon="angle-left" size="xs" />
          <span>Back to groups</span>
        </b-link>
      </div>
      <h1>
        <font-awesome-icon icon="users" size="xs" />
        <span>{{ groupName }}</span>
      </h1>
      <p class="lead">
        Manage the users associated with this group and view the devices
        associated with it.
      </p>
    </b-jumbotron>
    <b-tabs
      card
      class="group-tabs"
      nav-class="container"
      v-model="currentTabIndex"
    >
      <b-tab lazy v-if="!limitedView">
        <template #title>
          <TabTemplate
            title="Users"
            :isLoading="usersLoading"
            :value="users.length"
          />
        </template>
        <UsersTab
          :users="users"
          :is-group-admin="isGroupAdmin"
          :loading="usersLoading"
          :group-name="groupName"
          @user-added="() => fetchUsers()"
          @user-removed="(userName) => removedUser(userName)"
        />
      </b-tab>
      <!--      <b-tab>-->
      <!--        <template #title>-->
      <!--          <TabTemplate-->
      <!--            title="Visits"-->
      <!--            :isLoading="visitsCountLoading"-->
      <!--            :value="visitsCount"-->
      <!--          />-->
      <!--        </template>-->
      <!--        <MonitoringTab-->
      <!--          :loading="visitsCountLoading"-->
      <!--          :group-name="groupName"-->
      <!--          :visits-query="visitsQueryFinal"-->
      <!--        />-->
      <!--      </b-tab>-->
      <b-tab title="Devices" lazy>
        <template #title>
          <TabTemplate
            title="Devices"
            :isLoading="devicesLoading"
            :value="devices.length"
            :has-warnings="anyDevicesAreUnhealthy"
          />
        </template>
        <DevicesTab
          :devices="devices"
          :loading="devicesLoading"
          :group-name="groupName"
        />
      </b-tab>
      <b-tab lazy v-if="!limitedView">
        <template #title>
          <TabTemplate
            title="Stations"
            :isLoading="stationsLoading"
            :value="nonRetiredStationsCount"
          />
        </template>
        <StationsTab
          :items="stations"
          :loading="stationsLoading"
          :group-name="groupName"
          :is-group-admin="isGroupAdmin"
          @change="() => fetchStations()"
        />
      </b-tab>
      <b-tab lazy>
        <template #title>
          <TabTemplate
            title="Recordings"
            :isLoading="recordingsCountLoading"
            :value="recordingsCount"
          />
        </template>
        <RecordingsTab
          :loading="recordingsCountLoading"
          :group-name="groupName"
          :recordings-query="recordingQueryFinal"
        />
      </b-tab>
    </b-tabs>
  </b-container>
</template>

<script lang="ts">
import { mapState } from "vuex";
import api from "@/api";
import StationsTab from "@/components/Groups/StationsTab.vue";
import UsersTab from "@/components/Groups/UsersTab.vue";
import DevicesTab from "@/components/Groups/DevicesTab.vue";
import TabTemplate from "@/components/TabTemplate.vue";
import RecordingsTab from "@/components/RecordingsTab.vue";
//import MonitoringTab from "@/components/MonitoringTab.vue";

export default {
  name: "GroupView",
  components: {
    RecordingsTab,
    UsersTab,
    StationsTab,
    DevicesTab,
    TabTemplate,
    //MonitoringTab,
  },
  data() {
    return {
      stationsLoading: false,
      usersLoading: false, // Loading all users on page load
      devicesLoading: false, // Loading all users on page load
      recordingsCountLoading: false,
      visitsCountLoading: false,
      recordingsCount: 0,
      visitsCount: 0,
      groupId: null,
      recordingQueryFinal: {},
      visitsQueryFinal: {},
      users: [],
      devices: [],
      stations: [],
      visits: [],
      limitedView: false,
    };
  },
  computed: {
    ...mapState({
      currentUser: (state) => (state as any).User.userData,
    }),
    groupName() {
      return this.$route.params.groupName;
    },
    isGroupAdmin() {
      return (
        (this.currentUser && this.currentUser.isSuperUser) ||
        this.users.some(
          (user) =>
            user.userName === this.currentUser.username && user.isGroupAdmin
        )
      );
    },
    tabNames() {
      if (!this.limitedView) {
        return ["users", "devices", "stations", "recordings"];
      } else {
        return ["limited-devices", "limited-recordings"];
      }
    },
    nonRetiredStationsCount(): number {
      return (
        this.stations &&
        this.stations.filter((station) => station.retiredAt === null).length
      );
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
            name: "group",
            params: {
              groupName: this.groupName,
              tabName: nextTabName,
            },
          });
        }
      },
    },
    anyDevicesAreUnhealthy() {
      return this.devices.some(
        (device) =>
          device.type === "VideoRecorder" && device.isHealthy === false
      );
    },
  },
  async created() {
    if (
      this.$route.params.tabName === "limited-devices" ||
      this.$route.params.tabName === "limited-recordings"
    ) {
      this.limitedView = true;
    }
    const nextTabName = this.tabNames[this.currentTabIndex];
    if (nextTabName !== this.currentTabName) {
      await this.$router.replace({
        name: "group",
        params: {
          groupName: this.groupName,
          tabName: nextTabName,
        },
      });
    }
    this.currentTabIndex = this.tabNames.indexOf(this.currentTabName);
    if (!this.limitedView) {
      await Promise.all([
        this.fetchUsers(),
        this.fetchStations(),
        this.fetchVisitsCount(),
        this.fetchDevices(),
        this.fetchRecordingCount(),
      ]);
    } else {
      await this.fetchDevices();
      await this.fetchRecordingCount();
    }
  },
  methods: {
    recordingQuery() {
      return {
        tagMode: "any",
        offset: 0,
        limit: 20,
        page: 1,
        days: "all",
        group: [this.groupId],
      };
    },
    visitsQuery() {
      return {
        tagMode: "any",
        days: "all",
        type: "video",
        device: [],
        group: [this.groupId],
        perPage: 10,
        page: 1,
      };
    },
    async fetchUsers() {
      this.usersLoading = true;
      if (!this.limitedView) {
        try {
          const { result, status } = await api.groups.getUsersForGroup(
            this.groupName
          );
          if (status === 403) {
            this.limitedView = true;
          } else {
            this.users = result.users;
          }
        } catch (e) {
          // ...
        }
      }
      this.usersLoading = false;
    },
    async fetchRecordingCount() {
      this.recordingsCountLoading = true;
      if (!this.limitedView) {
        try {
          const { result } = await api.groups.getGroup(this.groupName);
          if (result.groups.length !== 0) {
            this.groupId = result.groups[0].id;
            this.recordingQueryFinal = this.recordingQuery();
            {
              const { result } = await api.recording.queryCount(
                this.recordingQuery()
              );
              if (result.count !== 0) {
                this.recordingsCount = result.count;
              }
            }
          } else {
            this.limitedView = true;
            await this.fetchRecordingCount();
          }
        } catch (e) {
          this.recordingsCountLoading = false;
        }
      } else {
        try {
          await this.fetchDevices();
          this.recordingQueryFinal = this.recordingQuery();
          this.$delete(this.recordingQueryFinal, "group");

          this.$set(
            this.recordingQueryFinal,
            "device",
            this.devices.map((device) => device.id)
          );
          {
            const { result } = await api.recording.query({
              ...this.recordingQueryFinal,
              limit: 1,
            });
            if (result.count !== 0) {
              this.recordingsCount = result.count;
            }
          }
        } catch (e) {
          this.recordingsCountLoading = false;
        }
      }

      this.recordingsCountLoading = false;
    },
    async fetchVisitsCount() {
      this.visitsCountLoading = true;
      try {
        const { result } = await api.groups.getGroup(this.groupName);
        if (result.groups.length !== 0) {
          this.groupId = result.groups[0].id;
          this.visitsQueryFinal = this.visitsQuery();
          {
            const { result } = await api.monitoring.queryVisitPage({
              ...this.visitsQuery(),
              days: "all",
              perPage: 1,
              page: 1,
            });
            this.visitsCount = `${result.params.pagesEstimate}`;
          }
        }
      } catch (e) {
        this.visitsCountLoading = false;
      }
      this.visitsCountLoading = false;
    },

    async fetchDevices() {
      this.devicesLoading = true;
      {
        if (!this.limitedView) {
          try {
            const { result, status } = await api.groups.getDevicesForGroup(
              this.groupName
            );
            if (status === 200) {
              this.devices = result.devices.map((device) => ({
                ...device,
                isHealthy: true,
                type: null,
              }));
            } else {
              this.limitedView = true;
              await this.fetchDevices();
            }
          } catch (e) {
            // ...
          }
        } else {
          const { result } = await api.device.getDevices();
          const myDevices = result.devices.rows.filter((device) => {
            return (
              device.Users.length !== 0 &&
              device.Users.find((user) => user.id === this.currentUser.id) !==
                undefined
            );
          });
          for (const device of myDevices) {
            const rec = await api.recording.latestForDevice(device.id);
            if (
              rec.result.count &&
              rec.result.rows[0].Group.groupname === this.groupName
            ) {
              device.inGroup = true;
            }
          }
          this.devices = myDevices
            .filter((device) => device.inGroup)
            .map((device) => ({
              ...device,
              deviceName: device.devicename,
              isHealthy: true,
              type: null,
            }));
        }

        const last24Hours = new Date(
          new Date().getTime() - 60 * 1000 * 60 * 24
        ).toISOString();

        // Get device health.
        //This is secondary info, so fine to lazy load
        for (const device of this.devices) {
          api.device
            .getLatestEvents(device.id, {
              limit: 1,
              type: "daytime-power-off",
              startTime: last24Hours,
            })
            .then(({ result }) => {
              device.isHealthy = result.rows.length !== 0;
            })
            // eslint-disable-next-line no-unused-vars,@typescript-eslint/no-unused-vars
            .catch((_) => {});

          api.device
            .getType(device.id)
            .then((type) => {
              device.type = type;
            })
            // eslint-disable-next-line no-unused-vars,@typescript-eslint/no-unused-vars
            .catch((_) => {});
        }
      }
      this.devicesLoading = false;
    },
    async fetchStations() {
      this.stationsLoading = true;
      {
        try {
          const { result, status } = await api.groups.getStationsForGroup(
            this.groupName
          );
          if (status === 200) {
            this.stations = result.stations;
          } else {
            this.limitedView = true;
          }
        } catch (e) {
          // ...
        }
      }
      this.stationsLoading = false;
    },
    removedUser(userName: string) {
      this.users = this.users.filter((user) => user.userName !== userName);
    },
  },
};
</script>

<style lang="scss">
.admin .group-jumbotron {
  margin-bottom: unset;
}
.group-tabs {
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
