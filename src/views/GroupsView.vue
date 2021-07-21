<template>
  <b-container fluid class="admin">
    <b-jumbotron class="jumbotron" fluid>
      <h1>Your groups</h1>
      <p class="lead">
        Groups link together devices with the users who can view their
        recordings. Click on a group to see its devices and users.
      </p>
    </b-jumbotron>
    <b-container class="groups-container">
      <b-row v-if="isLoading">
        <spinner />
      </b-row>
      <b-row v-else>
        <b-col class="col-md-6 col-12">
          <group-add />
          <div class="add-button-wrapper">
            <b-button
              v-b-modal.group-add
              variant="primary"
              v-b-tooltip.hover
              title="Add a new group"
              class="add-button"
            >
              <font-awesome-icon icon="plus" size="xs" />
              <span>Create group</span>
            </b-button>
          </div>
          <div v-if="hasGroups" class="group-list-wrapper">
            <b-checkbox class="filter-option" v-model="showGroupsWithNoDevices"
              >Include groups with no devices</b-checkbox
            >
            <b-list-group data-cy="groups-list">
              <b-list-group-item
                :class="[
                  'list-group-item',
                  'list-group-item-action',
                  { 'no-devices': deviceCount === 0 },
                ]"
                :key="groupName"
                :to="
                  deviceOnly
                    ? {
                        name: 'group',
                        params: {
                          groupName,
                          tabName: 'limited-devices',
                        },
                      }
                    : {
                        name: 'group',
                        params: { groupName, tabName: 'devices' },
                      }
                "
                v-for="{
                  groupName,
                  deviceCount,
                  userCount,
                  deviceOnly,
                } in filteredGroups"
              >
                <span>
                  <strong>{{ groupName }}</strong> -
                  <span v-if="deviceCount !== false"
                    >{{ deviceCount || "No" }} device<span
                      v-if="deviceCount !== 1"
                      >s</span
                    >
                    <span v-if="!deviceOnly"
                      >with {{ userCount || "No" }} user<span
                        v-if="userCount !== 1"
                        >s</span
                      ></span
                    >
                  </span>
                  <b-spinner v-else-if="!deviceOnly" type="border" small />
                </span>
                <font-awesome-icon
                  class="icon"
                  icon="chevron-right"
                  size="xs"
                />
              </b-list-group-item>
            </b-list-group>
          </div>
          <div v-else class="col-12 col-lg-8">
            <b-card class="no-content-placeholder">
              <h5>You don't belong to any groups yet</h5>
              <p>
                If you are setting up a device, create a group. All the devices
                you manage will be linked together through this group, so choose
                a name relating to your organisation, project or property.
              </p>
            </b-card>
          </div>
        </b-col>
        <b-col class="col-md-6 col-12">
          <MapWithPoints
            v-if="!locationsLoading"
            :points="groupsByLocation"
            :height="500"
            :navigate-to-point="
              (point) => ({
                name: 'group',
                params: { groupName: point.name, tabName: 'devices' },
              })
            "
          />
          <div class="map-loading" v-else>
            <b-spinner small />
            <div>&nbsp;Loading group locations</div>
          </div>
        </b-col>
      </b-row>
    </b-container>
  </b-container>
</template>

<script lang="ts">
import api from "@/api";
import Spinner from "@/components/Spinner.vue";
import GroupAdd from "@/components/Groups/GroupAdd.vue";

import { LatLng, latLng, latLngBounds } from "leaflet";
import MapWithPoints from "@/components/MapWithPoints.vue";
import { mapState } from "vuex";

interface GroupsForLocation {
  location: LatLng;
  name: string;
}

interface GroupsViewData {
  groups: any[];
  isLoading: boolean;
  locationsLoading: boolean;
  showGroupsWithNoDevices: boolean;
  locations: Record<string, GroupsForLocation>;
  requestController: AbortController;
}

const NZ_BOUNDS = latLngBounds([
  latLng(-33.6233075, 176.6248297),
  latLng(-47.5254414, 164.9880683),
]);

const isInNZ = (location: LatLng): boolean => {
  return NZ_BOUNDS.contains(location);
};

export default {
  name: "GroupsView",
  components: {
    MapWithPoints,
    Spinner,
    GroupAdd,
  },
  data(): GroupsViewData {
    return {
      groups: [],
      isLoading: false,
      showGroupsWithNoDevices: false,
      locationsLoading: false,
      locations: {},
      requestController: null,
    };
  },
  computed: {
    ...mapState({
      currentUser: (state) => (state as any).User.userData,
    }),
    hasGroups(): boolean {
      return this.groups.length !== 0;
    },
    groupsByLocation(): GroupsForLocation[] {
      return Object.values(this.locations);
    },
    filteredGroups(): any[] {
      if (this.showGroupsWithNoDevices) {
        return this.groups;
      }
      return this.groups.filter(
        (group) =>
          group.initialDeviceCount !== 0 &&
          (group.deviceCount === false || group.deviceCount !== 0)
      );
    },
  },
  created: function () {
    this.fetchGroups();
  },
  methods: {
    async fetchGroups() {
      this.isLoading = true;
      this.locationsLoading = true;
      {
        // TODO(jon): Error handling.
        const groups = {};
        try {
          const { result } = await api.device.getDevices();
          const myDevices = result.devices.rows.filter((device) => {
            return (
              device.Users.length !== 0 &&
              device.Users.find((user) => user.id === this.currentUser.id) !==
                undefined
            );
          });
          // FIXME(jon): Quick hack for the issue that we can't currently get the group for a deviceId via the api.
          //  get the latest recording for a device, and that contains it.  Will fail if device has no recordings.
          for (const device of myDevices) {
            const rec = await api.recording.latestForDevice(device.id);
            const entry = rec.result.rows[0];
            groups[entry.GroupId] = groups[entry.GroupId] || {
              Devices: [],
              groupName: entry.Group.groupname,
              userCount: 1,
              initialDeviceCount: 0,
              deviceCount: 0,
              deviceOnly: true,
            };
            groups[entry.GroupId].Devices.push(device);
            groups[entry.GroupId].initialDeviceCount =
              groups[entry.GroupId].Devices.length;
            groups[entry.GroupId].deviceCount =
              groups[entry.GroupId].Devices.length;
            // Now we should be able to show the groups for those devices.
          }
        } catch (e) {
          // ....
        }
        try {
          const { result } = await api.groups.getGroups();
          // Groups are always ordered alphabetically.
          // TODO(jon): Maybe also show groups that have devices with issues here?
          const tempGroups = result.groups.map(
            ({ groupname, GroupUsers, Devices }) => ({
              groupName: groupname,
              deviceCount: Devices.length === 0 ? 0 : false,
              initialDeviceCount: Devices.length,
              userCount: GroupUsers.length,
            })
          );

          // Add in any groups that came from devices we're attached to, but that we're not directly members of.
          for (const group of Object.values(groups)) {
            if (
              !tempGroups.find(
                (tempGroup) => tempGroup.groupName === group.groupName
              )
            ) {
              tempGroups.push(group);
            }
          }

          this.groups = tempGroups.sort((a, b) =>
            a.groupName.localeCompare(b.groupName)
          );

          const devicesForGroupsPromises = [];
          const locations = {};
          for (const group of this.groups) {
            if (group.initialDeviceCount !== 0 && !group.deviceOnly) {
              devicesForGroupsPromises.push(
                new Promise((resolve) => {
                  api.groups
                    // FIXME: We only need to do this because getGroups returns both active and inactive devices right now.
                    .getDevicesForGroup(group.groupName)
                    .then(async ({ result }) => {
                      group.deviceCount = result.devices.length;
                      const latestRecordingForDevicesPromises = [];
                      const device = result.devices.pop();
                      // TODO(jon): Would be useful to be able to get the latest recording for each of a list of devices in a single request?
                      device &&
                        latestRecordingForDevicesPromises.push(
                          api.recording.latestForDevice(device.id)
                        );

                      const latestRecordingForFirstDeviceInGroup =
                        await Promise.all(latestRecordingForDevicesPromises);
                      resolve(latestRecordingForFirstDeviceInGroup);
                    })
                    // eslint-disable-next-line no-unused-vars,@typescript-eslint/no-unused-vars
                    .catch((_) => {});
                })
              );
            }
          }
          Promise.all(devicesForGroupsPromises)
            .then((devicesForGroups) => {
              for (const results of devicesForGroups) {
                for (const recordings of results) {
                  if (
                    recordings.result.count !== 0 &&
                    recordings.result.rows[0].location
                  ) {
                    const rec = recordings.result.rows[0];
                    const location = latLng(
                      rec.location.coordinates[0],
                      rec.location.coordinates[1]
                    );
                    if (isInNZ(location)) {
                      if (!locations.hasOwnProperty(location.toString())) {
                        locations[location.toString()] = {
                          location,
                          group: "",
                        };
                      }
                      const loc = locations[location.toString()];
                      loc.name = rec.Group.groupname;
                    }
                  }
                }
              }
              this.locations = locations;
              this.locationsLoading = false;
            })
            .catch(() => {});
        } catch (error) {
          // Do something with the error.
        }
      }
      this.isLoading = false;
    },
  },
};
</script>
<style lang="scss" scoped>
.groups-container {
  padding-top: 20px;
}
.group-list-wrapper {
  overflow-y: auto;
  border-top: 1px solid rgb(248, 249, 250);
  border-bottom: 1px solid rgb(248, 249, 250);
  max-height: calc(100vh - 350px);
  margin-bottom: 10px;
}
@media only screen and (max-width: 576px) {
  .groups-map {
    display: none;
  }
}

.list-group-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-direction: row;
  &.no-devices {
    //background: #eee;
    opacity: 0.5;
  }
}
.map-loading {
  background: #eee;
  height: 500px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #444;
}
.filter-option {
  margin: 10px;
}
</style>
