<template>
  <div :id="id" width="90%" class="confusion" />
</template>

<script>
import Highcharts from "highcharts";
// Load module after Highcharts is loaded
// eslint-disable-next-line no-undef
require("highcharts/modules/heatmap")(Highcharts);

export default {
  name: "ConfusionMatrix",
  props: {
    matrix: {
      type: Object,
      default: null,
    },
    id: {
      type: String,
      default: "confusion-matrix",
    },
    title: {
      type: String,
      default: "",
    },
  },
  data() {
    return {
      chart: null,
    };
  },
  watch: {
    matrix: function () {
      if (this.chart) {
        this.chart.destroy();
        this.chart = null;
      }
      if (
        this.matrix &&
        this.matrix.percentages &&
        this.matrix.percentages.length > 0
      ) {
        this.makeAllCategoriesHeatmap();
      }
    },
  },
  computed: {},
  methods: {
    makeAllCategoriesHeatmap() {
      this.chart = Highcharts.chart(this.id, {
        chart: {
          type: "heatmap",
          plotBorderWidth: 1,
          height: "500px",
        },

        title: {
          text: this.title,
        },

        xAxis: {
          categories: this.matrix.labels,
          title: { text: "AI label" },
        },

        yAxis: {
          categories: this.matrix.labels,
          reversed: true,
          title: { text: "User label" },
        },

        colorAxis: {
          min: 0,
          minColor: "#FFFFFF",
          maxColor: Highcharts.getOptions().colors[0],
        },

        legend: {
          align: "right",
          layout: "vertical",
          margin: 0,
          verticalAlign: "top",
          y: 25,
          symbolHeight: 280,
        },

        tooltip: {
          formatter: function () {
            const userClass = this.point.series.yAxis.categories[this.point.y];
            const aiClass = this.point.series.xAxis.categories[this.point.x];
            if (aiClass !== "other") {
              return `There were ${this.point.count} visits identified by users as ${userClass} and by the ai as ${aiClass}`;
            } else {
              return `There were ${this.point.count} visits identified by users as ${userClass} and by the ai as one of ${this.point.otherClasses}`;
            }
          },
        },

        plotOptions: {
          series: {
            cursor: "pointer",
            events: {
              click: function (event) {
                const ids = event.point.recIds;
                let url = "";
                if (ids.length > 0) {
                  url = `recording/${ids[0]}?id=${ids.join("&id=")}`;
                  window.open(url);
                }
              },
            },
          },
        },

        series: [
          {
            name: "Visits per category",
            borderWidth: 1,
            data: this.matrix.percentages || {},
            dataLabels: {
              enabled: true,
              align: "center",
              color: "#000000",
              format:
                "{point.value:.0f}%</br><span style='color: gray'>({point.count})</span>",
            },
          },
        ],
      });
    },
  },
};
</script>