export function initialUiState() {
    return {
        filter: "all",
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
export function applyDecision(state, id, status, note, entry) {
    return {
        ...state,
        openCardId: null,
        // A decision reached through the overflow menu closes that menu with it;
        // one taken elsewhere leaves a menu open on another card alone.
        openMenuId: state.openMenuId === id ? null : state.openMenuId,
        overrides: { ...state.overrides, [id]: { status, note, entry } },
    };
}
const DEFAULT_NOTE = {
    needs_you: "",
    waiting: "Waiting on Highland.",
    sent: "Sent — no action needed.",
    closed: "Closed.",
};
function derive(item, override, menuOpen) {
    const status = override?.status ?? item.status;
    return {
        ...item,
        status,
        // A decided card shows what the decision did, as the newest history line.
        // New array, never a push — item.history belongs to the source's payload.
        history: override ? [...item.history, override.entry] : item.history,
        hasAlert: Boolean(item.flag),
        isNeedsYou: status === "needs_you",
        noteText: override?.note ?? DEFAULT_NOTE[status],
        menuOpen,
    };
}
/**
 * Pure projection of the payload through the current UI state. Counts are of
 * everything, so the chips keep showing the whole picture while filtered.
 */
export function deriveView(actions, state) {
    const all = actions.map((a) => derive(a, state.overrides[a.id], state.openMenuId === a.id));
    const counts = {
        all: all.length,
        needs_you: all.filter((c) => c.status === "needs_you").length,
        waiting: all.filter((c) => c.status === "waiting").length,
        sent: all.filter((c) => c.status === "sent").length,
        closed: all.filter((c) => c.status === "closed").length,
    };
    let cards = all;
    if (state.filter !== "all")
        cards = cards.filter((c) => c.status === state.filter);
    if (state.redAlertsOnly)
        cards = cards.filter((c) => c.hasAlert);
    const open = state.openCardId
        ? all.find((c) => c.id === state.openCardId) ?? null
        : null;
    return { counts, cards, openCard: open };
}
