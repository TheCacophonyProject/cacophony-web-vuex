<template>
  <div class="simple-accordion-wrapper">
    <h6 class="simple-accordion-header" @click="show_details = !show_details">
      Tag history
      <span
        v-if="!show_details"
        title="Show all result classes"
        class="pointer"
      >
        <font-awesome-icon icon="angle-down" class="fa-1x" />
      </span>
      <span v-if="show_details" title="Hide other results" class="pointer">
        <font-awesome-icon icon="angle-up" class="fa-1x" />
      </span>
    </h6>
    <div v-if="show_details">
      <b-table
        :items="items"
        :fields="fields"
        class="track-tag-table"
        striped
        hover
        small
        responsive
      >
        <template v-slot:cell(what)="row">
          <div class="what-image">
            <img
              onerror="this.src='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=='"
              :src="imgSrc(row.item.what)"
              class="tag-img"
            />
            {{ row.item.what }}
          </div>
        </template>

        <template v-slot:cell(who)="row">
          <span v-if="row.item.User">
            {{ row.item.User.username }}
          </span>
          <span v-else>
            {{ aiName(row.item) }}
          </span>
        </template>
        <template v-slot:cell(confidence)="row">
          {{ confidence(row.item.confidence) }}
        </template>
        <!-- Be careful about changing the tooltips to use a placement
             other than "left" here. This can cause the tooltips to be
             positioned badly, causing flickering and leads to other
             problems:

             - https://github.com/TheCacophonyProject/cacophony-browse/issues/180
             - ttps://github.com/TheCacophonyProject/cacophony-browse/issues/185
          -->
        <template v-slot:cell(buttons)="row">
          <button
            v-b-tooltip.hover.left="'Confirm the automatic tag'"
            v-if="row.item.automatic && !userTagExists(row.item.what)"
            class="btn"
            @click="confirmTag(row.item)"
          >
            <font-awesome-icon icon="check-circle" />
          </button>

          <button
            v-b-tooltip.hover.left="'Delete tag'"
            v-if="!row.item.automatic"
            class="btn"
            @click="$emit('deleteTag', row.item)"
          >
            <font-awesome-icon icon="trash" />
          </button>
        </template>
      </b-table>
    </div>
  </div>
</template>

<script>
import { imgSrc } from "../../const";

export default {
  name: "TrackTags",
  props: {
    items: {
      type: Array,
      required: true,
    },
  },
  data() {
    return {
      fields: [
        {
          key: "what",
          label: "Tag",
          tdClass: "tag-history-table-what",
        },
        { key: "who", label: "User" },
        { key: "confidence", label: "Conf." },
        {
          key: "buttons",
          label: "",
          tdClass: "tag-history-table-buttons",
        },
      ],
      show_details: false,
    };
  },
  methods: {
    imgSrc,
    aiName: function (trackTag) {
      if (trackTag.data && trackTag.data.name) {
        return "AI " + trackTag.data.name;
      } else {
        return "Cacophony AI";
      }
    },
    confidence: function (confidence) {
      if (confidence >= 0.8) {
        return "high";
      } else if (confidence > 0.4 && confidence < 0.8) {
        return "mid";
      } else if (confidence <= 0.4) {
        return "low";
      } else {
        return "";
      }
    },
    userTagExists: function (what) {
      return this.items.find(
        (tag) =>
          tag.User &&
          tag.what == what &&
          tag.User.username == this.$store.state.User.userData.username
      );
    },
    confirmTag: function (rowItem) {
      const tag = {};
      tag.what = rowItem.what;
      tag.confidence = rowItem.confidence;
      this.$emit("addTag", tag);
    },
  },
};
</script>

<style scoped>
.track-tag-table {
  font-size: 85%;
}

.tag-img {
  max-width: 30px;
  max-height: 30px;
  min-width: 30px;
  min-height: 30px;
  margin-right: 0.2rem;
  background: transparent;
}
</style>

<style>
/* As it turns out, this has to be placed outside scoped styles 😱 */
.track-tag-table .table td {
  vertical-align: middle;
}

td.tag-history-table-buttons {
  padding: 0 !important;
}
</style>
