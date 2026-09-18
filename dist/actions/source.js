/**
 * Builds an ActionSource backed by a payload already in hand. This is the
 * unit a caller uses when it has parsed JSON itself; `fetchedActionSource`
 * wraps it for the common case of loading that payload over HTTP.
 *
 * Returns a shallow copy of the actions array: the array itself is fresh per
 * call, but items are shared references. The UI should not mutate item
 * properties; decisions live in UI state as overrides instead.
 */
export function staticActionSource(payload) {
    return async () => [...payload.actions];
}
/**
 * Builds an ActionSource that loads its payload from `url`. This is the
 * implementation the UI binds today, and the one a Highland-backed
 * ActionSource replaces — the HTTP concern lives behind the signature rather
 * than in the caller, so the swap really is one binding in app.ts.
 *
 * Only structural failures throw here (unreachable URL, non-payload JSON).
 * Field-level problems are the caller's to report, via
 * `validateActionsPayload` on what this returns.
 */
export function fetchedActionSource(url) {
    return async () => {
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Could not load ${url}: ${res.status} ${res.statusText}`);
        }
        const payload = (await res.json());
        if (!payload || !Array.isArray(payload.actions)) {
            throw new Error(`${url} is not an actions payload: no actions array`);
        }
        return staticActionSource(payload)();
    };
}
/**
 * The completed-work counterpart to staticActionSource. Absent `completed`
 * yields an empty list rather than throwing: a payload that only describes
 * exceptions is legitimate, and the UI shows no completed section for it.
 */
export function staticCompletedSource(payload) {
    return async () => [...(payload.completed ?? [])];
}
/** The completed-work counterpart to fetchedActionSource. */
export function fetchedCompletedSource(url) {
    return async () => {
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Could not load ${url}: ${res.status} ${res.statusText}`);
        }
        const payload = (await res.json());
        return staticCompletedSource(payload)();
    };
}
