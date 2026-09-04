import type { CircularSource } from "../sources/types.js";
import { processCircularPdf, type CircularProcessingResult } from "../pipeline.js";

export interface CollectedCircular {
  circularNumber: string;
  publicationDate: string;
  sourceUrl: string;
  processed: CircularProcessingResult;
}

/**
 * The weekly automatic-collection job. Takes whatever `CircularSource` the
 * operator has configured — there is no default implementation — and runs
 * every circular it hasn't seen before through the same extraction
 * pipeline manual uploads use. `seenCircularNumbers` is the caller's job
 * (in practice: the existing `circulars.circular_number` values already in
 * Postgres), kept out of this module so it has no direct database
 * dependency.
 *
 * Not scheduled anywhere in this codebase yet — wiring this into an actual
 * cron/queue is a deployment decision for whoever operates the service,
 * made once a real, permitted `CircularSource` exists.
 */
export async function collectNewCirculars(
  source: CircularSource,
  seenCircularNumbers: ReadonlySet<string>,
): Promise<CollectedCircular[]> {
  const available = await source.listAvailableCirculars();
  const results: CollectedCircular[] = [];

  for (const circular of available) {
    if (seenCircularNumbers.has(circular.circularNumber)) continue;
    const pdfBytes = await source.fetchCircularPdf(circular.sourceUrl);
    const processed = await processCircularPdf(pdfBytes);
    results.push({ ...circular, processed });
  }

  return results;
}
