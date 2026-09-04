/**
 * Pluggable interface for automatic circular collection. See
 * docs/CIRCULAR-INGESTION.md — no adapter implementing this is wired up or
 * enabled by default. This codebase does not assume an undocumented DPSA
 * API exists and does not scrape a protected system blindly; enabling this
 * for a specific source is a deliberate, separately-reviewed operational
 * decision, not something shipped switched on.
 */
export interface CircularSource {
  listAvailableCirculars(): Promise<
    { circularNumber: string; publicationDate: string; sourceUrl: string }[]
  >;
  fetchCircularPdf(sourceUrl: string): Promise<Buffer>;
}
