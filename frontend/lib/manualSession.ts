"use client";

/** The measurements the user last built an avatar from, kept in this browser only.
 *
 *  The service drops a session after an hour and on restart, so without this a reload
 *  would silently lose both the numbers and the model built from them. The values are
 *  the user's own input, nothing derived: the form can always be re-filled from them.
 */
export type SavedReference = {
  values: Partial<Record<string, number | null>>;
  height_cm?: number;
  /** "manual" or "photos": how the original session was produced. */
  origin?: string;
};

export type SavedManualSession = {
  jobId?: string;
  values: Partial<Record<string, number | null>>;
  /** The original measurements this comparison is judged against; adjustments never touch it. */
  reference?: SavedReference;
};

const STORAGE_KEY = "fity-manual-measurements-v1";

function read(): SavedManualSession | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return null;
    const { jobId, values, reference } = parsed as SavedManualSession;
    if (!values || typeof values !== "object") return null;
    const cleanReference =
      reference && typeof reference === "object" && reference.values && typeof reference.values === "object"
        ? { values: reference.values, height_cm: reference.height_cm, origin: reference.origin }
        : undefined;
    return { jobId: typeof jobId === "string" ? jobId : undefined, values, reference: cleanReference };
  } catch {
    return null;
  }
}

function write(session: SavedManualSession | null) {
  if (typeof window === "undefined") return;
  try {
    if (session && Object.keys(session.values).length) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function loadManualSession(): SavedManualSession | null {
  return read();
}

export function saveManualSession(values: Partial<Record<string, number | null>>, jobId?: string) {
  // Keep the stored reference: a rebuild must never move the baseline it is judged against.
  const saved = read();
  write({ jobId, values, reference: saved?.reference });
}

/** Forget the session id but keep the numbers: they are still the user's measurements. */
export function detachManualJob() {
  const saved = read();
  if (saved) write({ values: saved.values, reference: saved.reference });
}

/**
 * Record the measurements everything else is judged against.
 *
 * Set when a session is first built (scan or full manual entry) and deliberately left
 * alone by an adjustment, so the comparison keeps its original baseline.
 */
export function saveManualReference(reference: SavedReference) {
  const saved = read();
  const values = saved && Object.keys(saved.values || {}).length ? saved.values : reference.values;
  write({ jobId: saved?.jobId, values, reference });
}

export function loadManualReference(): SavedReference | null {
  return read()?.reference ?? null;
}

export function clearManualSession() {
  write(null);
}
