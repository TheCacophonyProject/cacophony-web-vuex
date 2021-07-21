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
          ref="queryRec"
          :disabled="queryPending"
          :is-collapsed="searchPanelIsCollapsed"
          :simple-only="false"
          @mounted="querySubmitted"
          @submit="querySubmitted"
          @description="saveNextQueryDescription"
          @toggled-search-panel="
            searchPanelIsCollapsed = !searchPanelIsCollapsed
          "
        />
      </div>
      <div :class="['search-content-wrapper', { 'display-rows': !showCards }]">
        <div class="search-results">
          <div class="results-summary">
            <div class="float-right">
              <b-button
                variant="light"
                class="display-toggle btn-sm"
                @click="toggleResultsDisplayStyle"
              >
                Display as {{ showCards ? "rows" : "cards" }}
              </b-button>
              <CsvDownload :params="serialisedQuery" />
            </div>

            <h1>Recordings</h1>
            <h2 v-if="countMessage">
              {{ countMessage }}
            </h2>
            <h5 v-else>Loading...</h5>
            <p class="search-description" v-html="currentQueryDescription" />
          </div>
          <RecordingsList
            :recordings="recordings"
            :query-pending="queryPending"
            :show-cards="showCards"
            :view-recording-query="viewRecordingQuery"
            :all-loaded="atEndOfSearch"
            @load-more="requestMoreRecordings"
          />
          <div v-if="countMessage === 'No matches'" class="no-results">
            <h6 class="text-muted">No recordings found</h6>
            <p class="small text-muted">Try modifying your search criteria.</p>
          </div>
        </div>
      </div>
    </b-row>
  </b-container>
</template>
<script>
import QueryRecordings from "../components/QueryRecordings/QueryRecordings.vue";
import CsvDownload from "../components/QueryRecordings/CsvDownload.vue";
import RecordingsList from "../components/RecordingsList.vue";
import api from "../api/index";

const LOAD_PER_PAGE_CARDS = 10;
const LOAD_PER_PAGE_ROWS = 20;

export default {
  name: "RecordingsView",
  components: { QueryRecordings, CsvDownload, RecordingsList },
  props: {},
  data() {
    return {
      currentQueryDescription: null,
      nextQueryDescription: null,
      serialisedQuery: {},
      queryPending: false,
      searchPanelIsCollapsed: true,
      recordings: [],
      count: null,
      countMessage: null,
      currentPage: 1,
      perPage: this.getPreferredResultsDisplayStyle()
        ? LOAD_PER_PAGE_CARDS
        : LOAD_PER_PAGE_ROWS,
      showCards: this.getPreferredResultsDisplayStyle(),
    };
  },
  watch: {
    $route() {
      if (this.$route.query.offset) {
        this.currentPage =
          Math.ceil(Number(this.$route.query.offset) / this.perPage) + 1;
      } else {
        this.currentPage = 1;
      }
    },
  },
  mounted() {
    if (this.$route.query.limit) {
      this.perPage = Number(this.$route.query.limit);
    }
    if (this.$route.query.offset) {
      this.currentPage =
        Math.ceil(Number(this.$route.query.offset) / this.perPage) + 1;
    }
  },
  computed: {
    viewRecordingQuery() {
      const queryCopy = JSON.parse(JSON.stringify(this.serialisedQuery));

      // delete date data as we use this to find the next/previous recordings
      delete queryCopy.days;
      delete queryCopy.from;
      delete queryCopy.to;

      // delete type as this is controlled by the view
      delete queryCopy.type;
      delete queryCopy.limit;
      delete queryCopy.offset;

      return queryCopy;
    },
    totalPages() {
      return (
        Math.ceil(
          this.count /
            (this.showCards ? LOAD_PER_PAGE_CARDS : LOAD_PER_PAGE_ROWS)
        ) + 1
      );
    },
    atEndOfSearch() {
      return !(this.currentPage < this.totalPages);
    },
  },
  methods: {
    async requestMoreRecordings() {
      const nextQuery = this.makePaginatedQuery(
        this.serialisedQuery,
        this.currentPage + 1,
        this.showCards ? LOAD_PER_PAGE_CARDS : LOAD_PER_PAGE_ROWS
      );

      // Make sure the request wouldn't go past the count?
      if (this.currentPage < this.totalPages) {
        this.updateRoute(nextQuery);
        this.queryPending = true;
        const { result } = await api.recording.query(nextQuery);

        // TODO: It's possible that more recordings have come in since we loaded the page,
        //  in which case our offsets are wrong. So check for duplicate recordings here.
        this.recordings.push(...result.rows);
        this.queryPending = false;
      } else {
        // At end of search
        // console.log("At end of search");
      }
    },
    pagination(page) {
      this.paginationHasChanged(page, this.perPage);
    },
    perPageChanged(perPage) {
      this.currentPage = 0;
      this.paginationHasChanged(this.currentPage, perPage);
    },
    getPreferredResultsDisplayStyle() {
      return localStorage.getItem("results-display-style") !== "row";
    },
    toggleResultsDisplayStyle() {
      this.showCards = !this.showCards;
      localStorage.setItem(
        "results-display-style",
        this.showCards ? "card" : "row"
      );
    },
    makePaginatedQuery(origQuery, page, perPage) {
      const query = { ...origQuery };
      query.limit = perPage;
      query.offset = Math.max(0, (page - 1) * perPage);
      return query;
    },
    updateRoute(query) {
      // Catch errors to avoid redundant navigation error
      this.$router
        .push({
          path: "recordings",
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
      this.getRecordings(query);
    },
    queryRouteHasChanged(query) {
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
      fullQuery.offset = 0;
      this.updateRoute(fullQuery);
      this.getRecordings(fullQuery);
    },
    saveNextQueryDescription(description) {
      this.nextQueryDescription = description;
    },
    async getRecordings(whereQuery) {
      try {
        // Remove previous values
        this.countMessage = "";
        this.recordings = [];
        // Call API and process results
        this.queryPending = true;
        const { result, success } = await api.recording.query(whereQuery);
        this.queryPending = false;

        if (!success) {
          result.messages &&
            result.messages.forEach((message) => {
              this.$store.dispatch("Messaging/WARN", message);
            });
        } else {
          this.currentQueryDescription = this.nextQueryDescription;
          this.count = result.count;
          if (result.count > 0) {
            this.countMessage = `${result.count} matches found (total)`;
          } else if (result.count === 0) {
            this.countMessage = "No matches";
          }
          this.recordings = result.rows;
        }
        // eslint-disable-next-line no-empty
      } catch (e) {}
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
      max-width: 100vw;
    }
  }
}

.no-results {
  display: flex;
  flex-flow: column nowrap;
  margin-top: 20vh;
  text-align: center;
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
}
.display-toggle {
  margin-right: 5px;
}
</style>
