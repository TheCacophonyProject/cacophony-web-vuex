~
<template>
  <b-container class="latest-events">
    <h2>
      Latest events for this device
      <b-button
        variant="link"
        class="toggle-filtered-btn"
        @click="() => toggleFiltered()"
      >
        Filters
        <font-awesome-icon v-if="!filtered" :icon="['fas', 'caret-down']" />
        <font-awesome-icon v-else :icon="['fas', 'caret-up']" />
      </b-button>
    </h2>

    <b-row v-if="filtered" class="event-filters">
      <b-col cols="3" class="col-md-1"> Show: </b-col>
      <b-col cols="8" class="col-sm-8 col-md-4 first-item">
        <multiselect
          :value="eventTypes"
          :options="allEventTypes"
          :multiple="true"
          placeholder="All events"
          data-cy="event=type-select"
          @input="eventTypeChanged"
        />
      </b-col>
      <b-col cols="0" class="col-md-1"></b-col>
      <b-col cols="3" class="col-md-2"> Until date: </b-col>
      <b-col cols="8" class="col-sm-8 col-md-4">
        <input v-model="date" type="date" @change="fetchEvents" />
      </b-col>
    </b-row>

    <div class="list-wrapper">
      <b-table striped hover :items="events" :fields="makeFields()">
        <template #cell(dateTime)="data">
          {{ getTableDate(data.value) }}
          {{ new Date(data.value).toLocaleTimeString() }}
        </template>
        <template #cell(details)="data">
          <template
            v-if="data.item.EventDetail && data.item.EventDetail.details"
          >
            <div
              v-for="(value, key) in data.item.EventDetail.details"
              :key="key"
              class="event-details"
            >
              {{ key }} : {{ value }}
            </div>
          </template>
        </template>
      </b-table>
    </div>
    <div class="sticky-footer">
      <b-pagination
        :total-rows="count"
        v-model="page"
        :per-page="perPage"
        limit="5"
        class="pagination-buttons"
        @change="pagination"
        v-if="count > perPage"
      />
    </div>
  </b-container>
</template>

<script>
import api from "@/api/index";
import { toNZDateString } from "@/helpers/datetime";
import { DeviceEventTypes } from "@/api/Device.api";

const ALL_EVENTS = "All events";

export default {
  name: "DeviceEvents",
  props: {
    device: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      eventsLoading: true,
      events: [],
      count: 0,
      page: 1,
      perPage: 100,
      eventTypes: [],
      filtered: false,
      date: "",
      datePrint: "",
      allEventTypes: DeviceEventTypes,
    };
  },

  mounted() {
    this.fetchEvents();
  },
  methods: {
    async fetchEvents() {
      const params = this.makeEventRequestParams();

      this.eventsLoading = true;
      try {
        const { result } = await api.device.getLatestEvents(
          this.device.id,
          params
        );
        this.events = result.rows;
        this.count = result.count;
        // eslint-disable-next-line no-empty
      } catch (e) {}
      this.eventsLoading = false;
    },
    makeEventRequestParams() {
      const params = {
        limit: this.perPage,
        offset: this.page > 1 ? (this.page - 1) * this.perPage : 0,
      };
      if (this.filtered) {
        if (this.eventTypes && this.eventTypes.length) {
          params.type = this.eventTypes;
        }

        if (this.date && this.date.length > 0) {
          this.datePrint = this.date + " 23:59:59";
          params.endTime = this.datePrint;
        }
      }
      return params;
    },
    eventTypeChanged(newEventType) {
      this.eventTypes = newEventType === ALL_EVENTS ? [] : newEventType;
      this.fetchEvents();
    },
    getTableDate(dateString) {
      return toNZDateString(new Date(dateString));
    },
    pagination(page) {
      this.page = page;
      this.fetchEvents();
    },
    toggleFiltered() {
      this.filtered = !this.filtered;
      this.fetchEvents();
    },
    makeFields() {
      return [
        {
          key: "dateTime",
          label: "Time",
        },
        {
          key: "EventDetail.type",
          label: "Event type",
        },
        {
          key: "details",
          label: "Details",
        },
      ];
    },
  },
};
</script>
<style scoped lang="scss">
@import "~bootstrap/scss/functions";
@import "~bootstrap/scss/variables";
@import "~bootstrap/scss/mixins";

.sticky-footer {
  position: sticky;
  bottom: 0;
  width: 100%;
}

.event-type {
  font-weight: bold;
}

.event-filters {
  background: $gray-100;
  border: 1px solid $gray-200;
  padding: 1em 0;
  margin: 1em 2em 1em 0;
}

@include media-breakpoint-down(sm) {
  .first-item {
    margin-bottom: 1em;
  }
}
</style>
