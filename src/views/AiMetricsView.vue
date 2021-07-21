<template>
  <b-container fluid>
    <b-col>
      <MetricsSearchParams :disabled="queryPending" @submit="querySubmitted" />
      <b-row class="visits-progress" v-if="queryPending">
        <h3>Calculating visits....</h3>
      </b-row>
      <b-row class="visits-progress" v-if="queryPending">
        <b-progress :value="pendingProgress" :max="1"></b-progress>
      </b-row>
      <b-row v-if="results">
        <h4 v-if="results.filteredVisits.length === 0">
          There were no labelled visits for the time period selected.
        </h4>
        <h4 v-else>
          Visit results
          <span>
            ({{ results.filteredVisits.length }} / {{ results.totalVisits }})
          </span>
          <span id="visit-numbers" class="info">?</span>
        </h4>
        <b-tooltip target="visit-numbers" triggers="hover">
          There are {{ results.totalVisits }} visits during this time period. Of
          these {{ results.filteredVisits.length }} have been user
          tagged.</b-tooltip
        >
      </b-row>
      <b-row v-if="visitStats" class="visit-stats">
        <b-col sm="6">Accuracy:</b-col>
        <b-col sm="6" id="visit-accuracy">
          {{ visitStats.accuracy }}%
          <span class="info">?</span>
          <b-tooltip target="visit-accuracy" triggers="hover">
            Accuracy is percentage of user tagged birds and pests correctly
            identified by AI as either bird or pest.</b-tooltip
          >
        </b-col>
        <b-col sm="6">Squashed birds:</b-col>
        <b-col id="squashed" sm="6">
          <span v-if="visitStats.deadBirds"
            >{{ visitStats.deadBirds.value.toFixed(0) }}% of birds ({{
              visitStats.deadBirds.count
            }})</span
          >
          <span v-else>None</span>
          <span class="info">?</span>
          <b-tooltip target="squashed" triggers="hover">
            Squashed birds are user tagged birds that were identified by AI as a
            pest.</b-tooltip
          >
        </b-col>
        <b-col sm="6">Released pests:</b-col>
        <b-col id="released" sm="6">
          <span v-if="visitStats.escapedPests"
            >{{ visitStats.escapedPestsPercent }}% of pests ({{
              visitStats.escapedPests
            }})</span
          >
          <span v-else>None</span>
          <span class="info">?</span>
          <b-tooltip target="released" triggers="hover">
            Released pests are user tagged pests that were identified by AI as
            something other than a pest.</b-tooltip
          >
        </b-col>
      </b-row>
      <b-row sm="12">
        <confusion-matrix
          id="aisummary"
          title="AI accuracy summary"
          :matrix="overViewMatrix"
        />
      </b-row>
      <b-row sm="12">
        <confusion-matrix
          id="allclasses"
          title="AI accuracy detailed"
          :matrix="allCategoriesMatrix"
        />
      </b-row>
    </b-col>
  </b-container>
</template>
<script>
import api from "../api/index";
import ConfusionMatrix from "@/components/Metrics/ConfusionMatrix";
import MetricsSearchParams from "@/components/Metrics/MetricsSearchParams";
import { countByClassThenAiClass } from "@/helpers/aiStats";
import DefaultLabels from "@/const";

export default {
  name: "AiMetricsView",
  components: {
    ConfusionMatrix,
    MetricsSearchParams,
  },
  data() {
    return {
      results: null,
      visitStats: null,
      days: 7,
      start: null,
      pendingProgress: 0,
      queryPending: false,
      allCategoriesMatrix: null,
      overViewMatrix: null,
    };
  },
  mounted() {
    //  this.getVisits();
  },
  methods: {
    querySubmitted(queryParams) {
      this.getVisits(queryParams);
    },
    async getVisits(queryParams) {
      // Remove previous values
      this.queryPending = true;
      this.pendingProgress = 0;
      this.allCategoriesMatrix = null;
      this.overViewMatrix = null;
      this.results = null;
      this.visitStats = null;
      // Call API and process results
      this.results = await api.monitoring.getAllVisits(
        queryParams,
        aiComparisonVisit,
        this.updateProgress
      );
      this.queryPending = false;
      this.allCategoriesMatrix = countByClassThenAiClass(
        this.results.filteredVisits,
        DefaultLabels.detailedAiEvaluationMatrix(),
        "other"
      );
      const overView = countByClassThenAiClass(
        this.results.filteredVisits,
        DefaultLabels.overViewAiEvaluationMatrix(),
        "other"
      );
      overView.percentages = overView.percentages.filter(
        (element) => element.y != 2
      );
      overView.percentages.forEach((element) => {
        element.color = element.x == element.y ? "limegreen" : "lightsalmon";
      });
      this.overViewMatrix = overView;
      this.makeVisitStats(overView);
    },
    updateProgress(progress) {
      this.pendingProgress = progress;
    },
    makeVisitStats(overView) {
      const bird = overView.labels.indexOf("bird");
      const pest = overView.labels.indexOf("pest");
      const totalCount = overView.percentages.reduce(
        (total, point) => total + point.count,
        0
      );
      const totalCorrect = overView.percentages.reduce(
        (total, point) => (point.x == point.y ? total + point.count : total),
        0
      );
      const escapedPests = overView.percentages.reduce(
        (total, point) =>
          point.y == pest && point.x != point.y ? total + point.count : total,
        0
      );
      if (bird >= 0 && pest >= 0 && totalCount > 0 && overView.percentages) {
        const deadBirds = findItem(pest, bird, overView.percentages);
        const pestPests = findItem(pest, pest, overView.percentages);
        this.visitStats = {
          accuracy: ((totalCorrect * 100) / totalCount).toFixed(0),
          deadBirds,
          escapedPestsPercent: pestPests
            ? (100 - pestPests.value).toFixed(0)
            : "100",
          escapedPests,
        };
      }
    },
  },
};
function aiComparisonVisit(visit) {
  return visit.classFromUserTag || false;
}
function findItem(xIndex, yIndex, list) {
  return list.find((item) => item.x == xIndex && item.y == yIndex);
}
</script>

<style scoped lang="scss">
@import "~bootstrap/scss/functions";
@import "~bootstrap/scss/variables";
@import "~bootstrap/scss/mixins";

$main-content-width: 1000px;

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
    width: 100%;
  }
}

.progress {
  width: 60%;
  height: 3em;
}

#heatmapcontainer:after {
  content: "";
  display: block;
  padding-bottom: 100%;
}

.visit-stats {
  margin: 1em 20%;
  padding: 1em;
  border: 1px solid lightgrey;
  border-radius: 1em;
}

.info {
  width: 1em;
  font-size: 66%;
  color: grey;
  padding: 0 0.5em;
  border: 1px solid grey;
  border-radius: 1em;
}
</style>
