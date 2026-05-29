export interface Exercise {
  id: string;
  phaseId: string;
  programId: string;
  name: string;
  prescription: string;
  description: string;
  imageUrl: string | null;
  videoUrl: string | null;
  pageNumber: number;
}

export interface Program {
  id: string;
  phaseId: string;
  name: string;
  exercises: Exercise[];
}

export interface Phase {
  id: string;
  label: string;
  sourceFile: string;
  programs: Program[];
}

export interface TrainingData {
  generatedAt: string;
  phases: Phase[];
}

export interface ExerciseState {
  completed: boolean;
  notes: string;
  updatedAt: string;
}

export type ExerciseStateMap = Record<string, ExerciseState>;
