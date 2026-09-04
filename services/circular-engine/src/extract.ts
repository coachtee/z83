export interface ExtractedVacancyBlock {
  departmentName: string;
  pageNumber: number;
  rawText: string;
  fields: Record<string, string>;
}

const FIELD_LABELS = [
  "POST",
  "SALARY",
  "CENTRE",
  "LOCATION",
  "REF NO",
  "REFERENCE NO",
  "REQUIREMENTS",
  "DUTIES",
  "COMPETENCIES",
  "KNOWLEDGE",
  "ENQUIRIES",
  "APPLICATIONS",
  "CLOSING DATE",
  "NOTE",
] as const;

const FIELD_LINE_PATTERN = new RegExp(
  `^\\s*(${FIELD_LABELS.join("|")})\\s*:?\\s*(.*)$`,
  "i",
);

const DEPARTMENT_HEADING_PATTERN = /^(DEPARTMENT OF|OFFICE OF THE|NATIONAL |PROVINCIAL )/i;

/**
 * Splits per-page circular text into per-vacancy blocks. Circulars don't
 * follow one rigid layout across departments, so this looks for recurring
 * markers ("POST :", "REF NO :", ...) rather than a fixed template — see
 * docs/CIRCULAR-INGESTION.md.
 */
export function extractVacancyBlocks(pageTexts: string[]): ExtractedVacancyBlock[] {
  const blocks: ExtractedVacancyBlock[] = [];
  let currentDepartment = "Unknown Department";
  let currentBlock: { pageNumber: number; lines: string[] } | null = null;
  // Department-level lines (typically APPLICATIONS / ENQUIRIES submission
  // instructions) that appear once before the list of posts and apply to
  // all of them — carried into every block until the department changes.
  let carryFields: string[] = [];

  const flush = () => {
    if (!currentBlock || currentBlock.lines.length === 0) return;
    const rawText = currentBlock.lines.join("\n");
    blocks.push({
      departmentName: currentDepartment,
      pageNumber: currentBlock.pageNumber,
      rawText,
      fields: parseFields(rawText),
    });
    currentBlock = null;
  };

  pageTexts.forEach((pageText, pageIndex) => {
    const pageNumber = pageIndex + 1;
    const lines = pageText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    for (const line of lines) {
      if (DEPARTMENT_HEADING_PATTERN.test(line) && line.length < 100) {
        flush();
        currentDepartment = line;
        carryFields = [];
        continue;
      }
      if (/^POST\s*:?/i.test(line)) {
        flush();
        currentBlock = { pageNumber, lines: [...carryFields, line] };
        continue;
      }
      if (currentBlock) {
        currentBlock.lines.push(line);
      } else {
        carryFields.push(line);
      }
    }
  });
  flush();

  return blocks;
}

function parseFields(rawText: string): Record<string, string> {
  const lines = rawText.split("\n");
  const fields: Record<string, string> = {};
  let currentLabel: string | null = null;

  for (const line of lines) {
    const match = line.match(FIELD_LINE_PATTERN);
    if (match) {
      currentLabel = normalizeLabel(match[1]!);
      fields[currentLabel] = (fields[currentLabel] ?? "") + match[2];
    } else if (currentLabel) {
      fields[currentLabel] += ` ${line}`;
    }
  }

  for (const key of Object.keys(fields)) {
    fields[key] = fields[key]!.trim();
  }
  return fields;
}

function normalizeLabel(label: string): string {
  const upper = label.toUpperCase();
  if (upper === "REFERENCE NO") return "REF NO";
  if (upper === "LOCATION") return "CENTRE";
  return upper;
}
