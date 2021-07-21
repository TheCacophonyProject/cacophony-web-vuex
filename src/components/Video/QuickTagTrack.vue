<template>
  <div class="tag-buttons">
    <div class="tag-category">
      <h6>Your classification:</h6>
      <div class="tag-btns-wrapper animals">
        <button
          v-for="animal in animals"
          :key="animal"
          :class="['btn btn-light btn-tag equal-flex', getClass(animal)]"
          @click="quickTag(animal)"
        >
          <img
            :alt="`Mark as ${animal}`"
            onerror="this.src='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=='"
            :title="`Mark as ${animal}`"
            class="img-tag"
            :src="imgSrc(animal)"
          />
          <span class="tag-name">{{ animal }}</span>
        </button>
      </div>
    </div>

    <div class="tag-category">
      <div class="tag-btns-wrapper other">
        <button
          v-for="otherTag in otherTags"
          :key="otherTag.value"
          :class="[
            'btn btn-light btn-tag equal-flex other-width',
            getClass(otherTag.value),
          ]"
          @click="quickTag(otherTag.value)"
        >
          <img
            :alt="getOtherTitle(otherTag.value)"
            class="img-tag"
            onerror="this.src='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=='"
            :title="getOtherTitle(otherTag.value)"
            :src="imgSrc(otherTag.value)"
          />
          <span class="tag-name">{{ otherTag.text }}</span>
        </button>
        <button
          v-b-modal="'custom-track-tag'"
          class="btn btn-light btn-tag equal-flex"
        >
          <img
            alt="Add other tag"
            title="Open form to add other tag"
            src="/plus.png"
          />
          <span class="tag-name">other...</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import DefaultLabels, { imgSrc } from "../../const";
export default {
  name: "QuickTagTrack",
  props: {
    tags: {
      type: Array,
      required: true,
    },
    isWallabyProject: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    blankImage() {
      return "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==";
    },
    aiGuess() {
      return this.tags.find(
        (tag) => tag.automatic && tag.data.name === "Master"
      );
    },
    animals() {
      return this.isWallabyProject
        ? DefaultLabels.wallabyQuickTagLabels()
        : DefaultLabels.quickTagLabels();
    },
    userTags() {
      return this.tags.filter(
        (tag) =>
          tag.User &&
          tag.User.username === this.$store.state.User.userData.username
      );
    },
    otherTags() {
      const otherTags = DefaultLabels.otherTagLabels();
      // Make sure we always show a button with the AI guess if it's not in the default list:
      const aiGuess = this.aiGuess;
      if (
        aiGuess &&
        aiGuess.what !== "unidentified" &&
        !this.animals.includes(aiGuess.what) &&
        otherTags.find(({ value }) => value === aiGuess.what) === undefined
      ) {
        otherTags.unshift({ text: aiGuess.what, value: aiGuess.what });
      }
      // Make sure we always show a button for a user tagged track if it's not in the default list:
      const userTag = this.userTags[0];
      if (
        userTag !== undefined &&
        userTag.what !== "unknown" &&
        !this.animals.includes(userTag.what) &&
        otherTags.find(({ value }) => value === userTag.what) === undefined
      ) {
        otherTags.unshift({ text: userTag.what, value: userTag.what });
      }
      return otherTags;
    },
  },
  data() {
    return {
      message: "",
    };
  },
  methods: {
    imgSrc,
    quickTag(what) {
      const found = this.getUserTag(what);
      if (found) {
        this.$emit("deleteTag", found);
        return;
      }

      const tag = {};
      tag.confidence = 0.85;
      tag.what = what;
      this.$emit("addTag", tag);
    },
    getOtherTitle(other) {
      if (other === DefaultLabels.falsePositiveLabel.value) {
        return "Mark as nothing or false positive (meaning there is no animal)";
      } else if (other === DefaultLabels.unknownLabel.value) {
        return "Mark as unknown (meaning the type of animal is unclear)";
      }
    },
    hasUserTag(animal) {
      return this.getUserTag(animal) !== undefined;
    },
    getUserTag(animal) {
      return this.userTags.find((tag) => tag.what === animal);
    },
    getClass(animal) {
      let buttonClass = "tag-div";
      if (this.hasUserTag(animal)) {
        buttonClass += " tagged active";
      }
      // var aiTag = this.tags.find(function(tag) {
      //   return tag.what == animal && tag.automatic;
      // });

      // if (aiTag) {
      //   buttonClass += " ai-tagged active";
      // }
      return buttonClass;
    },
  },
};
</script>

<style lang="scss" scoped>
@import "../../styles/tag-colours";

.img-tag {
  min-width: 44px;
  min-height: 44px;
  background: transparent;
}

.tag-buttons {
  margin-bottom: 1.2rem;
  display: flex;
  flex-flow: row wrap;
  justify-content: space-between;
  .tag-category {
    width: 100%;
    h6 {
      font-size: 0.75em;
      font-weight: 600;
      text-transform: uppercase;
      margin-top: 1em;
    }
    margin-bottom: 1em;
  }
  .tag-btns-wrapper {
    display: flex;
    .btn {
      margin-right: 4px;
      > span {
        display: inline-block;
      }
    }
    .btn:last-child {
      margin-right: 0;
    }
  }
  .equal-flex {
    flex: 1 1 0;
  }
  .btn-tag {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-left: 0.2em;
    padding-right: 0.2em;
    img {
      max-width: 44px;
    }
    .tag-name {
      font-size: 0.7em;
    }
    &.tagged {
      border: 2px solid $human !important;
    }
    &.ai-tagged {
      border: 2px solid $ai !important;
    }
    &.ai-tagged.tagged {
      border: 2px solid $aihuman !important;
    }
  }
}
@media only screen and (max-width: 359px) {
  .tag-buttons {
    .btn-tag {
      font-size: smaller;
      img {
        max-width: 32px;
      }
    }
  }
}
</style>
