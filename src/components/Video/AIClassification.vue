<template>
  <div class="AIClassification">
    <h6>AI classification:</h6>
    <div
      :class="[
        'classification',
        { 'guess-is-good': !needsConfirmation && aiGuessIsSameAsSomeUser },
        {
          'guess-is-bad': !needsConfirmation && aiGuessIsDifferentFromSomeUser,
        },
        {
          'guess-is-contentious':
            !needsConfirmation &&
            aiGuessIsDifferentFromSomeUser &&
            aiGuessIsSameAsSomeUser,
        },
      ]"
    >
      <div v-if="aiGuess" class="guess-row">
        <div>
          <img
            onerror="this.src='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=='"
            :src="imgSrc(aiGuess.what)"
            class="tag-img"
            :data-model="aiGuess.data.name"
          />
          <span>{{ aiGuess.what }}</span>
        </div>
        <div v-if="needsConfirmation" class="confirmation">
          <b-button variant="outline-success" size="sm" @click="confirm">
            <font-awesome-icon icon="thumbs-up" />
            <span>Confirm</span>
          </b-button>
          <b-button variant="outline-secondary" size="sm" @click="reject">
            <font-awesome-icon icon="thumbs-down" />
          </b-button>
        </div>
        <div v-else-if="isSuperUser" class="confirmation">
          <div v-if="aiGuessIsSameAsSomeUser">
            <font-awesome-icon icon="check-circle" />
            <span v-if="agreeingUsersCount > 1"
              >({{ agreeingUsersCount }})</span
            >
          </div>
          <span
            v-if="aiGuessIsDifferentFromSomeUser && aiGuessIsSameAsSomeUser"
          >
            /
          </span>
          <div v-if="aiGuessIsDifferentFromSomeUser">
            <font-awesome-icon icon="times-circle" />
            <span v-if="disagreeingUsersCount > 1"
              >({{ disagreeingUsersCount }})</span
            >
          </div>
        </div>
      </div>
      <div v-else>none</div>
    </div>
  </div>
</template>

<script>
import { imgSrc } from "@/const.ts";

export default {
  name: "AIClassification",
  props: {
    tags: {
      type: Array,
      required: true,
    },
    isWallabyProject: {
      type: Boolean,
      default: false,
    },
    needsConfirmation: {
      type: Boolean,
      default: false,
    },
    userTags: {
      type: Array,
      default: () => [],
    },
  },
  computed: {
    aiGuess() {
      return this.tags.find(
        (tag) => tag.automatic && tag.data.name === "Master"
      );
    },
    aiGuessIsSameAsSomeUser() {
      return (
        this.aiGuess &&
        this.userTags.length !== 0 &&
        this.userTags.includes(this.mapName(this.aiGuess.what))
      );
    },
    aiGuessIsDifferentFromSomeUser() {
      return (
        this.aiGuess &&
        this.userTags.length !== 0 &&
        this.userTags.filter((tag) => tag !== this.mapName(this.aiGuess.what))
          .length > 0
      );
    },
    agreeingUsersCount() {
      return this.userTags.filter(
        (tag) => tag === this.mapName(this.aiGuess.what)
      ).length;
    },
    disagreeingUsersCount() {
      return this.userTags.filter(
        (tag) => tag !== this.mapName(this.aiGuess.what)
      ).length;
    },
    isSuperUser() {
      return this.$store.state.User.userData.isSuperUser;
    },
  },
  methods: {
    mapName(name) {
      // Map 'unidentified' ai tag to 'unknown' user tag
      if (name === "unidentified") {
        return "unknown";
      }
      return name;
    },
    imgSrc,
    confirm() {
      this.$emit("confirm-ai-guess", {
        what: this.mapName(this.aiGuess.what),
      });
    },
    reject() {
      this.$emit("reject-ai-guess");
    },
  },
};
</script>

<style scoped lang="scss">
h6 {
  font-size: 0.75em;
  font-weight: 600;
  text-transform: uppercase;
  margin-top: 1em;
}
.tag-img {
  max-width: 30px;
  max-height: 30px;
  background: transparent;
  margin-right: 0.2rem;
}
.classification {
  &.guess-is-good {
    color: forestgreen;
  }
  &.guess-is-bad {
    color: darkred;
  }
  &.guess-is-contentious {
    color: saddlebrown;
  }
  .btn {
    > span {
      font-size: smaller;
    }
  }
}
.confirmation {
  > div,
  > span {
    display: inline-block;
  }
}
.guess-row {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}
</style>
