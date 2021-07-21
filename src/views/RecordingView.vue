<template>
  <b-container v-if="recording">
    <b-row>
      <b-col cols="12" lg="8" class="recording-details">
        <h4 class="recording-title">
          <router-link
            :to="{
              name: 'device',
              params: {
                deviceName: deviceName,
                groupName: groupName,
                tabName: 'recordings',
              },
            }"
          >
            <font-awesome-icon
              icon="microchip"
              size="xs"
              style="color: #666; font-size: 16px"
            />
            {{ deviceName }}
          </router-link>
        </h4>

        <h5 class="text-muted">{{ dateString }}, {{ timeString }}</h5>

        <b-alert
          :show="showAlert"
          :variant="alertVariant"
          dismissible
          @dismissed="showAlert = false"
          >{{ alertMessage }}</b-alert
        >
      </b-col>
    </b-row>
    <AudioRecording
      v-if="isAudio"
      :recording="recording"
      :audio-url="fileSource"
      :audio-raw-url="rawSource"
    />
    <VideoRecording
      v-else-if="isVideo"
      :recording="recording"
      :tracks="tracks"
      :video-url="fileSource"
      :video-raw-url="rawSource"
    />
  </b-container>
  <b-container v-else class="message-container">
    <div>
      {{ errorMessage || "Loading..." }}
    </div>
    <div v-if="errorMessage">
      <button
        @click="$router.push({ path: '/recordings' })"
        class="btn btn-link"
      >
        Return to recordings
      </button>
    </div>
  </b-container>
</template>

<script lang="ts">
import config from "../config";
import { mapState } from "vuex";
import * as SunCalc from "suncalc";
import { RecordingInfo } from "@/api/Recording.api";

export default {
  name: "RecordingView",
  components: {
    // We only ever want one of these at a time, so lazy load the required component
    VideoRecording: () => import("@/components/Video/VideoRecording.vue"),
    AudioRecording: () => import("@/components/Video/AudioRecording.vue"),
  },
  data() {
    return {
      showAlert: false,
      alertMessage: "",
      alertVariant: "",
      errorMessage: "",
    };
  },
  computed: {
    ...mapState({
      recording: (state: any): RecordingInfo => state.Video.recording,
      tracks: (state: any) => state.Video.tracks,
      fileSource: (state: any) => {
        return (
          (state.Video.downloadFileJWT &&
            `${config.api}/api/v1/signedUrl?jwt=${state.Video.downloadFileJWT}`) ||
          ""
        );
      },
      // TODO(jon): Api endpoint that doesn't require signedUrl etc, just uses usual auth, and we say which recording we want.
      // Fixes issue with videos timing out on tabs that are open for a while.
      rawSource: (state: any) =>
        `${config.api}/api/v1/signedUrl?jwt=${state.Video.downloadRawJWT}`,
    }),
    timeString(): string {
      if (this.date) {
        return this.date.toLocaleTimeString();
      }
      return "";
    },
    dateString(): string {
      if (this.date) {
        return this.date.toDateString();
      }
      return "";
    },
    sunTimes() {
      return SunCalc.getTimes(
        this.date,
        this.recording.location.coordinates[0],
        this.recording.location.coordinates[1]
      );
    },
    timeUntilDawn(): string {
      // TODO: Let's show some UI around time relative to sunset, sunrise etc.

      // Maybe this is only interesting if we're close to dawn or dusk, or if the moon is up, and full?
      // useful for audio recordings/birds too.
      const hoursUntilDawn = (this.date - this.sunTimes.dawn) / 1000 / 60 / 60;
      if (hoursUntilDawn < 0) {
        return `${-hoursUntilDawn.toFixed(1)} hours before dawn`;
      } else {
        return `${hoursUntilDawn} hours after dawn`;
      }
    },
    isVideo(): boolean {
      return this.recording.type === "thermalRaw";
    },
    isAudio(): boolean {
      return this.recording.type === "audio";
    },
    date(): Date | null {
      return (
        (this.recording.recordingDateTime &&
          new Date(this.recording.recordingDateTime)) ||
        null
      );
    },
    deviceName(): string {
      return (this.recording.Device && this.recording.Device.devicename) || "";
    },
    groupName(): string {
      return (this.recording.Group && this.recording.Group.groupname) || "";
    },
  },
  watch: {
    async $route(to) {
      if (Number(to.params.id) !== this.recording.id) {
        try {
          await this.$store.dispatch(
            "Video/GET_RECORDING",
            this.$route.params.id
          );
        } catch (e) {
          this.errorMessage =
            "We couldn't find the recording you're looking for.";
        }
      }
    },
  },
  mounted: async function () {
    try {
      await this.$store.dispatch("Video/GET_RECORDING", this.$route.params.id);
    } catch (err) {
      this.errorMessage = "We couldn't find the recording you're looking for.";
    }
  },
};
</script>

<style lang="scss" scoped>
@import "~bootstrap/scss/functions";
@import "~bootstrap/scss/variables";
@import "~bootstrap/scss/mixins";

.recording-title > svg {
  vertical-align: text-bottom;
}

.recording-details {
  h4,
  h5 {
    display: inline-block;
  }
  h4 {
    margin-right: 0.2em;
  }
}

@include media-breakpoint-down(md) {
  .recording-details {
    padding-top: 0.6rem;
    padding-bottom: 0.6rem;
  }
}

@include media-breakpoint-down(sm) {
  .recording-details {
    h4 {
      font-size: 110%;
    }
    h5 {
      font-size: 90%;
    }
  }
}

@media only screen and (max-width: 321px) {
  .recording-details {
    h4 {
      font-size: 85%;
    }
    h5 {
      font-size: 65%;
      margin-bottom: 0;
    }
  }
}

@include media-breakpoint-up(md) {
  .recording-details {
    padding-top: 1rem;
    padding-bottom: 0.9rem;
    h4,
    h5 {
      display: inline-block;
    }
  }
}

.ambience {
  background: #2b333f;
  color: whitesmoke;
  border-top-left-radius: 5px;
  border-top-right-radius: 5px;
  padding: 0 5px;
  border-bottom: 1px solid darken(#2b333f, 10%);
  height: 20px;
}

.message-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-bottom: 20%;

  div {
    display: flex;
    justify-content: center;
    text-align: center;
  }
}
</style>
