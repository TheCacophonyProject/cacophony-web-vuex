<template>
  <b-container class="video-elements-wrapper">
    <b-row class="no-gutters">
      <b-col cols="12" lg="8">
        <CptvPlayer
          :cptv-url="videoRawUrl"
          :cptv-size="rawSize"
          :tracks="tracks"
          :user-files="false"
          :recording-id="recording.id"
          :known-duration="recording.duration"
          :current-track="selectedTrack"
          :colours="colours"
          :recently-added-tag="recentlyAddedTrackTag"
          :can-go-backwards="canGoBackwardInSearch"
          :can-go-forwards="canGoForwardInSearch"
          :export-requested="requestedExport"
          @track-selected="trackSelected"
          @ready-to-play="playerReady"
          @request-next-recording="nextRecording"
          @request-prev-recording="prevRecording"
          @export-complete="requestedExport = false"
        />
      </b-col>
      <b-col cols="12" lg="4">
        <div v-if="tracks && tracks.length > 0" class="accordion">
          <TrackInfo
            v-for="(track, index) in tracks"
            :key="index"
            :track="track"
            :index="index"
            :tracks="tracks"
            :num-tracks="tracks.length"
            :recording-id="getRecordingId()"
            :is-wallaby-project="isWallabyProject()"
            :show="index === selectedTrack.trackIndex"
            :colour="colours[index % colours.length]"
            :adjust-timespans="timespanAdjustment"
            @track-selected="trackSelected"
            @change-tag="changedTrackTag"
          />
        </div>
        <div v-if="!processingCompleted" class="processing">
          <b-spinner small />
          <span>Recording still processing.</span>
        </div>
      </b-col>
    </b-row>
    <b-row>
      <b-col cols="12" lg="8">
        <PrevNext
          :recording="recording"
          :can-go-backwards="canGoBackwardInSearch"
          :can-go-forwards="canGoForwardInSearch"
          @nextOrPreviousRecording="prevNext"
        />
        <RecordingControls
          :items="tagItems"
          :comment="recording.comment"
          :download-raw-url="videoRawUrl"
          :download-file-url="''"
          :processing-completed="processingCompleted"
          @deleteTag="deleteTag($event)"
          @addTag="addTag($event)"
          @updateComment="updateComment($event)"
          @nextOrPreviousRecording="gotoNextRecording('either', 'any')"
          @requested-export="requestedMp4Export"
        />
      </b-col>
      <b-col cols="12" lg="4">
        <RecordingProperties :recording="recording" />
      </b-col>
    </b-row>
  </b-container>
</template>

<script lang="ts">
/* eslint-disable no-console */
import { mapState } from "vuex";
import PrevNext from "./PrevNext.vue";
import RecordingControls from "./RecordingControls.vue";
import TrackInfo from "./Track.vue";
import CptvPlayer from "cptv-player-vue/src/CptvPlayer.vue";
import RecordingProperties from "./RecordingProperties.vue";
import { TagColours, WALLABY_GROUP } from "@/const";
import api from "@/api";

export default {
  name: "VideoRecording",
  components: {
    PrevNext,
    RecordingControls,
    RecordingProperties,
    TrackInfo,
    CptvPlayer,
  },
  props: {
    trackid: {
      type: Number,
      required: false,
    },
    recording: {
      type: Object,
      required: true,
    },
    videoRawUrl: {
      type: String,
      required: true,
    },
    tracks: {
      type: Array,
      required: true,
    },
  },
  data() {
    return {
      showAddObservation: false,
      selectedTrack: { trackIndex: 0 },
      recentlyAddedTrackTag: null,
      startVideoTime: 0,
      colours: TagColours,
      header: null,
      canGoForwardInSearch: false,
      canGoBackwardInSearch: false,
      requestedExport: false,
    };
  },
  computed: {
    ...mapState({
      tagItems() {
        return this.$store.getters["Video/getTagItems"];
      },
      rawSize: (state) => (state as any).Video.rawSize,
    }),
    timespanAdjustment() {
      if (this.header) {
        if (this.header.hasBackgroundFrame) {
          return 1 / this.header.fps;
        }
      }
      return 0;
    },
    processingCompleted() {
      return this.recording && this.recording["processingState"] === "FINISHED";
    },
  },
  async mounted() {
    await this.checkPreviousAndNextRecordings();
  },
  methods: {
    requestedMp4Export(advanced?: boolean) {
      if (advanced === true) {
        this.requestedExport = "advanced";
      } else {
        this.requestedExport = true;
      }
    },
    async checkPreviousAndNextRecordings() {
      const list = this.getListOfRecordingsIds();
      if (list) {
        const listIndex = list.indexOf(this.recording.id.toString());
        this.canGoBackwardInSearch = listIndex > 0;
        this.canGoForwardInSearch = listIndex < list.length - 1;
      } else {
        const prevNext = await Promise.all([
          this.hasNextRecording("previous", "any", false, true),
          this.hasNextRecording("next", "any", false, true),
        ]);
        this.canGoBackwardInSearch = prevNext[0];
        this.canGoForwardInSearch = prevNext[1];
      }
    },
    getListOfRecordingsIds(): string[] {
      return this.$route.query.id;
    },
    async gotoNextRecording(direction, tagMode, tags, skipMessage = false) {
      const idsList = this.getListOfRecordingsIds();
      if (idsList) {
        await this.goToNextRecordingInList(direction, idsList);
      } else {
        const searchQueryCopy = JSON.parse(JSON.stringify(this.$route.query));
        try {
          if (
            await this.getNextRecording(direction, tagMode, tags, skipMessage)
          ) {
            await this.$router.push({
              path: `/recording/${this.recording.id}`,
              query: searchQueryCopy,
            });
            if (direction === "next") {
              this.canGoBackwardInSearch = true;
              this.canGoForwardInSearch = await this.hasNextRecording(
                "next",
                tagMode,
                tags,
                true
              );
            } else if (direction === "previous") {
              this.canGoForwardInSearch = true;
              this.canGoBackwardInSearch = await this.hasNextRecording(
                "previous",
                tagMode,
                tags,
                true
              );
            }
          }
          // eslint-disable-next-line no-empty
        } catch (e) {}
      }
    },
    async goToNextRecordingInList(direction, list: string[]) {
      const listIndex = list.indexOf(this.recording.id.toString());
      if (listIndex >= 0) {
        const nextIndex = direction === "next" ? listIndex + 1 : listIndex - 1;
        if (nextIndex >= 0 && nextIndex < list.length) {
          try {
            await this.$router.push({
              path: `/recording/${list[nextIndex]}`,
              query: { id: list },
            });
            this.canGoBackwardInSearch = nextIndex > 0;
            this.canGoForwardInSearch = nextIndex < list.length - 1;
            return await this.$store.dispatch(
              "Video/GET_RECORDING",
              list[nextIndex]
            );
            // eslint-disable-next-line no-empty
          } catch (e) {}
        }
      }
    },
    async hasNextRecording(direction, tagMode, tags, skipMessage) {
      return (
        (await this.getNextRecording(
          direction,
          tagMode,
          tags,
          skipMessage,
          true
        )) === true
      );
    },
    async getNextRecording(
      direction: "next" | "previous" | "either",
      tagMode: string | false,
      tags: string[] | false,
      skipMessage: boolean = false,
      noNavigate: boolean = false
    ): Promise<boolean | any> {
      const params = JSON.parse(JSON.stringify(this.$route.query));

      let order;
      switch (direction) {
        case "next":
          params.to = null;
          params.from = this.recording.recordingDateTime;
          order = "ASC";
          break;
        case "previous":
          params.from = null;
          params.to = this.recording.recordingDateTime;
          order = "DESC";
          break;
        case "either":
          if (await this.getNextRecording("next", tagMode, tags, true)) {
            return true;
          }
          return await this.getNextRecording(
            "previous",
            tagMode,
            tags,
            skipMessage
          );
        default:
          throw `invalid direction: '${direction}'`;
      }
      params.order = JSON.stringify([["recordingDateTime", order]]);

      params.limit = 1;
      params.type = "video";
      delete params.offset;

      try {
        if (!noNavigate) {
          return await this.$store.dispatch("Video/QUERY_RECORDING", {
            params,
            skipMessage,
          });
        } else {
          // Just return whether or not there is a next/prev recording.
          const { result, success } = await api.recording.query(params);
          return success && result.rows.length !== 0;
        }
      } catch (e) {
        return false;
      }
    },
    prevNext(event) {
      this.gotoNextRecording(event[0], event[1], event[2]);
    },
    async nextRecording() {
      await this.gotoNextRecording("next", false, false, true);
    },
    async prevRecording() {
      await this.gotoNextRecording("previous", false, false, true);
    },
    getRecordingId() {
      return Number(this.$route.params.id);
    },
    isWallabyProject() {
      return this.recording.GroupId === WALLABY_GROUP;
    },
    addTag(tag) {
      const id = Number(this.$route.params.id);
      this.$store.dispatch("Video/ADD_TAG", { tag, id });
    },
    deleteTag(tagId) {
      this.$store.dispatch("Video/DELETE_TAG", tagId);
    },
    changedTrackTag(trackTag) {
      this.recentlyAddedTrackTag = trackTag;
      setTimeout(() => {
        this.recentlyAddedTrackTag = null;
      }, 2000);
    },
    async trackSelected(track) {
      const selectedTrack = {
        ...track,
      };
      const targetTrack = this.tracks[track.trackIndex];
      if (track.gotoStart) {
        selectedTrack.start_s = Math.max(
          0,
          targetTrack.data.start_s - this.timespanAdjustment
        );
      }
      if (track.playToEnd) {
        selectedTrack.end_s = targetTrack.data.end_s - this.timespanAdjustment;
      }
      try {
        if (
          selectedTrack.trackId &&
          Number(this.$route.params.trackid) !== selectedTrack.trackId
        ) {
          await this.$router.replace({
            path: `/recording/${this.recording.id}/${selectedTrack.trackId}`,
            query: this.$route.query,
          });
        }
        // eslint-disable-next-line no-empty
      } catch (e) {}
      this.selectedTrack = selectedTrack;
    },
    async playerReady(header) {
      this.header = header;
      const selectedTrackIndex = this.tracks.findIndex(
        (track) => track.id === Number(this.$route.params.trackid)
      );
      if (selectedTrackIndex !== -1) {
        await this.trackSelected({
          trackIndex: selectedTrackIndex,
          gotoStart: true,
        });
      } else {
        await this.trackSelected({
          trackIndex: 0,
        });
      }
    },
    updateComment(comment) {
      const recordingId = Number(this.$route.params.id);
      this.$store.dispatch("Video/UPDATE_COMMENT", {
        comment,
        recordingId,
      });
    },
  },
};
</script>

<style scoped lang="scss">
.video-elements-wrapper {
  padding: 0;
}
.processing {
  color: darkred;
  padding: 0 20px;
  text-align: center;
  > span {
    vertical-align: middle;
  }
  > span:last-child {
    font-weight: 600;
    font-size: 120%;
  }
}
</style>
