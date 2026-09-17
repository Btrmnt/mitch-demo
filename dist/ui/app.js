import { fetchedActionSource } from "../actions/source.js?v=eaa84f3";
import { validateActionsPayload } from "../actions/validate.js?v=eaa84f3";
import { chipRow, cardGrid, modal, issueScreen } from "./components.js?v=eaa84f3";
import { showToast } from "./toast.js?v=eaa84f3";
import { initMasonry, relayoutMasonry } from "./masonry.js?v=eaa84f3";
import { initialUiState, deriveView, setFilter, toggleRedAlerts, applyDecision, closeCard, openCard, toggleMenu, closeMenu, reconcile, } from "./state.js?v=eaa84f3";
// Relative, not root-absolute: the same tree is served both at a host
// root (the dev server, the gated deploy) and under a path prefix
// (GitHub Pages serves a project repo at /<repo>/). A leading slash
// resolves to the host root in the second case and 404s.
const PAYLOAD_URL = "./src/data/highland-mitch-actions.json?v=eaa84f3";
let state = initialUiState();
let actions = [];
/**
 * Module-scoped so refresh() can reach it. The swap point is still one
 * binding — main() assigns it — but reads now happen from two places: once
 * at startup and again whenever the reader comes back from another system.
 */
let source = null;
/** The upstream status of an item, i.e. before any local decision. */
function upstreamStatus(id) {
    return actions.find((a) => a.id === id)?.status ?? "needs_you";
}
/**
 * Re-reads the source and folds it against local decisions.
 *
 * The trigger is the reader coming back to this tab. Someone who fixes a fee
 * in PropertyMe and switches back should not have to tell Mitch what they
 * just did — the systems of record are the truth, and reconcile() drops any
 * local decision the source has overtaken.
 *
 * Failures are swallowed on purpose. This runs on every tab focus, and a
 * refetch that 404s or returns something malformed must leave the screen
 * exactly as it was rather than replacing a working queue with an error.
 */
let refreshing = false;
async function refresh() {
    if (refreshing || source === null || document.hidden)
        return;
    refreshing = true;
    try {
        const fresh = await source();
        if (validateActionsPayload({ actions: fresh }).length > 0)
            return;
        const changed = fresh.length !== actions.length ||
            fresh.some((a, i) => a.id !== actions[i]?.id || a.status !== actions[i]?.status);
        const before = state;
        actions = fresh;
        state = reconcile(fresh, state);
        if (changed || state !== before) {
            render();
            showToast("Updated from the source systems.");
        }
    }
    catch {
        // Keep what is on screen.
    }
    finally {
        refreshing = false;
    }
}
function render() {
    const view = deriveView(actions, state);
    const root = document.getElementById("app");
    if (!root)
        return;
    root.innerHTML = `
    <header class="app-header">
      <div class="app-title">Mitch Actions</div>
      <div class="chip-row">${chipRow(view.counts, state.filter, state.redAlertsOnly)}</div>
    </header>
    <main class="queue">
      ${cardGrid(view.cards)}
    </main>
    ${modal(view.openCard)}
  `;
    // The grid's markup is in the document now, so the cards can be measured
    // and packed. Layout has to follow every render because render() rebuilds
    // the grid wholesale and the new cards come back in plain CSS-grid flow.
    relayoutMasonry();
}
/**
 * Delegated click handling, attached once to the stable #app container
 * during startup — never inside render(). render() reassigns innerHTML on
 * every state change, so a listener attached there would be re-added each
 * time and accumulate without bound. Later tasks add more `data-action`
 * branches to this same handler.
 *
 * The Escape key is bound here too, on the document rather than #app,
 * because the modal is dismissable no matter what currently holds focus.
 *
 * Each branch only reassigns `state`; the single render at the end runs if
 * anything changed. Every transition returns a new object, so identity is a
 * reliable dirty check — and it means a click that both dismisses a menu and
 * does something else renders once, not twice.
 */
/**
 * Clock label for a decision's history line, in the display-ready form the
 * payload uses ("09:14"). Built here, not in state.ts, so that module stays a
 * pure function of its inputs — a clock read inside it would make every
 * transition untestable.
 */
function nowLabel() {
    return new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
}
function bindEvents(root) {
    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape")
            return;
        // Escape dismisses whatever is open: the overflow menu first, since it is
        // the shallower of the two and they are never open together.
        if (state.openMenuId !== null)
            state = closeMenu(state);
        else if (state.openCardId !== null)
            state = closeCard(state);
        else
            return;
        render();
    });
    root.addEventListener("click", (event) => {
        const target = event.target;
        const el = target.closest("[data-action]");
        const before = state;
        const { action, value, id } = el?.dataset ?? {};
        const inMenu = Boolean(target.closest(".card-menu"));
        // Clicking anywhere outside an open menu dismisses it, and that click is
        // consumed by the dismissal rather than also doing whatever it landed
        // on — otherwise a click on the card behind the menu would open the
        // detail view on the way past.
        if (state.openMenuId !== null && action !== "toggle-menu" && !inMenu) {
            state = closeMenu(state);
            render();
            return;
        }
        if (action === "filter") {
            state = value === "alerts"
                ? toggleRedAlerts(state)
                : setFilter(state, value);
        }
        if (action === "toggle-menu" && id) {
            state = toggleMenu(state, id);
        }
        if (action === "open" && id) {
            state = openCard(state, id);
        }
        if (action === "dismiss" && el === target) {
            state = closeCard(state);
        }
        // Approve and close-handled are different outcomes and land on different
        // statuses. Both used to resolve to "closed", which left the Sent column
        // unreachable and erased the distinction between "Mitch is acting on
        // this" and "someone dealt with it elsewhere".
        if (action === "approve" && id) {
            state = applyDecision(state, id, "sent", "Sent — Mitch is entering it in PropertyMe.", { time: nowLabel(),
                text: "Approved by you — Mitch is entering it in PropertyMe" }, upstreamStatus(id));
        }
        if (action === "close-handled" && id) {
            state = applyDecision(state, id, "closed", "Closed — handled outside Mitch.", { time: nowLabel(), text: "Closed by you — handled outside Mitch" }, upstreamStatus(id));
        }
        // A link to a system of record. With no url — which is every link in the
        // demo payloads — the button says what it would do rather than going
        // nowhere. This writes no state, so it is handled here and returns
        // before the identity check below.
        if (action === "open-system" && id) {
            const link = actions.find((a) => a.id === id)?.links?.[Number(el?.dataset.link)];
            if (link) {
                if (link.url)
                    window.open(link.url, "_blank", "noopener,noreferrer");
                else
                    showToast(link.opens);
            }
        }
        // "assign", "redirect" and "not-managed" still write no state — the
        // routing they describe needs a backend. They are no longer silent,
        // though: shown openly in the modal's tertiary rail, a click that did
        // nothing at all read as a broken button. Each says what it would do,
        // the same way a system-of-record link does.
        const ROUTING = {
            assign: "Opens a teammate picker. The action moves to their queue and stays open until they resolve it.",
            redirect: "Sends this action to another queue. Mitch keeps watching the source in case it resolves itself first.",
            "not-managed": "Marks this property as not managed by Highland. Mitch stops raising actions against it.",
        };
        if (action && ROUTING[action])
            showToast(ROUTING[action]);
        // Every menu item is terminal, so any click inside the menu shuts it.
        if (inMenu)
            state = closeMenu(state);
        if (state !== before)
            render();
    });
}
async function main() {
    // The swap point. A Highland-backed ActionSource replaces the right-hand
    // side of this one binding and nothing else here changes; the annotation
    // is what makes TypeScript check that whatever is bound conforms.
    source = fetchedActionSource(PAYLOAD_URL);
    const loaded = await source();
    // The runtime half of check:actions, at the source boundary. That check
    // only runs at authoring time over files in this repo; a live source's
    // output is not authored here. Rendering an item with an unknown status
    // throws before anything reaches the screen, so bad data stops here and
    // says why instead of failing silently.
    const issues = validateActionsPayload({ actions: loaded });
    const root = document.getElementById("app");
    if (!root)
        return;
    if (issues.length) {
        root.innerHTML = issueScreen(issues);
        return;
    }
    actions = loaded;
    bindEvents(root);
    // The resize listener, attached once here for the same reason the click and
    // keydown listeners are — never from inside render().
    initMasonry();
    // Coming back to this tab is the signal that something may have changed
    // elsewhere. Both events fire in practice — visibilitychange when Teams
    // switches tabs, focus when the window itself regains it — and refresh()
    // guards against overlapping runs.
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden)
            void refresh();
    });
    window.addEventListener("focus", () => void refresh());
    render();
}
main().catch((err) => {
    const root = document.getElementById("app");
    if (root)
        root.textContent = `Failed to start: ${String(err)}`;
});
