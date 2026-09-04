const MONTHS: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

/**
 * Parses the date formats actually seen in Public Service Vacancy
 * Circulars ("31 January 2026", "2026/01/31", "31/01/2026"). Returns an
 * ISO date string or null — never a guess.
 */
export function parseCircularDate(text: string): string | null {
  const cleaned = text.trim();

  const textMonth = cleaned.match(/(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})/);
  if (textMonth) {
    const [, day, monthName, year] = textMonth;
    const month = MONTHS[monthName!.toLowerCase()];
    if (month !== undefined) {
      return toIsoDate(Number(year), month, Number(day));
    }
  }

  const isoLike = cleaned.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (isoLike) {
    const [, year, month, day] = isoLike;
    return toIsoDate(Number(year), Number(month) - 1, Number(day));
  }

  const ddmmyyyy = cleaned.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return toIsoDate(Number(year), Number(month) - 1, Number(day));
  }

  return null;
}

function toIsoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month, day));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}
