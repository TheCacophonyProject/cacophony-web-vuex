<template>
  <b-container fluid class="admin outer">
    <MapWithPoints
      v-if="station"
      :height="200"
      :radius="60"
      :can-change-base-map="false"
      :is-interactive="false"
      :zoom="false"
      :points="[{ name: station.name, location }]"
    ></MapWithPoints>
    <b-jumbotron class="jumbotron" fluid>
      <div>
        <h1>
          <router-link
            v-if="userIsMemberOfGroup"
            :to="{
              name: 'group',
              params: {
                groupName,
                tabName: 'stations',
              },
            }"
          >
            <font-awesome-icon
              icon="users"
              size="xs"
              style="color: #666; font-size: 16px"
            />
            <span>{{ groupName }}</span>
          </router-link>
          <span v-else>
            <font-awesome-icon
              icon="users"
              size="xs"
              style="color: #666; font-size: 16px"
            />
            <span>{{ groupName }}</span>
          </span>
          <font-awesome-icon
            icon="chevron-right"
            size="xs"
            style="color: #666; font-size: 16px"
          />
          <font-awesome-icon icon="map-marker-alt" size="xs" />
          <span>{{ stationName }}</span> <span v-if="stationIsRetired">(retired)</span>
        </h1>
      </div>
      <div>
        <p class="lead">Manage this station.</p>
      </div>
    </b-jumbotron>
    <div v-if="!loadedStation" class="container no-tabs">
      Loading station...
      <spinner />
    </div>
    <div v-else-if="station" class="tabs-container">
      <b-tabs
        card
        class="group-tabs"
        nav-class="container"
        v-model="currentTabIndex"
      >
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
            :station-name="stationName"
            :recordings-query="recordingsQueryFinal"
          />
        </b-tab>
        <!--        <b-tab lazy>-->
        <!--          <template #title>-->
        <!--            <TabTemplate-->
        <!--              title="Visits"-->
        <!--              :isLoading="visitsCountLoading"-->
        <!--              :value="visitsCount"-->
        <!--            />-->
        <!--          </template>-->
        <!--          <MonitoringTab-->
        <!--            :group-name="groupName"-->
        <!--            :station-name="stationName"-->
        <!--            :visits-query="visitsQuery()"-->
        <!--          />-->
        <!--        </b-tab>-->
      </b-tabs>
    </div>
    <div v-else class="container no-tabs">
      Sorry but group <i> &nbsp; {{ groupName }} &nbsp; </i> does not have a
      station called <i> &nbsp; {{ stationName }}</i
      >.
    </div>
  </b-container>
</template>

<script lang="ts">
import { mapState } from "vuex";
import Spinner from "../components/Spinner.vue";
import api from "../api/index";
import TabTemplate from "@/components/TabTemplate.vue";
import RecordingsTab from "@/components/RecordingsTab.vue";
// import MonitoringTab from "@/components/MonitoringTab.vue";
import { latLng } from "leaflet";
import { isViewingAsOtherUser } from "@/components/NavBar.vue";
import { shouldViewAsSuperUser } from "@/utils";
import MapWithPoints from "@/components/MapWithPoints.vue";

// TODO(jon): Implement visits/monitoring page for stations - this will require API changes.

export default {
  name: "StationView",
  components: {
    MapWithPoints,
    Spinner,
    TabTemplate,
    RecordingsTab,
    // MonitoringTab,
  },
  computed: {
    ...mapState({
      currentUser: (state) => (state as any).User.userData,
    }),
    userIsSuperUserAndViewingAsSuperUser() {
      return (
        this.currentUser.globalPermission === "write" &&
        (isViewingAsOtherUser() || shouldViewAsSuperUser())
      );
    },
    userIsMemberOfGroup() {
      return (
        this.userIsSuperUserAndViewingAsSuperUser ||
        (this.group.GroupUsers &&
          this.group.GroupUsers.find(
            ({ username }) => username === this.currentUser.username
          ) !== undefined)
      );
    },
    stationName() {
      return this.$route.params.stationName;
    },
    groupName() {
      return this.$route.params.groupName;
    },
    currentTabName() {
      return this.$route.params.tabName;
    },
    location() {
      if (this.station) {
        return latLng(
          this.station.location.coordinates[0],
          this.station.location.coordinates[1]
        );
      }
      return null;
    },
    currentTabIndex: {
      get() {
        return Math.max(0, this.tabNames.indexOf(this.currentTabName));
      },
      set(tabIndex) {
        const nextTabName = this.tabNames[tabIndex];
        if (nextTabName !== this.currentTabName) {
          this.$router.push({
            name: "station",
            params: {
              groupName: this.groupName,
              stationName: this.stationName,
              tabName: nextTabName,
            },
          });
        }
      },
    },
  },
  data() {
    return {
      loadedStation: false,
      recordingsCountLoading: false,
      visitsCountLoading: false,
      recordingsCount: 0,
      visitsCount: 0,
      recordingsQueryFinal: {},
      visitsQueryFinal: {},
      station: null,
      stationIsRetired: false,
      group: {},
      tabNames: ["recordings", "visits"],
    };
  },
  mounted() {
    const nextTabName = this.tabNames[this.currentTabIndex];
    if (nextTabName !== this.currentTabName) {
      this.$router.replace({
        name: "station",
        params: {
          groupName: this.groupName,
          stationName: this.stationName,
          tabName: nextTabName,
        },
      });
    }
    this.currentTabIndex = this.tabNames.indexOf(this.currentTabName);
    this.fetchStation();
  },
  methods: {
    async fetchStation() {
      try {
        // eslint-disable-next-line no-unused-vars
        const [group, stations] = await Promise.all([
          api.groups.getGroup(this.groupName),
          api.groups.getStationsForGroup(this.groupName),
        ]);
        this.group = group.result.groups[0];
        const station = stations.result.stations.filter(
          (station) => station.name === this.stationName
        );
        if (station.length > 1) {
          const nonRetired = station.find((item) => item.retiredAt === null);
          if (nonRetired) {
            this.station = nonRetired;
          } else {
            const sortedByLatestRetired = station.sort(
              (a, b) =>
                new Date(a.retiredAt).getTime() -
                new Date(b.retiredAt).getTime()
            );
            this.station = sortedByLatestRetired.pop();
            this.stationIsRetired = true;
          }
        } else if (station.length === 1) {
          this.station = station[0];
        }
        this.recordingsQueryFinal = {
          tagMode: "any",
          offset: 0,
          limit: 20,
          days: "all",
          station: [this.station.id],
        };
        this.recordingsCountLoading = true;
        {
          const { result } = await api.recording.queryCount(
            this.recordingsQueryFinal
          );
          this.recordingsCount = result.count;
        }
        this.recordingsCountLoading = false;

        // this.visitsCountLoading = true;
        // {
        //   const { result } = await api.monitoring.queryVisitPage(
        //     this.recordingsQueryFinal
        //   );
        //   this.visitsCount = result.visits.length;
        // }
        // this.visitsCountLoading = false;
      } catch (e) {
        // TODO - we will move away from global error handling, and show any errors locally in the component
      }
      this.loadedStation = true;
    },
    visitsQuery() {
      return {
        page: 1,
        perPage: 100,
        days: "all",
        // TODO(jon): This should really be chunked into a per-day type thing.

        stationId: [this.station.id],
      };
    },
  },
};
</script>
<style lang="scss">
.admin .jumbotron {
  margin-bottom: unset;
}
.admin.outer {
  position: relative;
  .jumbotron {
    top: 0;
    position: absolute;
    width: 100%;
    background: transparent;
    z-index: 1000;
    h1,
    p.lead {
      padding: 3px;
      background: white;
      display: inline-block;
    }
  }
  .tabs-container {
    position: relative;
    z-index: 1001;
    margin-top: -53px;
    .group-tabs .card-header {
      background: unset;
    }
    .nav-item {
      border-top-left-radius: 3px;
      border-top-right-radius: 3px;
      background: transparentize(whitesmoke, 0.15);
    }
  }
}
</style>
