import { NewVisit } from "@/api/Monitoring.api";
import { TrackLabel } from "@/const";

class ClassificationCounter {
  userClassIndex: number;
  aiClassIndex: number;
  recIds: number[];
  count: number;
  otherClasses: string[];

  constructor(aUserClass: number, anAiClass: number) {
    this.userClassIndex = aUserClass;
    this.aiClassIndex = anAiClass;
    this.recIds = [];
    this.count = 0;
    this.otherClasses = [];
  }

  addVisit(visit: NewVisit) {
    this.count++;
    const recordingIds = visit.recordings.map((rec) => rec.recId);
    this.recIds.push(...recordingIds);
  }

  addOtherClass(className: string) {
    if (this.otherClasses.findIndex((name) => name === className) < 0) {
      this.otherClasses.push(className);
    }
  }

  static makeKey(index: number, aiIndex: number) {
    return `${index}-${aiIndex}`;
  }
}

export type AiCounters = { [key: string]: ClassificationCounter };

export interface MatrixPoint {
  x: number;
  y: number;
  value: number; // percentage of row
  count: number; // actual number
  recIds: number[]; // ids of recordings belonging to this group
  otherClasses: string[]; // how else items were classified (other only)
}

export interface AiConfusionMatrix {
  labels: string[];
  percentages: MatrixPoint[];
}

export function countByClassThenAiClass(
  visits: NewVisit[],
  allLabels: TrackLabel[],
  otherLabel: string
): AiConfusionMatrix {
  const otherIndex = allLabels.length;
  const labels = allLabels.map((tagClass) => tagClass.value);
  labels.push(otherLabel);

  const counters = visits.reduce((acc: AiCounters, visit: NewVisit) => {
    const classi = visit.classification || "none";
    const aiClassi = visit.classificationAi || "none";
    const index = findLabelIndex(classi, allLabels, otherIndex);
    const aiIndex = findLabelIndex(aiClassi, allLabels, otherIndex);

    const key = ClassificationCounter.makeKey(index, aiIndex);

    const counter = acc[key] || new ClassificationCounter(index, aiIndex);
    counter.addVisit(visit);
    if (aiIndex == otherIndex) {
      counter.addOtherClass(aiClassi);
    }
    acc[key] = counter;
    return acc;
  }, {});

  const rowCounts: number[] = new Array(labels.length).fill(0);

  for (const counter of Object.values(counters)) {
    rowCounts[counter.userClassIndex] += counter.count;
  }

  const percentages: MatrixPoint[] = [];
  for (const counter of Object.values(counters)) {
    const total = rowCounts[counter.userClassIndex];
    const percent =
      total > 0 ? (counter.count * 100) / rowCounts[counter.userClassIndex] : 0;
    percentages.push({
      x: counter.aiClassIndex,
      y: counter.userClassIndex,
      value: percent,
      count: counter.count,
      recIds: counter.recIds,
      otherClasses: counter.otherClasses,
    });
  }

  return {
    labels,
    percentages,
  };
}

function findLabelIndex(
  value: string,
  allLabels: TrackLabel[],
  defaultValue: number
): number {
  let index = allLabels.findIndex((tagClass) =>
    tagClass.allIncludedTags.includes(value)
  );
  if (index < 0) {
    index = defaultValue;
  }
  return index;
}
