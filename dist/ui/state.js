export function initialUiState() {
    return {
        // Needs You, not All. The queue exists to be acted on, and opening on a
        // mixed list asks a reader to find the actionable items before starting.
        filter: "needs_you",
        redAlertsOnly: false,
        openCardId: null,
        openMenuId: null,
        overrides: {},
    };
}
export function setFilter(state, filter) {
    return { ...state, filter };
}
export function toggleRedAlerts(state) {
    return { ...state, redAlertsOnly: !state.redAlertsOnly };
}
export function openCard(state, id) {
    return { ...state, openCardId: id };
}
export function closeCard(state) {
    return { ...state, openCardId: null };
}
/**
 * Opens one card's overflow menu, or shuts it if it was already the open one.
 * Opening a second closes the first, since openMenuId holds only one id.
 */
export function toggleMenu(state, id) {
    return { ...state, openMenuId: state.openMenuId === id ? null : id };
}
export function closeMenu(state) {
    return { ...state, openMenuId: null };
}
/** Records a decision and closes the modal, which is always what follows one. */
export function applyDecision(state, id, status, note, entry, baseStatus) {
    return {
        ...state,
        openCardId: null,
        // A decision reached through the overflow menu closes that menu with it;
        // one taken elsewhere leaves a menu open on another card alone.
        openMenuId: state.openMenuId === id ? null : state.openMenuId,
        overrides: { ...state.overrides, [id]: { status, note, entry, baseStatus } },
    };
}
const DEFAULT_NOTE = {
    needs_you: "",
    waiting: "Waiting on Highland.",
    sent: "Sent — no action needed.",
    closed: "Closed.",
};
function derive(item, override, menuOpen, siblings = []) {
    const status = override?.status ?? item.status;
    return {
        ...item,
        status,
        // A decided card shows what the decision did, as the newest history line.
        // New array, never a push — item.history belongs to the source's payload.
        history: override ? [...item.history, override.entry] : item.history,
        hasAlert: Boolean(item.flag),
        isNeedsYou: status === "needs_you",
        // A local decision first, then what the payload says about a resolved
        // item, then the generic line for its status.
        noteText: override?.note ?? item.note ?? DEFAULT_NOTE[status],
        menuOpen,
        siblings,
    };
}
/**
 * Pure projection of the payload through the current UI state. Counts are of
 * everything, so the chips keep showing the whole picture while filtered.
 */
/** Still needing attention, as opposed to decided or already under way. */
const LIVE = ["needs_you", "waiting"];
export function deriveView(actions, state) {
    // Two passes. The first settles every status through its override, because
    // a card's siblings depend on what is live AFTER local decisions, not on
    // what the payload said. The second hands each card the others.
    const settled = actions.map((a) => ({
        item: a,
        status: state.overrides[a.id]?.status ?? a.status,
    }));
    const siblingsFor = (item) => item.caseRef === undefined
        ? []
        : settled
            .filter((o) => o.item.id !== item.id &&
            o.item.caseRef === item.caseRef &&
            LIVE.includes(o.status))
            .map((o) => ({ id: o.item.id, title: o.item.title }));
    const all = actions.map((a) => derive(a, state.overrides[a.id], state.openMenuId === a.id, siblingsFor(a)));
    const counts = {
        all: all.length,
        // Filled by the caller: deriveView projects actions, and completed work
        // and onboarding state are different reads this function is not given.
        completed: 0,
        cases: 0,
        needs_you: all.filter((c) => c.status === "needs_you").length,
        waiting: all.filter((c) => c.status === "waiting").length,
        sent: all.filter((c) => c.status === "sent").length,
        closed: all.filter((c) => c.status === "closed").length,
    };
    let cards = all;
    if (state.filter !== "all" &&
        state.filter !== "completed" &&
        state.filter !== "cases") {
        cards = cards.filter((c) => c.status === state.filter);
    }
    if (state.redAlertsOnly)
        cards = cards.filter((c) => c.hasAlert);
    const open = state.openCardId
        ? all.find((c) => c.id === state.openCardId) ?? null
        : null;
    return { counts, cards, openCard: open };
}
/**
 * Folds a freshly fetched payload against the decisions taken locally.
 *
 * A local decision is an intent, not a fact — the systems of record are.
 * So when the source comes back and an item has moved on its own (someone
 * fixed it in PropertyMe, a deposit cleared, a certificate arrived), the
 * local override is dropped and upstream wins. An item that has not moved
 * keeps its override, so a decision does not flicker back to undecided on
 * every refetch.
 *
 * An item that has disappeared upstream takes its override with it, or the
 * map would grow orphans for the life of the session.
 *
 * Returns the state unchanged — same object — when nothing needed dropping,
 * so callers can use identity to decide whether to re-render.
 */
export function reconcile(fresh, state) {
    const upstream = new Map(fresh.map((a) => [a.id, a.status]));
    const kept = {};
    let dropped = 0;
    for (const [id, override] of Object.entries(state.overrides)) {
        const now = upstream.get(id);
        if (now !== undefined && now === override.baseStatus)
            kept[id] = override;
        else
            dropped++;
    }
    if (dropped === 0)
        return state;
    return {
        ...state,
        overrides: kept,
        // A card that no longer exists upstream must not stay open over nothing.
        openCardId: state.openCardId && upstream.has(state.openCardId) ? state.openCardId : null,
    };
}
/**
 * Completed work, most recent first.
 *
 * `time` is display-ready rather than a timestamp — the contract says so, and
 * the payload carries values like "Yesterday" alongside "14:36". So this
 * parses the clock form and orders on that, and anything it cannot parse
 * keeps its payload position at the end rather than being sorted on the
 * accident of its spelling. A stable sort, so equal times stay as authored.
 *
 * The queue is not sorted here: those cards are ordered by what needs doing,
 * not by when it happened, and their own filter already governs them.
 */
export function byMostRecent(items) {
    const minutes = (time) => {
        const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
        if (!m)
            return null;
        const h = Number(m[1]);
        const min = Number(m[2]);
        if (h > 23 || min > 59)
            return null;
        return h * 60 + min;
    };
    return items
        .map((item, index) => ({ item, index, at: minutes(item.time) }))
        .sort((a, b) => {
        if (a.at === null && b.at === null)
            return a.index - b.index;
        if (a.at === null)
            return 1;
        if (b.at === null)
            return -1;
        return b.at - a.at || a.index - b.index;
    })
        .map((entry) => entry.item);
}
/**
 * Seeds state from decisions that were stored on a previous visit.
 *
 * Applies the same test reconcile() applies to a refetch, and for the same
 * reason: a stored decision is an intent, the source is the truth. So a
 * decision is restored only where the item still exists AND its upstream
 * status is still what the decision was taken against. Anything else was
 * overtaken while the tab was closed, and restoring it would show a reader
 * their own stale answer as though it were current.
 *
 * Returns the ids that were NOT restored, so the caller can drop them from
 * storage rather than re-testing them on every load forever.
 */
export function restoreDecisions(actions, decisions, state) {
    const upstream = new Map(actions.map((a) => [a.id, a.status]));
    const overrides = { ...state.overrides };
    const stale = [];
    for (const d of decisions) {
        if (upstream.get(d.id) === d.baseStatus) {
            overrides[d.id] = {
                status: d.status,
                note: d.note,
                entry: d.entry,
                baseStatus: d.baseStatus,
            };
        }
        else {
            stale.push(d.id);
        }
    }
    return { state: { ...state, overrides }, stale };
}
/**
 * Projects onboarding state through the queue.
 *
 * The payload says which stage a case has reached. Whether that stage is
 * BLOCKED is not the payload's to say — it is whatever is still open on the
 * same caseRef, read through local decisions. Computing it here rather than
 * declaring it means the two views cannot disagree about why a property is
 * stuck, and that resolving the last open item unblocks the stage on screen
 * without anything else being told.
 */
export function deriveCases(cases, actions, state) {
    return cases.map((c) => {
        const blockers = actions
            .filter((a) => a.caseRef === c.ref &&
            LIVE.includes(state.overrides[a.id]?.status ?? a.status))
            .map((a) => ({ id: a.id, title: a.title }));
        return {
            ...c,
            blockers,
            stages: c.stages.map((stage) => ({
                ...stage,
                blocked: stage.state === "current" && blockers.length > 0,
            })),
        };
    });
}
