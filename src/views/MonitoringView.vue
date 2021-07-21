<template>
  <b-container fluid>
    <b-row>
      <div
        :class="[
          'search-filter-wrapper',
          { 'is-collapsed': searchPanelIsCollapsed },
        ]"
      >
        <QueryRecordings
          :disabled="queryPending"
          :is-collapsed="searchPanelIsCollapsed"
          :simple-only="true"
          :onlyRecordingType="'video'"
          @mounted="querySubmitted"
          @submit="querySubmitted"
          @description="saveNextQueryDescription"
          @toggled-search-panel="
            searchPanelIsCollapsed = !searchPanelIsCollapsed
          "
        />
      </div>
      <b-col sm="12">
        <div :class="'search-content-wrapper'">
          <div class="search-results">
            <h1>Animal activity</h1>
            <div style="float: right">
              <visit-download :params="serialisedQuery" />
            </div>
            <h2 v-if="countMessage">
              {{ countMessage }}
            </h2>
            <h5 v-else>Loading...</h5>
            <p class="search-description" v-html="currentQueryDescription" />
          </div>
          <div v-if="!queryPending" class="results">
            <VisitList :visits="visits" />
          </div>
          <div v-else class="results loading">
            <div
              v-for="i in 10"
              :style="{
                background: `rgba(240, 240, 240, ${1 / i}`,
              }"
              :key="i"
              class="recording-placeholder"
            />
          </div>
          <div v-if="countMessage === 'No matches'" class="no-results">
            <h6 class="text-muted">No visits found</h6>
            <p class="small text-muted">Please check your search criteria.</p>
          </div>
        </div>
      </b-col>

      <div class="sticky-footer">
        <div class="pagination-per-page">
          <b-form-select
            id="recordsPerPage"
            v-model="perPage"
            :options="perPageOptions"
            class="results-per-page"
            @change="perPageChanged"
          />
          <b-pagination
            :total-rows="count"
            v-model="currentPage"
            :per-page="perPage"
            :limit="limitPaginationButtons"
            class="pagination-buttons"
            @change="pagination"
            v-if="count > perPage"
          />
        </div>
      </div>
    </b-row>
  </b-container>
</template>
<script>
import QueryRecordings from "../components/QueryRecordings/QueryRecordings.vue";
import VisitList from "../components/Monitoring/VisitList.vue";
import VisitDownload from "../components/Monitoring/VisitDownload.vue";
import api from "../api/index";

export default {
  name: "MonitoringView",
  components: { VisitList, QueryRecordings, VisitDownload },
  props: {},
  data() {
    return {
      currentQueryDescription: null,
      nextQueryDescription: null,
      serialisedQuery: {},
      queryPending: false,
      searchPanelIsCollapsed: true,
      visits: [],
      count: null,
      countMessage: null,
      currentPage: 1,
      perPage: 100,
      limitPaginationButtons: 5,
      perPageOptions: [
        { value: 10, text: "10 per page" },
        { value: 50, text: "50 per page" },
        { value: 100, text: "100 per page" },
      ],
    };
  },
  watch: {
    $route() {
      if (this.$route.query.perPage) {
        this.perPage = Number(this.$route.query.perPage);
      } else {
        this.perPage = 100;
      }
      if (this.$route.query.page) {
        this.currentPage = Number(this.$route.query.page);
      } else {
        this.currentPage = 1;
      }
    },
  },
  created() {
    if (this.$route.query.perPage) {
      this.perPage = Number(this.$route.query.perPage);
    }
    if (this.$route.query.page) {
      this.currentPage = Number(this.$route.query.page);
    }
  },
  methods: {
    pagination(page) {
      // console.log("Change pagination", page);
      this.paginationHasChanged(page, this.perPage);
    },
    perPageChanged(perPage) {
      // console.log("perPageChanged", perPage);
      this.currentPage = 1;
      this.paginationHasChanged(this.currentPage, perPage);
    },
    makePaginatedQuery(origQuery, page, perPage) {
      const query = { ...origQuery };
      // console.log("Paginated query:", query);
      query.perPage = perPage;
      query.page = page;
      return query;
    },
    updateRoute(query) {
      // console.log("Update route", query);
      // Catch errors to avoid redundant navigation error
      this.$router
        .push({
          path: "monitoring",
          query,
        })
        .catch(() => {});
    },
    paginationHasChanged(page, perPage) {
      const query = this.makePaginatedQuery(
        this.serialisedQuery,
        page,
        perPage
      );
      this.updateRoute(query);
      this.getVisits(query);
    },
    queryRouteHasChanged(query) {
      // console.log("queryRouteHasChanged", query);
      const fullQuery = this.makePaginatedQuery(
        query,
        this.currentPage,
        this.perPage
      );
      this.updateRoute(fullQuery);
    },
    querySubmitted(query) {
      const queryParamsHaveChanged =
        JSON.stringify(query) !== JSON.stringify(this.serialisedQuery);
      if (queryParamsHaveChanged) {
        this.currentPage = 1;
      }
      this.serialisedQuery = query;

      const fullQuery = this.makePaginatedQuery(
        query,
        this.currentPage,
        this.perPage
      );
      this.updateRoute(fullQuery);
      this.getVisits(fullQuery);
    },
    saveNextQueryDescription(description) {
      this.nextQueryDescription = description;
    },
    async getVisits(whereQuery) {
      // Remove previous values
      this.countMessage = "";
      this.visits = [];
      // Call API and process results
      this.queryPending = true;
      // console.log("query", whereQuery);
      const results = await api.monitoring.queryVisitPage(whereQuery);
      // console.log("results", results);
      this.queryPending = false;

      // Remove previous values *again* since it's possible for the query to have been called twice
      // since it's async, and then you'd append values twice.
      this.visits = [];
      this.count = 0;
      this.countMessage = "";

      if (!results.success) {
        // result.messages &&
        //   result.messages.forEach((message) => {
        //     this.$store.dispatch("Messaging/WARN", message);
        //   });
      } else {
        this.visits = results.result.visits;
        const params = results.result.params;
        this.count = params.pagesEstimate * this.perPage;
        this.currentPage = params.page;
        if (this.visits.length > 0) {
          this.countMessage = `Page ${params.page} of ${params.pagesEstimate}`;
        } else {
          this.countMessage = "No matches";
        }
        //   this.currentQueryDescription = this.nextQueryDescription;
      }
    },
  },
};
</script>

<style scoped lang="scss">
@import "~bootstrap/scss/functions";
@import "~bootstrap/scss/variables";
@import "~bootstrap/scss/mixins";

$main-content-width: 640px;

.search-content-wrapper {
  margin: 0 auto;
  flex-basis: $main-content-width;
  h1 {
    margin: 2rem 0 1.2rem;
  }
  h2 {
    font-size: 1.2rem;
    margin-bottom: 0.8rem;
    color: $gray-700;
  }

  .search-results {
    max-width: $main-content-width;
    margin: 0 auto;
    padding: 0 1em;
  }

  &.display-rows {
    .search-results {
      margin: 0;
      width: 100%;
      max-width: calc(100vw - 2em);
    }

    .results {
      overflow: auto;
    }

    .results-rows {
      display: table-row-group;
    }
    .all-rows {
      display: table;
      width: 100%;
      border-top: 1px solid $border-color;
      border-left: 1px solid $border-color;
    }

    .results-header {
      margin-bottom: 0;
      display: table-header-group;
      > div {
        display: table-row;

        > span {
          position: sticky;
          top: 0;
          background: transparentize($white, 0.15);
          padding: 5px;
          font-weight: 700;
          vertical-align: middle;
          display: table-cell;
          border-right: 1px solid $border-color;
          border-bottom: 2px solid $border-color;
        }
      }
    }
  }
}

.recording-placeholder {
  height: 110px;
  margin-bottom: 15px;
}

.no-results {
  display: flex;
  flex-flow: column nowrap;
  margin-top: 20vh;
  text-align: center;
}

.sticky-footer {
  background: $white;
  border-top: 1px solid $gray-200;
  padding: 7px;
  .pagination-per-page {
    max-width: $main-content-width;
    margin: 0 auto;
    display: flex;
    flex-flow: row wrap;
    justify-content: space-between;
    .results-per-page {
      width: auto;
      float: right;
    }
  }
  .pagination {
    margin-bottom: 0;
    justify-content: center;
  }
}

.search-filter-wrapper {
  background: $gray-100;
  position: relative;
  border-right: 1px solid $gray-200;
}

@include media-breakpoint-down(md) {
  .search-filter-wrapper {
    position: fixed;
    top: 0;
    left: 0;
    transform: translate(0);
    width: var(--search-panel-width);
    z-index: 2;
    transition: transform 0.2s;
    &.is-collapsed {
      transform: translate(var(--search-panel-offset));
    }
  }
}

@include media-breakpoint-up(md) {
  .search-filter-wrapper {
    flex: 0 0 320px;
  }
  .search-content-wrapper {
    flex: 1 1 $main-content-width;
    position: relative;
    overflow: hidden;
    overflow-y: scroll;
    margin: 0;
    max-height: calc(100vh - var(--navbar-height));
  }
  .sticky-footer {
    position: sticky;
    bottom: 0;
  }
}
.display-toggle {
  margin-right: 5px;
}
</style>
