import fs from 'node:fs';
import path from 'node:path';

import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

import type { Exercise, Phase, Program, TrainingData } from '../src/lib/types';

type Line = {
  text: string;
  y: number;
  height: number;
  minX: number;
};

type SourcePhase = {
  id: string;
  label: string;
  fileName: string;
};

type DraftExercise = {
  id: string;
  phaseId: string;
  programId: string;
  name: string;
  prescription: string;
  descriptionLines: string[];
  imageUrl: string | null;
  videoUrl: string | null;
  pageNumber: number;
};

type DraftProgram = {
  id: string;
  phaseId: string;
  name: string;
  exercises: Exercise[];
};

const SOURCE_PHASES: SourcePhase[] = [
  { id: 'phase-1', label: 'Phase 1', fileName: 'Phase 1.pdf' },
  { id: 'phase-2', label: 'Phase 2', fileName: 'Phase 2.pdf' },
  { id: 'phase-3', label: 'Phase 3', fileName: 'Phase 3.pdf' },
];

const HEADER_TEXT = new Set(['Nick Zervakis', 'Personal Workout Plan', 'Detailed program']);

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function sanitizeDescriptionLine(value: string) {
  return normalizeWhitespace(value.replace(/Video explanation/gi, '').replace(/^"+|"+$/g, ''));
}

function isHeaderOrFooter(line: Line) {
  return HEADER_TEXT.has(line.text) || /^By\s+/i.test(line.text);
}

function isProgramHeading(line: Line) {
  return line.height >= 13 && line.minX <= 60 && !isHeaderOrFooter(line);
}

function isPrescriptionLine(line: Line | undefined) {
  return Boolean(line && /(?:sets x|rounds)/i.test(line.text));
}

function isExerciseStart(line: Line, nextLine: Line | undefined) {
  if (line.minX > 60) {
    return false;
  }

  if (isHeaderOrFooter(line) || isProgramHeading(line) || line.text.startsWith('"') || /^Rest\b/i.test(line.text)) {
    return false;
  }

  return isPrescriptionLine(nextLine);
}

function groupLines(textItems: any[]): Line[] {
  const grouped = new Map<number, Array<{ text: string; x: number; height: number }>>();

  for (const item of textItems) {
    if (
      !('str' in item) ||
      typeof item.str !== 'string' ||
      !Array.isArray(item.transform) ||
      typeof item.height !== 'number'
    ) {
      continue;
    }

    const text = normalizeWhitespace(item.str);
    if (!text) {
      continue;
    }

    const y = Math.round(item.transform[5]);
    const key = [...grouped.keys()].find((existingKey) => Math.abs(existingKey - y) <= 2) ?? y;
    const row = grouped.get(key) ?? [];
    row.push({ text, x: Math.round(item.transform[4]), height: Math.round(item.height) });
    grouped.set(key, row);
  }

  return [...grouped.entries()]
    .sort((left, right) => right[0] - left[0])
    .map(([y, items]) => ({
      y,
      text: normalizeWhitespace(items.map((item) => item.text).join(' ')),
      height: Math.max(...items.map((item) => item.height)),
      minX: Math.min(...items.map((item) => item.x)),
    }));
}

function toUniquePageLinks(annotations: Array<{ url?: string; unsafeUrl?: string; rect: number[] }>) {
  const uniqueLinks = new Set<string>();

  return annotations
    .filter((annotation) => annotation.url || annotation.unsafeUrl)
    .sort((left, right) => Math.max(...right.rect) - Math.max(...left.rect))
    .map((annotation) => annotation.url ?? annotation.unsafeUrl ?? '')
    .filter((url) => {
      if (!url || uniqueLinks.has(url)) {
        return false;
      }

      uniqueLinks.add(url);
      return true;
    });
}

async function resolveDestinationPage(documentHandle: any, destination: unknown): Promise<number | null> {
  if (!destination) {
    return null;
  }

  const resolvedDestination =
    typeof destination === 'string' ? await documentHandle.getDestination(destination) : destination;

  if (!resolvedDestination) {
    return null;
  }

  const pageReference = resolvedDestination[0];
  if (!pageReference || typeof pageReference === 'number') {
    return null;
  }

  const pageIndex = await documentHandle.getPageIndex(pageReference);
  return pageIndex + 1;
}

async function findDetailedProgramPage(documentHandle: any) {
  const outline = await documentHandle.getOutline();

  if (!outline) {
    throw new Error('PDF outline is missing.');
  }

  for (const item of outline) {
    if (!item.title.toLowerCase().includes('detailed program')) {
      continue;
    }

    const pageNumber = await resolveDestinationPage(documentHandle, item.dest);
    if (pageNumber) {
      return pageNumber;
    }
  }

  throw new Error('Could not resolve the "Detailed program" section.');
}

function finalizeExercise(currentExercise: DraftExercise | null, currentProgram: DraftProgram | null) {
  if (!currentExercise || !currentProgram) {
    return null;
  }

  const description = normalizeWhitespace(currentExercise.descriptionLines.join(' ').replace(/\s+([.,;:!?])/g, '$1'));
  currentProgram.exercises.push({
    id: currentExercise.id,
    phaseId: currentExercise.phaseId,
    programId: currentExercise.programId,
    name: currentExercise.name,
    prescription: currentExercise.prescription,
    description,
    imageUrl: currentExercise.imageUrl,
    videoUrl: currentExercise.videoUrl,
    pageNumber: currentExercise.pageNumber,
  });

  return null;
}

function finalizeProgram(currentProgram: DraftProgram | null, phasePrograms: Program[]) {
  if (!currentProgram || currentProgram.exercises.length === 0) {
    return null;
  }

  phasePrograms.push(currentProgram);
  return null;
}

async function extractPhase(sourcePhase: SourcePhase): Promise<Phase> {
  const sourcePath = path.resolve(process.cwd(), sourcePhase.fileName);
  const fileBytes = fs.readFileSync(sourcePath);
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(fileBytes),
    disableWorker: true,
    useSystemFonts: true,
  } as any);
  const documentHandle = await loadingTask.promise;
  const detailedProgramStartPage = await findDetailedProgramPage(documentHandle);
  const programs: Program[] = [];

  let currentProgram: DraftProgram | null = null;
  let currentExercise: DraftExercise | null = null;
  let programCount = 0;
  let exerciseCount = 0;

  for (let pageNumber = detailedProgramStartPage; pageNumber <= documentHandle.numPages; pageNumber += 1) {
    const page = await documentHandle.getPage(pageNumber);
    const [textContent, annotations] = await Promise.all([page.getTextContent(), page.getAnnotations()]);
    const lines = groupLines(textContent.items as any[]);
    const pageLinks = toUniquePageLinks(annotations);
    let pageLinkIndex = 0;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];

      if (isHeaderOrFooter(line)) {
        continue;
      }

      if (isProgramHeading(line)) {
        currentExercise = finalizeExercise(currentExercise, currentProgram);
        currentProgram = finalizeProgram(currentProgram, programs);
        programCount += 1;
        currentProgram = {
          id: `${sourcePhase.id}-${slugify(line.text) || `program-${programCount}`}`,
          phaseId: sourcePhase.id,
          name: line.text,
          exercises: [],
        };
        continue;
      }

      const nextLine = lines[index + 1];

      if (isExerciseStart(line, nextLine)) {
        currentExercise = finalizeExercise(currentExercise, currentProgram);

        if (!currentProgram) {
          programCount += 1;
          currentProgram = {
            id: `${sourcePhase.id}-program-${programCount}`,
            phaseId: sourcePhase.id,
            name: sourcePhase.label,
            exercises: [],
          };
        }

        exerciseCount += 1;
        currentExercise = {
          id: `${sourcePhase.id}-${slugify(currentProgram.name)}-${slugify(line.text) || `exercise-${exerciseCount}`}`,
          phaseId: sourcePhase.id,
          programId: currentProgram.id,
          name: line.text,
          prescription: nextLine.text,
          descriptionLines: [],
          imageUrl: null,
          videoUrl: null,
          pageNumber,
        };
        index += 1;
        continue;
      }

      if (!currentExercise) {
        continue;
      }

      if (/Video explanation/i.test(line.text)) {
        while (currentExercise.videoUrl && pageLinks[pageLinkIndex] === currentExercise.videoUrl) {
          pageLinkIndex += 1;
        }

        if (!currentExercise.videoUrl && pageLinks[pageLinkIndex]) {
          currentExercise.videoUrl = pageLinks[pageLinkIndex];
          pageLinkIndex += 1;
        }
      }

      const sanitizedLine = sanitizeDescriptionLine(line.text);
      if (!sanitizedLine || sanitizedLine === currentExercise.prescription) {
        continue;
      }

      currentExercise.descriptionLines.push(sanitizedLine);
    }
  }

  currentExercise = finalizeExercise(currentExercise, currentProgram);
  currentProgram = finalizeProgram(currentProgram, programs);

  return {
    id: sourcePhase.id,
    label: sourcePhase.label,
    sourceFile: sourcePhase.fileName,
    programs,
  };
}

async function main() {
  const phases = [] as Phase[];

  for (const sourcePhase of SOURCE_PHASES) {
    phases.push(await extractPhase(sourcePhase));
  }

  const output: TrainingData = {
    generatedAt: new Date().toISOString(),
    phases,
  };

  const outputPath = path.resolve(process.cwd(), 'src/data/training-data.generated.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Generated ${outputPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});