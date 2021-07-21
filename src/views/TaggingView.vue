<template>
  <div class="tagging-view">
    <AddCustomTrackTag
      @addTag="addCustomTag"
      :allow-comment="false"
      :allow-confidence="false"
    />
    <div class="player-and-controls">
      <div class="video-container">
        <div class="player">
          <transition name="fade">
            <div
              class="next-track-countdown"
              v-if="nextTrackOrRecordingTimeout !== 0"
            >
              <div>Next track in</div>
              <div class="countdown">{{ nextTrackOrRecordingTimeout }}</div>
            </div>
          </transition>
          <CptvPlayer
            v-if="fileSource"
            ref="thermalPlayer"
            :ext-loading="loading"
            :cptv-url="fileSource"
            :user-files="false"
            :cptv-size="fileSize"
            :tracks="tracks"
            :colours="colours"
            :known-duration="currentRecording.duration"
            :recording-id="currentRecording.id"
            :current-track="cTrack"
            :can-select-tracks="false"
            :show-overlays-for-current-track-only="true"
            :stand-alone="true"
            @ready-to-play="playerReady"
            @request-next-recording="nextRecording"
            @request-prev-recording="prevRecording"
          />
          <div v-else class="player-loading-placeholder"></div>
          <div class="actions">
            <b-button
              :disabled="!readyToTag || history.length === 0"
              @click="undo"
            >
              Undo last action
            </b-button>
            <b-button
              variant="danger"
              @click="deleteVideo"
              v-if="currentUser.globalPermission === 'write'"
              >Delete recording</b-button
            >
          </div>
        </div>
      </div>
      <div class="controls">
        <div class="tag-buttons">
          <b-button
            :disabled="
              !readyToTag || (currentTrackIsAlreadyTagged && !isTagged(value))
            "
            :class="{ selected: isTagged(value) }"
            :key="text"
            v-for="{ text, value } in tags"
            @click="() => addTag(value)"
          >
            <img
              :alt="text"
              :title="`Mark as ${text}`"
              :src="`/${value}.png`"
            />
            <span>{{ text }}</span>
          </b-button>

          <b-button
            :disabled="!readyToTag || currentTrackIsAlreadyTagged"
            v-b-modal="'custom-track-tag'"
            class="btn btn-light btn-tag equal-flex"
          >
            <img
              alt="Other tag"
              title="Open form to add other tag"
              src="/plus.png"
            />
            <span>other...</span>
          </b-button>

          <b-button :disabled="!readyToTag" @click="markTrackAsSkipped">
            <span>Skip track</span>
          </b-button>
          <b-button :disabled="!readyToTag" @click="nextRecordingUnbiased">
            <span>Skip recording</span>
          </b-button>
        </div>
      </div>
    </div>

    <div>
      <h4 v-if="readyToTag || !loading">
        Tagging: Track {{ currentTrackIndex + 1 }},
        <a :href="`/recording/${currentRecording.RecordingId}`">
          Recording #{{ currentRecording.RecordingId }}
        </a>
      </h4>
      <h4 v-else>Loading recording</h4>
      <span>Tagged {{ numTagged }}</span
      >,
      <span>Skipped {{ numSkipped }}</span>
    </div>
  </div>
</template>

<script lang="ts">
import config from "@/config";
import CptvPlayer from "cptv-player-vue/src/CptvPlayer.vue";
import AddCustomTrackTag from "../components/Video/AddCustomTrackTag.vue";
import api from "@/api";
import DefaultLabels, { TagColours } from "@/const";
import Vue from "vue";

import {
  DeviceId,
  LimitedTrack,
  LimitedTrackTag,
  TagLimitedRecording,
  Track,
  TrackTag,
  User,
  JwtToken,
} from "@/api/Recording.api";

interface TaggingViewData {
  colours: string[];
  tags: { text: string; value: string }[];
  currentTrackIndex: number;
  currentRecording: TagLimitedRecording | null;
  loading: boolean;
  taggingPending: boolean;
  readyToPlay: boolean;
  tracks: LimitedTrack[];
  history: {
    tracks: LimitedTrack[];
    trackIndex: number;
    recording: TagLimitedRecording;
    tag: LimitedTrackTag;
  }[];
  nextTrackOrRecordingTimeout: number;
  currentTimeout: number | null;
  fileSize: number;
}

export default Vue.extend({
  name: "TaggingView",
  components: { CptvPlayer, AddCustomTrackTag },
  data(): TaggingViewData {
    return {
      colours: TagColours,
      tags: [
        ...DefaultLabels.quickTagLabels().map((x) => ({ text: x, value: x })),
        { text: "mustelid", value: "mustelid" },
        ...DefaultLabels.otherTagLabels(),
      ],
      tracks: [],
      history: [],
      currentRecording: null,
      currentTrackIndex: 0,

      loading: true,
      taggingPending: false,
      readyToPlay: false,
      nextTrackOrRecordingTimeout: 0,
      currentTimeout: null,
      fileSize: 0,
    };
  },
  methods: {
    playerReady() {
      this.readyToPlay = true;
      this.currentTrackIndex = 0;
    },
    prevRecording() {},

    async undo() {
      const { recording, tracks, trackIndex, tag } = this.history.pop();
      await this.deleteTag(tag, recording, tracks[trackIndex]);
      this.currentRecording = recording;
      this.tracks = tracks;
      this.currentTrackIndex = trackIndex;
    },
    async deleteVideo() {
      this.readyToPlay = false;
      await api.recording.del(this.currentRecording.RecordingId);
      await this.nextRecording();
    },
    isTagged(tagValue: string): boolean {
      if (this.currentRecording && this.tracks && this.currentTrack) {
        return (
          this.currentTrack.tags && this.currentTrack.tags.includes(tagValue)
        );
      }
      return false;
    },
    markTrackAsSkipped() {
      const synthesisedTag = {
        TrackTagId: -1,
        what: "skipped",
      };
      this.currentTrack.tags.push(synthesisedTag);
      this.currentTrack.needsTagging = false;
      this.history.push({
        trackIndex: this.currentTrackIndex,
        tracks: this.tracks,
        recording: this.currentRecording,
        tag: synthesisedTag,
      });
      this.primeNextTrack(3);
    },
    nextTrackOrRecording() {
      if (this.allTracksInRecordingAreTaggedByHuman) {
        this.nextRecording();
      } else {
        // Advance to next untagged track
        let nextIndex = this.currentTrackIndex;
        while (
          nextIndex < this.tracks.length &&
          !this.tracks[nextIndex].needsTagging
        ) {
          nextIndex++;
        }
        this.currentTrackIndex = nextIndex;
      }
    },
    async nextRecording() {
      const currentDeviceId =
        this.currentRecording && this.currentRecording.DeviceId;
      this.tracks = [];
      this.readyToPlay = false;
      this.loading = true;
      await this.getRecording(currentDeviceId);
      this.loading = false;
    },
    async nextRecordingUnbiased() {
      this.tracks = [];
      this.readyToPlay = false;
      this.loading = true;
      await this.getRecording();
      this.loading = false;
    },
    addCustomTag({ what }) {
      this.addTag(what);
    },
    async addTag(tagLabel: string) {
      const recordingId = this.currentRecording.RecordingId;
      const currentTrack = this.tracks[this.currentTrackIndex];
      const trackId = currentTrack.TrackId;
      const tag = { what: tagLabel, confidence: 0.85 };
      this.taggingPending = true;
      const { result } = await api.recording.addTrackTag(
        tag,
        recordingId,
        trackId,
        this.currentRecording.tagJWT as unknown as JwtToken<TrackTag>
      );
      this.taggingPending = false;
      if (result.success) {
        // Add the track tag to this.data.tracks:
        currentTrack.tags.push(tagLabel);
        currentTrack.needsTagging = false;
        this.history.push({
          trackIndex: this.currentTrackIndex,
          tracks: this.tracks,
          recording: this.currentRecording,
          tag: {
            what: tagLabel,
            TrackTagId: result.trackTagId,
          },
        });
        this.primeNextTrack(3);
      }
    },
    async deleteTag(
      tag: LimitedTrackTag,
      recording: TagLimitedRecording,
      track: LimitedTrack
    ) {
      if (tag.what !== "skipped") {
        this.taggingPending = true;
        const { success } = await api.recording.deleteTrackTag(
          {
            id: tag.TrackTagId,
            TrackId: track.TrackId,
            what: tag.what,
          },
          recording.RecordingId
        );
        this.taggingPending = false;
        if (success) {
          // eslint-disable-next-line require-atomic-updates
          track.tags = track.tags.filter((item) => item !== tag.what);
          // eslint-disable-next-line require-atomic-updates
          track.needsTagging = true;
        }
      } else {
        // Just remove synthetic 'skipped' tag
        track.tags = track.tags.filter((item) => item !== "skipped");
        track.needsTagging = true;
      }
    },
    primeNextTrack(tillNext: number) {
      this.nextTrackOrRecordingTimeout = tillNext;
      if (this.currentTimeout) {
        clearTimeout(this.currentTimeout);
      }
      this.currentTimeout = setTimeout(() => {
        if (tillNext !== 0) {
          this.primeNextTrack(tillNext - 1);
        } else {
          clearTimeout(this.currentTimeout);
          this.nextTrackOrRecording();
        }
      }, 300);
    },
    async getRecording(biasToDeviceId?: DeviceId): Promise<boolean> {
      try {
        const recordingResponse = await api.recording.needsTag(biasToDeviceId);
        const { result, success } = recordingResponse;
        if (success) {
          const recording = result.rows[0];
          this.fileSize = recording.fileSize;
          // Make sure it's not a recording we've seen before and skipped tracks from.
          if (
            this.history.find(
              (prev) => prev.recording.RecordingId === recording.RecordingId
            ) !== undefined
          ) {
            return await this.getRecording();
          }

          // FIXME: Dedupe these tracks, we seem to not be getting DISTINCT tracks on the DB side.
          if (recording.tracks.length) {
            const tracks = recording.tracks.reduce((acc, track) => {
              acc[track.TrackId] = track;
              return acc;
            }, {});
            this.tracks = Object.values(tracks)
              .map((track) => ({
                ...track,
                tags: [],
              }))
              .filter((track) => track.needsTagging)
              .sort((a, b) => a.data.start_s - b.data.start_s);

            for (let i = 0; i < this.tracks.length; i++) {
              this.tracks[i].trackIndex = i;
            }
          }
          this.currentRecording = recording;

          // Advance to next untagged track
          let nextIndex = 0;
          while (
            nextIndex < this.tracks.length &&
            !this.tracks[nextIndex].needsTagging
          ) {
            nextIndex++;
          }
          this.currentTrackIndex = nextIndex;
        }
        return success;
      } catch (e) {
        return false;
      }
    },
  },
  computed: {
    numTagged(): number {
      return this.history.filter(({ tag }) => tag.what !== "skipped").length;
    },
    numSkipped(): number {
      return this.history.filter(({ tag }) => tag.what === "skipped").length;
    },
    allTracksInRecordingAreTaggedByHuman(): boolean {
      return (
        this.tracks.filter((track) => track.needsTagging === false).length ===
        this.tracks.length
      );
    },
    currentTrackIsAlreadyTagged(): boolean {
      return this.currentTrack && !this.currentTrack.needsTagging;
    },
    readyToTag(): boolean {
      return (
        !this.taggingPending &&
        this.currentRecording &&
        this.currentTrack &&
        !this.loading &&
        this.readyToPlay &&
        this.nextTrackOrRecordingTimeout === 0
      );
    },
    currentTrack(): Track {
      if (this.tracks && this.currentTrackIndex < this.tracks.length) {
        return this.tracks[this.currentTrackIndex];
      }
      // NOTE: This is technically an error, but we don't really want to return undefined from this
      return this.tracks && this.tracks[0];
    },
    cTrack() {
      return {
        trackIndex: this.currentTrack && this.currentTrack.trackIndex,
        start_s: (this.currentTrack && this.currentTrack.data.start_s) || 0,
      };
    },
    currentUser(): User {
      return this.$store.state.User.userData;
    },
    fileSource(): string | false {
      if (this.currentRecording) {
        return `${config.api}/api/v1/signedUrl?jwt=${this.currentRecording.recordingJWT}`;
      }
      return false;
    },
  },
  async created() {
    await this.nextRecording();
  },
});
</script>

<style scoped lang="scss">
.player-loading-placeholder {
  background: black;
  border-radius: 5px;
  width: 100%;
  min-height: 500px;
  // TODO
}

.tagging-view {
  display: flex;
  flex-direction: column;
  align-self: center;
}
.player-and-controls {
  display: flex;
  flex-direction: row;
  margin-top: 10px;
}
.tag-buttons {
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  justify-items: stretch;
  height: 100%;
  > .btn {
    flex-grow: 1;
    background-color: #ccc;
    color: #222;
    text-align: left;
    border: 0;
    border-left: 4px solid #555;
    border-bottom-left-radius: 0;
    border-top-left-radius: 0;
    transition: background-color 0.3s;
    &:not(:last-child) {
      margin-bottom: 5px;
    }
    > span {
      padding-left: 10px;
    }
    > img {
      max-height: 44px;
      width: auto;
    }
  }
}
.video-container,
.actions {
  min-width: 640px;
  max-width: 640px;
}
.player {
  position: relative;
}
.next-track-countdown {
  text-shadow: #222 0 1px 2px;
  position: absolute;
  top: 200px;
  z-index: 10000;
  font-weight: 400;
  width: 100%;
  color: white;
  font-size: 30px;
  text-align: center;
  > .countdown {
    line-height: 40px;
    font-size: 60px;
  }
}
.btn.selected {
  background: orange;
}
.actions {
  padding: 10px 10px 10px 0;
  display: flex;
  justify-content: space-between;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter,
.fade-leave-to {
  opacity: 0;
}
</style>
