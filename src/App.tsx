import { useEffect, useState } from "react";

import trainingData from "./data/training-data.generated.json";
import { loadExerciseStateMap, persistExerciseStateMap } from "./lib/storage";
import type { Exercise, ExerciseStateMap, TrainingData } from "./lib/types";

const data = trainingData as TrainingData;

function getExerciseState(
  exerciseStateMap: ExerciseStateMap,
  exerciseId: string,
) {
  return (
    exerciseStateMap[exerciseId] ?? {
      completed: false,
      notes: "",
      updatedAt: "",
    }
  );
}

function getCompletedCount(
  exerciseStateMap: ExerciseStateMap,
  exercises: Exercise[],
) {
  return exercises.filter(
    (exercise) => getExerciseState(exerciseStateMap, exercise.id).completed,
  ).length;
}

function getPhaseExercises(
  programs: TrainingData["phases"][number]["programs"],
) {
  return programs.flatMap((program) => program.exercises);
}

function getVisibleExercises(
  phase: TrainingData["phases"][number] | undefined,
) {
  return phase?.programs.flatMap((program) => program.exercises) ?? [];
}

function formatGeneratedAt(timestamp: string) {
  if (!timestamp) {
    return "No imported data yet";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export default function App() {
  const [exerciseStateMap, setExerciseStateMap] = useState<ExerciseStateMap>(
    {},
  );
  const [isStorageReady, setIsStorageReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void loadExerciseStateMap()
      .then((savedState) => {
        if (!isMounted) {
          return;
        }

        setExerciseStateMap(savedState);
        setIsStorageReady(true);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setIsStorageReady(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const allExercises = data.phases.flatMap((phase) =>
    getPhaseExercises(phase.programs),
  );
  const completedCount = getCompletedCount(exerciseStateMap, allExercises);

  function updateExerciseState(
    updater: (current: ExerciseStateMap) => ExerciseStateMap,
  ) {
    setExerciseStateMap((current) => {
      const next = updater(current);
      void persistExerciseStateMap(next);
      return next;
    });
  }

  function setExerciseNotes(exerciseId: string, notes: string) {
    updateExerciseState((current) => ({
      ...current,
      [exerciseId]: {
        ...getExerciseState(current, exerciseId),
        notes,
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  function toggleExercise(exerciseId: string) {
    updateExerciseState((current) => ({
      ...current,
      [exerciseId]: {
        ...getExerciseState(current, exerciseId),
        completed: !getExerciseState(current, exerciseId).completed,
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  function setAllPhaseExercises(exercises: Exercise[], completed: boolean) {
    updateExerciseState((current) => {
      const next = { ...current };

      for (const exercise of exercises) {
        next[exercise.id] = {
          ...getExerciseState(current, exercise.id),
          completed,
          updatedAt: new Date().toISOString(),
        };
      }

      return next;
    });
  }

  if (data.phases.length === 0) {
    return (
      <main className="app-shell">
        <section className="hero-card">
          <p className="eyebrow">Training App</p>
          <h1>No imported training data yet</h1>
          <p>
            Run <code>npm run extract</code> to parse the three PDFs and
            generate the bundled phase data.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Offline training planner</p>
          <h1>Follow each phase, keep notes, and mark exercises complete.</h1>
          <p className="hero-copy">
            Expand any phase when you want to work through it, review each
            program, and keep your notes on-device so the plan still works
            offline.
          </p>
        </div>

        <div className="hero-stats">
          <article>
            <span>Overall progress</span>
            <strong>
              {completedCount}/{allExercises.length}
            </strong>
          </article>
          <article>
            <span>Imported</span>
            <strong>{formatGeneratedAt(data.generatedAt)}</strong>
          </article>
          <article>
            <span>Local sync</span>
            <strong>{isStorageReady ? "Ready" : "Loading..."}</strong>
          </article>
        </div>
      </section>

      <section className="phase-list" aria-label="Training phases">
        {data.phases.map((phase) => {
          const phaseExercises = getVisibleExercises(phase);
          const phaseCompleted = getCompletedCount(
            exerciseStateMap,
            phaseExercises,
          );

          return (
            <details key={phase.id} className="phase-panel">
              <summary className="phase-summary">
                <div>
                  <p className="program-kicker">Training phase</p>
                  <h2>{phase.label}</h2>
                  <p className="phase-summary-copy">
                    {phase.programs.length} programs, {phaseExercises.length}{" "}
                    exercises
                  </p>
                </div>

                <div className="phase-summary-meta">
                  <div className="progress-pill">
                    {phaseCompleted}/{phaseExercises.length}
                  </div>
                  <span className="phase-summary-icon" aria-hidden="true">
                    +
                  </span>
                </div>
              </summary>

              <div className="phase-panel-content">
                <section className="phase-toolbar">
                  <div className="phase-toolbar-copy">
                    <span>Phase progress</span>
                    <strong>
                      {phaseCompleted}/{phaseExercises.length} complete
                    </strong>
                  </div>

                  <div className="bulk-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setAllPhaseExercises(phaseExercises, true)}
                    >
                      Check phase
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() =>
                        setAllPhaseExercises(phaseExercises, false)
                      }
                    >
                      Uncheck phase
                    </button>
                  </div>
                </section>

                <section className="program-grid">
                  {phase.programs.map((program) => {
                    const programCompleted = getCompletedCount(
                      exerciseStateMap,
                      program.exercises,
                    );

                    return (
                      <details key={program.id} className="program-card">
                        <summary className="program-summary">
                          <div>
                            <p className="program-kicker">{phase.label}</p>
                            <h2>{program.name}</h2>
                            <p className="program-summary-copy">
                              {program.exercises.length} exercises
                            </p>
                          </div>

                          <div className="program-summary-meta">
                            <div className="progress-pill">
                              {programCompleted}/{program.exercises.length}
                            </div>
                            <span
                              className="program-summary-icon"
                              aria-hidden="true"
                            >
                              +
                            </span>
                          </div>
                        </summary>

                        <div className="program-details">
                          <div className="progress-bar" aria-hidden="true">
                            <span
                              style={{
                                width: `${program.exercises.length === 0 ? 0 : (programCompleted / program.exercises.length) * 100}%`,
                              }}
                            />
                          </div>

                          <div className="exercise-stack">
                            {program.exercises.map((exercise) => {
                              const exerciseState = getExerciseState(
                                exerciseStateMap,
                                exercise.id,
                              );

                              return (
                                <details
                                  key={exercise.id}
                                  className="exercise-card"
                                >
                                  <summary className="exercise-summary">
                                    <div className="exercise-summary-main">
                                      <p className="exercise-program-name">
                                        {program.name}
                                      </p>
                                      <h3>{exercise.name}</h3>
                                      <p className="exercise-summary-prescription">
                                        {exercise.prescription}
                                      </p>
                                    </div>

                                    <div className="exercise-summary-side">
                                      <span
                                        className={
                                          exerciseState.completed
                                            ? "exercise-state-badge complete"
                                            : "exercise-state-badge"
                                        }
                                      >
                                        {exerciseState.completed
                                          ? "Done"
                                          : "Open"}
                                      </span>
                                      <span className="exercise-summary-page">
                                        Page {exercise.pageNumber}
                                      </span>
                                      <span
                                        className="exercise-summary-icon"
                                        aria-hidden="true"
                                      >
                                        +
                                      </span>
                                    </div>
                                  </summary>

                                  <div className="exercise-details">
                                    <div className="exercise-card-top">
                                      <div
                                        className="exercise-visual"
                                        aria-hidden="true"
                                      >
                                        {exercise.imageUrl ? (
                                          <img src={exercise.imageUrl} alt="" />
                                        ) : (
                                          <div className="exercise-placeholder">
                                            <span>{exercise.name}</span>
                                          </div>
                                        )}
                                      </div>

                                      <div className="exercise-body">
                                        <div className="exercise-heading-row">
                                          <div>
                                            <p className="exercise-program-name">
                                              {program.name}
                                            </p>
                                            <h3>{exercise.name}</h3>
                                          </div>

                                          <label
                                            className={
                                              exerciseState.completed
                                                ? "check-toggle checked"
                                                : "check-toggle"
                                            }
                                          >
                                            <input
                                              type="checkbox"
                                              checked={exerciseState.completed}
                                              onChange={() =>
                                                toggleExercise(exercise.id)
                                              }
                                            />
                                            <span>
                                              {exerciseState.completed
                                                ? "Done"
                                                : "Open"}
                                            </span>
                                          </label>
                                        </div>

                                        <p className="exercise-prescription">
                                          {exercise.prescription}
                                        </p>
                                        <p className="exercise-description">
                                          {exercise.description}
                                        </p>

                                        <div className="exercise-meta-row">
                                          <span>
                                            Source page {exercise.pageNumber}
                                          </span>
                                          {exercise.videoUrl ? (
                                            <a
                                              href={exercise.videoUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="video-link"
                                            >
                                              Watch video
                                            </a>
                                          ) : (
                                            <span className="video-link muted">
                                              No video link in PDF
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="notes-panel">
                                      <label htmlFor={`${exercise.id}-notes`}>
                                        Notes
                                      </label>
                                      <textarea
                                        id={`${exercise.id}-notes`}
                                        value={exerciseState.notes}
                                        onChange={(event) =>
                                          setExerciseNotes(
                                            exercise.id,
                                            event.target.value,
                                          )
                                        }
                                        placeholder="Add cues, weights, mobility reminders, or substitutions."
                                        rows={4}
                                      />
                                    </div>
                                  </div>
                                </details>
                              );
                            })}
                          </div>
                        </div>
                      </details>
                    );
                  })}
                </section>
              </div>
            </details>
          );
        })}
      </section>
    </main>
  );
}
