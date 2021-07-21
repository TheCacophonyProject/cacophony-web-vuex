const TRAP_NZ_IDS = new Map();
const TRAP_NZ_SPECIES = [
  "rodent",
  "none",
  "lizard",
  "unspecified",
  "rat",
  "mouse",
  "ferret",
  "stoat",
  "weasel",
  "rabbit",
  "hedgehog",
  "possum",
  "insect",
  "weta",
  "bird",
  "magpie",
  "cat",
  "dog",
  "other",
];

export class TrackLabel {
  value: string;
  text: string;
  trapNzSpecies?: string;
  includes: TrackLabel[];
  allIncludedTags: string[];

  constructor(
    parent: TrackLabel,
    dbLabel: string,
    description: string = null,
    trapNzName = null
  ) {
    this.value = dbLabel;
    this.text = description ? description : this.value;
    this.includes = [];
    this.allIncludedTags = [this.value];

    if (parent) {
      parent.addChild(this);
    }

    this.trapNzSpecies = this.makeTrapIdSpecies(parent, trapNzName);
  }

  addChild(child: TrackLabel) {
    this.includes.push(child);
    this.allIncludedTags.push(child.value);
  }

  makeTrapIdSpecies(parent: TrackLabel, trapNzName = null): string {
    let trapNZ = trapNzName ? trapNzName : this.value;
    if (!TRAP_NZ_SPECIES.includes(trapNZ)) {
      trapNZ = parent ? parent.trapNzSpecies : null;
    }

    if (trapNZ) {
      TRAP_NZ_IDS.set(this.value, trapNZ);
    }

    return trapNZ;
  }
}

const nomenclatureBase = new TrackLabel(null, "base");

const things = new TrackLabel(nomenclatureBase, "things", "things", "other");
const notKnown = new TrackLabel(
  nomenclatureBase,
  "not known",
  "not known",
  "unspecified"
);
const nothing = new TrackLabel(nomenclatureBase, "nothing", "nothing", "none");
const descriptors = new TrackLabel(nomenclatureBase, "descriptors");

const allBirds = new TrackLabel(things, "allbirds", "any type of bird", "bird");
const bird = new TrackLabel(allBirds, "bird");
const kiwi = new TrackLabel(allBirds, "bird/kiwi", "kiwi");

const pest = new TrackLabel(things, "pest", "One of our target pest species");
const possum = new TrackLabel(pest, "possum");
const rodent = new TrackLabel(pest, "rodent", "rat or mouse", "rat");
new TrackLabel(pest, "mustelid", "stoat, weasel or ferret (mustelid)", "stoat");
const hedgehog = new TrackLabel(pest, "hedgehog");
const cat = new TrackLabel(pest, "cat");

new TrackLabel(things, "dog");
new TrackLabel(things, "leporidae", "hare or rabbit (leporidae)", "rabbit");
const wallaby = new TrackLabel(things, "wallaby");
new TrackLabel(things, "pig");
new TrackLabel(things, "human");
new TrackLabel(things, "insect", "spider or insect (on camera lens or flying)");
new TrackLabel(things, "penguin");
new TrackLabel(things, "sealion");
new TrackLabel(things, "deer");
new TrackLabel(things, "goat");
new TrackLabel(things, "vehicle");
const other = new TrackLabel(things, "other");

const part = new TrackLabel(descriptors, "part", "part of animal (eg tail)");
const poorTracking = new TrackLabel(descriptors, "poor tracking");
const interesting = new TrackLabel(descriptors, "interesting");

const falsePositive = new TrackLabel(
  nothing,
  "false-positive",
  "false positive"
);

new TrackLabel(nothing, "none");
new TrackLabel(notKnown, "unidentified");
const unknown = new TrackLabel(notKnown, "unknown", "not identifiable");

// specified means - can have another specified tag in the search (eg Possum)
const recordingLabelsBase = [
  {
    value: "missed track",
    text: "Missed animal track",
    specified: true,
  },
  {
    value: "missed recording",
    text: "Missed recording (before this one)",
    specified: false,
  },
  {
    value: "multiple animals",
    text: "Multiple animals in video",
    specified: true,
  },
  {
    value: "trapped in trap",
    text: "Animal in trap",
    specified: true,
  },
  {
    value: "interaction with trap",
    text: "Animal interacted with trap",
    specified: true,
  },
  {
    value: "cool",
    text: "Cool video",
    specified: true,
  },
  {
    value: "requires review",
    text: "Flagged for review",
    specified: true,
  },
];

const taggingFilters = [
  {
    value: "any",
    text: "all",
    specified: false,
  },
  {
    value: "no-human",
    text: "not tagged by human",
    specified: false,
  },
  {
    value: "tagged",
    text: "tagged as...",
    specified: true,
  },
  {
    value: "human-tagged",
    text: "Human tagged as...",
    specified: true,
  },
  {
    value: "automatic-tagged",
    text: "AI tagged as...",
    specified: true,
  },
  {
    value: "both-tagged",
    text: "AI and human tagged as...",
    specified: true,
  },
  {
    value: "untagged",
    text: "untagged only",
    specified: false,
  },
];

const searchRecordingBase = [...recordingLabelsBase, ...taggingFilters];

const filtersWhichCanHaveSpecifiedTags = searchRecordingBase
  .filter((tag) => tag.specified == true)
  .map((tag) => tag.value);

const DefaultLabels = {
  trackLabelsBase: [
    ...pest.includes,
    ...allBirds.includes,
    pest,
    ...things.includes,
    unknown,
    part,
    poorTracking,
    other,
  ],
  tagTypes: [...taggingFilters],
  otherTagLabels: function () {
    return [unknown, falsePositive];
  },
  quickTagLabels: function () {
    return [possum.value, rodent.value, hedgehog.value, cat.value, bird.value];
  },
  wallabyQuickTagLabels: function () {
    return [wallaby.value, possum.value, rodent.value, cat.value, bird.value];
  },
  recordingLabels: function () {
    return [...recordingLabelsBase];
  },
  searchRecordingLabels: function () {
    return [...searchRecordingBase];
  },
  searchLabels: function () {
    return [interesting, ...this.trackLabelsBase];
  },
  trackLabels: function () {
    return [...this.trackLabelsBase];
  },
  canHaveSpecifiedTags: function (tagType) {
    return (
      filtersWhichCanHaveSpecifiedTags.find((tag) => tag === tagType) != null
    );
  },
  overViewAiEvaluationMatrix: function () {
    return [bird, pest];
  },
  detailedAiEvaluationMatrix: function () {
    return [bird, ...pest.includes, wallaby, nothing, notKnown];
  },
  falsePositiveLabel: falsePositive,
  birdLabel: bird,
  unknownLabel: unknown,
  unidentifiedLabel: undefined,
};

export const TagColours = [
  "yellow",
  "orange",
  "red",
  "purple",
  "lightblue",
  "limegreen",
  "black",
  "white",
];

function imgSrc(what) {
  let image = null;
  if (what == kiwi.value) {
    image = "kiwi.png";
  } else {
    image = what + ".png";
  }
  return "/" + image;
}

function getTrapNzSpecies(label: string) {
  const lowerLabel = label.toLowerCase();
  return TRAP_NZ_IDS.get(lowerLabel) || "";
}

export { getTrapNzSpecies, imgSrc };
export default DefaultLabels;

export const WALLABY_GROUP = 160;
