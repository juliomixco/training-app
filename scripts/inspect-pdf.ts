import fs from "node:fs";
import path from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

type OutlineNode = {
  title: string;
  depth: number;
  pageNumber: number | null;
};

type TextLine = {
  y: number;
  text: string;
};

async function resolveDestinationPage(
  documentHandle: any,
  destination: unknown,
): Promise<number | null> {
  if (!destination) {
    return null;
  }

  const resolvedDestination =
    typeof destination === "string"
      ? await documentHandle.getDestination(destination)
      : destination;

  if (!resolvedDestination) {
    return null;
  }

  const pageReference = resolvedDestination[0];
  if (!pageReference || typeof pageReference === "number") {
    return null;
  }

  const pageIndex = await documentHandle.getPageIndex(pageReference);
  return pageIndex + 1;
}

async function flattenOutline(
  documentHandle: any,
  items: Array<any> | null,
  depth = 0,
): Promise<OutlineNode[]> {
  if (!items) {
    return [];
  }

  const collected: OutlineNode[] = [];
  for (const item of items) {
    collected.push({
      title: item.title,
      depth,
      pageNumber: await resolveDestinationPage(documentHandle, item.dest),
    });

    const children = await flattenOutline(
      documentHandle,
      item.items,
      depth + 1,
    );
    collected.push(...children);
  }

  return collected;
}

function groupLines(items: any[]): TextLine[] {
  const grouped = new Map<number, string[]>();

  for (const item of items) {
    const y = Math.round(item.transform[5]);
    const existingKey =
      [...grouped.keys()].find((key) => Math.abs(key - y) <= 2) ?? y;
    if (
      !("str" in item) ||
      typeof item.str !== "string" ||
      !Array.isArray(item.transform) ||
      typeof item.height !== "number"
    ) {
      continue;
    }

    const value = item.str.replace(/\s+/g, " ").trim();

    if (!value) {
      continue;
    }

    const current = grouped.get(existingKey) ?? [];
    current.push(value);
    grouped.set(existingKey, current);
  }

  return [...grouped.entries()]
    .sort((left, right) => right[0] - left[0])
    .map(([y, segments]) => ({
      y,
      text: segments.join(" ").replace(/\s+/g, " ").trim(),
    }));
}

async function main() {
  const inputPath = process.argv[2] ?? "Phase 1.pdf";
  const absolutePath = path.resolve(process.cwd(), inputPath);
  const buffer = fs.readFileSync(absolutePath);

  const documentTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    useSystemFonts: true,
  } as any);
  const documentHandle = await documentTask.promise;

  console.log(`PDF: ${path.basename(absolutePath)}`);
  console.log(`Pages: ${documentHandle.numPages}`);

  const outline = await flattenOutline(
    documentHandle,
    await documentHandle.getOutline(),
  );
  console.log("\nOutline sample:");
  for (const item of outline.slice(0, 20)) {
    console.log(
      `${"  ".repeat(item.depth)}- ${item.title} (page ${item.pageNumber ?? "?"})`,
    );
  }

  const detailedProgram = outline.find((item) =>
    item.title.toLowerCase().includes("detailed program"),
  );

  if (!detailedProgram?.pageNumber) {
    throw new Error(
      'Could not resolve a "Detailed program" outline destination.',
    );
  }

  const detailedProgramPageNumber = detailedProgram.pageNumber;
  const nextSection = outline.find(
    (item) =>
      item.pageNumber !== null &&
      item.pageNumber > detailedProgramPageNumber &&
      item.depth <= detailedProgram.depth,
  );
  const lastPage = Math.min(
    nextSection?.pageNumber ?? documentHandle.numPages + 1,
    detailedProgram.pageNumber + 3,
  );

  console.log(
    `\nDetailed program starts on page ${detailedProgramPageNumber}.`,
  );
  console.log(
    `Inspecting pages ${detailedProgramPageNumber} to ${lastPage - 1}.`,
  );

  for (
    let pageNumber = detailedProgramPageNumber;
    pageNumber < lastPage;
    pageNumber += 1
  ) {
    const page = await documentHandle.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const lines = groupLines(textContent.items as any[]);

    console.log(`\n--- Page ${pageNumber} ---`);
    for (const line of lines.slice(0, 30)) {
      console.log(line.text);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
