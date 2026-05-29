import { get, set } from "idb-keyval";

import type { ExerciseStateMap } from "./types";

const STORAGE_KEY = "training-app:user-state:v1";

export async function loadExerciseStateMap(): Promise<ExerciseStateMap> {
  return (await get<ExerciseStateMap>(STORAGE_KEY)) ?? {};
}

export async function persistExerciseStateMap(
  exerciseStateMap: ExerciseStateMap,
): Promise<void> {
  await set(STORAGE_KEY, exerciseStateMap);
}
