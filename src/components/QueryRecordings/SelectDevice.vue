<template>
  <b-form-group>
    <label>Device, group, and station</label>
    <multiselect
      :value="selectedValues"
      :options="options"
      :multiple="true"
      :placeholder="placeholder"
      :loading="fetching"
      track-by="uid"
      label="name"
      @input="updateSelected"
      @open="maybeInitialiseValues"
      data-cy="device-select"
    >
      <template slot="tag" slot-scope="{ option, remove }">
        <span class="multiselect__tag">
          <font-awesome-icon
            v-if="option.type === 'group'"
            icon="users"
            size="xs"
          />
          <font-awesome-icon
            v-else-if="option.type === 'device'"
            icon="microchip"
            size="xs"
          />
          <font-awesome-icon
            v-else-if="option.type === 'station'"
            icon="map-marker-alt"
            size="xs"
          />
          <span class="tag">{{ option.name }}</span>
          <span v-if="option.type === 'group'" class="tag">
            ({{ option.devices.length }} device<span
              v-if="option.devices.length > 1"
              >s</span
            >)
          </span>

          <i
            aria-hidden="true"
            tabindex="1"
            class="multiselect__tag-icon"
            @click="(_) => remove(option)"
            @keypress.enter.space="remove(option)"
          ></i>
        </span>
      </template>
      <template slot="option" slot-scope="{ option: { type, name } }">
        <span>
          <font-awesome-icon v-if="type === 'group'" icon="users" size="xs" />
          <font-awesome-icon
            v-else-if="type === 'device'"
            icon="microchip"
            size="xs"
          />
          <font-awesome-icon
            v-else-if="type === 'station'"
            icon="map-marker-alt"
            size="xs"
          />
          <span class="option">{{ name }}</span>
        </span>
      </template>
    </multiselect>
  </b-form-group>
</template>

<script>
import api from "@/api";

export default {
  name: "SelectDevice",
  props: {
    selectedDevices: {
      type: Array,
      required: true,
    },
    selectedGroups: {
      type: Array,
      required: true,
    },
    selectedStations: {
      type: Array,
      default: () => [],
    },
  },
  data() {
    return {
      fetching: false,
      devices: {},
      groups: {},
      stations: {},
    };
  },
  computed: {
    placeholder: function () {
      if (this.fetching) {
        return "loading";
      } else if (
        this.selectedDevices.length === 0 ||
        this.selectedGroups.length === 0 ||
        this.selectedStations.length === 0
      ) {
        return "all";
      } else {
        return "add more devices";
      }
    },
    selectedValues() {
      const selectedDs = this.selectedDevices
        .map((deviceId) => this.devices[deviceId])
        .filter((item) => item !== undefined);
      const selectedGs = this.selectedGroups
        .map((groupId) => this.groups[groupId])
        .filter((item) => item !== undefined);
      const selectedSs = this.selectedStations
        .map((stationId) => this.stations[stationId])
        .filter((item) => item !== undefined);
      return [...selectedDs, ...selectedGs, ...selectedSs];
    },
    options() {
      return [
        ...Object.values(this.devices),
        ...Object.values(this.groups),
        ...Object.values(this.stations),
      ].sort((a, b) => a.name.localeCompare(b.name));
    },
  },
  methods: {
    updateSelected(selectedObjects) {
      const updatedSelection = {
        devices: selectedObjects
          .filter(({ type }) => type === "device")
          .map(({ id }) => id),
        groups: selectedObjects
          .filter(({ type }) => type === "group")
          .map(({ id }) => id),
        stations: selectedObjects
          .filter(({ type }) => type === "station")
          .map(({ id }) => id),
      };
      // this causes the v-model in the parent component to get updated
      this.$emit("update-device-selection", updatedSelection);
    },
    async maybeInitialiseValues() {
      if (!this.options.length) {
        await this.loadValues();
      }
    },
    async loadValues() {
      this.fetching = true;
      try {
        const [
          {
            result: {
              devices: { rows: devices },
            },
          },
          {
            result: { groups },
          },
        ] = await Promise.all([
          api.device.getDevices(),
          api.groups.getGroups(),
        ]);
        this.devices = Object.freeze(
          devices
            .map(({ id, devicename }) => ({
              id: Number(id),
              type: "device",
              name: devicename,
              uid: `device_${id}`,
            }))
            .reduce((acc, curr) => ((acc[curr.id] = curr), acc), {})
        );
        this.groups = Object.freeze(
          groups
            .map(({ id, groupname, Devices }) => ({
              id: Number(id),
              type: "group",
              name: groupname,
              devices: Devices,
              uid: `group_${id}`,
            }))
            // NOTE: Filter out empty groups
            .filter(({ devices }) => devices.length !== 0)
            .reduce((acc, curr) => ((acc[curr.id] = curr), acc), {})
        );

        // TODO(jon): Add stations for each group: in practice this shouldn't be too many for most people.
        const stationPromises = [];
        // TODO(jon): This should probably become a general api.stations.getStations() type thing.
        for (const group of Object.values(this.groups)) {
          stationPromises.push(api.groups.getStationsForGroup(group.id));
        }
        const stations = await Promise.all(stationPromises);
        this.stations = Object.freeze(
          stations.reduce((acc, curr) => {
            for (const { name, id } of curr.result.stations.filter(
              (station) => station.retiredAt === null
            )) {
              acc[id] = {
                type: "station",
                name,
                id,
                uid: `station_${id}`,
              };
            }
            return acc;
          }, {})
        );
      } catch (e) {
        // ...
      }
      this.fetching = false;
    },
  },
  async created() {
    if (
      this.selectedStations.length ||
      this.selectedDevices.length ||
      this.selectedGroups.length
    ) {
      await this.loadValues();
    }
  },
};
</script>
<style scoped>
.tag,
.option {
  vertical-align: middle;
}
</style>
