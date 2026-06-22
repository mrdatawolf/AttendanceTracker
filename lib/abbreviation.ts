function cleanName(s: string): string {
  return s.replace(/[^A-Za-z]/g, '').toUpperCase();
}

/**
 * Generate a unique 3-letter abbreviation from a first and last name.
 * Tries natural candidates first (initials-based), then an exhaustive
 * suffix sweep, returning the first one not in `existing`.
 * Returns null only if all combinations are taken (extremely unlikely).
 */
export function generateUniqueAbbreviation(
  firstName: string,
  lastName: string,
  existing: Set<string>
): string | null {
  const F = cleanName(firstName);
  const L = cleanName(lastName);

  const seen = new Set<string>();
  const candidates: string[] = [];

  const add = (s: string) => {
    if (s.length === 3 && !seen.has(s)) {
      seen.add(s);
      candidates.push(s);
    }
  };

  // Natural name-based candidates
  if (F && L.length >= 2) add(F[0] + L[0] + L[1]);      // JSM  (John Smith)
  if (F.length >= 2 && L) add(F[0] + F[1] + L[0]);      // JOS
  if (L.length >= 3)      add(L[0] + L[1] + L[2]);      // SMI
  if (F.length >= 3)      add(F[0] + F[1] + F[2]);      // JOH

  // Exhaustive sweep: first initial + last initial + suffix A-Z, then interleaved
  const f0 = F[0] || '';
  const l0 = L[0] || '';
  if (f0 && l0) {
    for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') add(f0 + l0 + c);
    for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') add(f0 + c + l0);
  }

  for (const candidate of candidates) {
    if (!existing.has(candidate)) return candidate;
  }

  return null;
}
