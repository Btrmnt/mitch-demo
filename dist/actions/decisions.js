const KEY = "mitch.decisions.v1";
/**
 * Decisions kept in browser storage.
 *
 * Every operation is wrapped: localStorage throws on access in a private
 * window and in some embedded webviews, which is precisely where a demo runs.
 * A store that cannot persist must degrade to one that forgets, never to a
 * screen that will not load — so a failed read yields no decisions and a
 * failed write is dropped silently.
 *
 * Unparseable or wrong-shaped content is discarded rather than repaired. It
 * can only come from a previous version of this code or from someone editing
 * storage by hand, and guessing at what a half-written decision meant is
 * worse than losing it.
 */
export function storageDecisionStore(storage, key = KEY) {
    const read = () => {
        try {
            const raw = storage.getItem(key);
            if (!raw)
                return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed))
                return [];
            return parsed.filter(isDecision);
        }
        catch {
            return [];
        }
    };
    const write = (decisions) => {
        try {
            storage.setItem(key, JSON.stringify(decisions));
        }
        catch {
            // Quota, private mode, or a webview with storage disabled. The session
            // continues without persistence.
        }
    };
    return {
        load: async () => read(),
        save: async (decision) => {
            // One decision per action: a second replaces the first rather than
            // appending, so the log cannot disagree with itself about one card.
            write([...read().filter((d) => d.id !== decision.id), decision]);
        },
        forget: async (ids) => {
            if (!ids.length)
                return;
            const drop = new Set(ids);
            write(read().filter((d) => !drop.has(d.id)));
        },
    };
}
/** Structural check, because stored JSON is input like any other. */
function isDecision(value) {
    const d = value;
    return (!!d &&
        typeof d.id === "string" && d.id.length > 0 &&
        typeof d.status === "string" &&
        typeof d.note === "string" &&
        typeof d.baseStatus === "string" &&
        typeof d.at === "string" &&
        !!d.entry &&
        typeof d.entry.time === "string" &&
        typeof d.entry.text === "string");
}
