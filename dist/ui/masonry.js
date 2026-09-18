/**
 * The one piece of imperative DOM code in this build.
 *
 * Everything else in `src/ui` is a pure function returning an HTML string,
 * and `render()` writes those strings wholesale into `#app`. Layout is the
 * exception because the thing the owner asked for — true masonry, cards
 * placed in payload order into whichever column is currently shortest — is
 * not expressible in CSS today:
 *
 *   - `grid-template-rows: masonry` is not shipped in any stable browser.
 *   - `columns: 300px` flows **column-major**: the second card lands below
 *     the first instead of beside it. That was tried in an earlier build and
 *     rejected; the spec records it.
 *   - A plain `display: grid` keeps reading order but starts every row below
 *     the *tallest* card of the previous row, which is the gap the owner saw.
 *
 * So the column assignment is done here, in arithmetic, and the result is
 * written back as inline position styles.
 *
 * Two deliberate choices:
 *
 * 1. **Absolute positioning, not column wrappers.** Wrapping the cards in
 *    per-column `<div>`s would mean this module rewrites markup that
 *    `components.ts` owns, breaking the rule that the card is a direct child
 *    of `.card-grid`, and it would reorder the DOM away from payload order —
 *    which is the reading order screen readers and Tab follow. Absolute
 *    positioning leaves the DOM exactly as `render()` wrote it and moves only
 *    the pixels.
 *
 * 2. **No listeners on cards.** This module attaches exactly one listener,
 *    to `window`, once, from `initMasonry()`. Clicks stay with the single
 *    delegated handler in `app.ts`.
 */
/** CJ's track floor and the grid gap. Kept in step with `.card-grid`. */
export const MIN_COLUMN_WIDTH = 300;
export const GRID_GAP = 16;
/**
 * Sub-pixel tolerance for "shortest column". Measured heights are fractional,
 * so two columns that are visually level can differ by a hundredth of a
 * pixel. Without a tolerance that noise decides placement and the first row
 * stops filling left to right. A column must be meaningfully shorter to win.
 */
const EPSILON = 0.5;
/**
 * How many columns fit. `n` columns need `n * min + (n - 1) * gap` of width,
 * which rearranges to the floor below. Matches what `repeat(auto-fill,
 * minmax(300px, 1fr))` would produce, so the heights measured while the cards
 * are still in the CSS grid are the heights they will have once placed.
 */
export function columnCountFor(containerWidth, minColumnWidth = MIN_COLUMN_WIDTH, gap = GRID_GAP) {
    if (!Number.isFinite(containerWidth) || containerWidth <= 0)
        return 1;
    const fit = Math.floor((containerWidth + gap) / (minColumnWidth + gap));
    return Math.max(1, fit);
}
/**
 * The whole algorithm, as arithmetic: heights in DOM order in, a column and a
 * top offset per card out.
 *
 * Walking in DOM order and taking the shortest column each time gives both
 * behaviours the owner asked for at once. While every column is still empty
 * they are all equal, the tie goes to the leftmost, and the first row fills
 * left to right in payload order. After that the shortest column is whichever
 * one an early short card left a hole in, so later cards rise into the gaps
 * instead of waiting for the tallest card in the row above.
 *
 * It also preserves reading order, which is not obvious and is worth stating:
 * tops are non-decreasing in payload order. Placing into the shortest column
 * raises that column, so the new minimum is at least the old one — and each
 * card's top IS that minimum at the moment it is placed. A later card can
 * therefore never start above an earlier one, so a queue sorted by recency
 * reads downwards however ragged the heights become. Verified over several
 * thousand random layouts, not just argued.
 *
 * What this does NOT give is aligned rows. Each column is an independent
 * stack; cards share a top only while their predecessors happened to sum to
 * the same height, and that coincidence decays down the grid. Bounding the
 * drift would cost the gap-filling above — the two are the same trade.
 */
export function masonryLayout(heights, columns, gap = GRID_GAP) {
    const count = Math.max(1, Math.floor(columns) || 1);
    const running = new Array(count).fill(0);
    const placements = heights.map((height) => {
        let column = 0;
        for (let i = 1; i < count; i += 1) {
            if (running[i] < running[column] - EPSILON)
                column = i;
        }
        const top = running[column];
        running[column] = top + height + gap;
        return { column, top };
    });
    // Every column carries one trailing gap it does not need; subtract it back
    // out so the container is exactly as tall as its content.
    const tallest = Math.max(...running, 0);
    return { placements, height: Math.max(0, tallest - gap) };
}
/**
 * Puts the cards back in normal flow: the CSS grid in `styles.css` lays them
 * out, ragged rows and all. This is the fail-visible state — a stale height
 * on the container or a card left half-positioned is how a layout pass turns
 * a queue blank, so every early return in `applyMasonry` comes through here
 * first and leaves nothing behind.
 */
function resetLayout(container, cards) {
    container.style.height = "";
    for (const card of cards) {
        card.style.position = "";
        card.style.left = "";
        card.style.top = "";
        card.style.width = "";
    }
}
/**
 * Measures the cards currently in `.card-grid` and positions them.
 *
 * Bails to normal flow — never to nothing — when there is no container, no
 * card, no measurable width, only one column, or a height that measures as
 * zero. A single column is a plain stack by definition: one column of
 * shortest-first placement is just source order, so there is nothing for this
 * pass to add and the CSS grid does it without inline styles.
 */
export function applyMasonry(container) {
    if (!container)
        return;
    const cards = Array.from(container.children);
    // Measure from a clean slate: the cards must be back in the grid at the
    // current width before their natural heights mean anything.
    resetLayout(container, cards);
    if (!cards.length)
        return;
    const width = container.clientWidth;
    if (!Number.isFinite(width) || width <= 0)
        return;
    const columns = columnCountFor(width);
    if (columns < 2)
        return;
    const columnWidth = (width - GRID_GAP * (columns - 1)) / columns;
    for (const card of cards)
        card.style.width = `${columnWidth}px`;
    // Read every height, then write every position. Interleaving the two would
    // force a synchronous reflow per card.
    const heights = cards.map((card) => card.getBoundingClientRect().height);
    if (heights.some((h) => !Number.isFinite(h) || h <= 0)) {
        resetLayout(container, cards);
        return;
    }
    const { placements, height } = masonryLayout(heights, columns);
    placements.forEach((placement, i) => {
        const card = cards[i];
        card.style.position = "absolute";
        card.style.left = `${placement.column * (columnWidth + GRID_GAP)}px`;
        card.style.top = `${placement.top}px`;
    });
    container.style.height = `${height}px`;
}
/** Finds the grid the current render produced. There is at most one. */
function currentGrid() {
    return document.querySelector(".card-grid");
}
/**
 * Sizes every card in the completed grid to the tallest of them.
 *
 * CSS gets close but not there: `align-items: stretch` equalises within a row
 * and says nothing across rows, and `grid-auto-rows: 1fr` divides available
 * space rather than following content. One measure pass is the honest way to
 * make every card the same height as the tallest.
 *
 * Read every height, then write every height — interleaving forces a reflow
 * per card. Clearing first matters as much: without it each pass measures the
 * height the previous pass imposed, and the grid ratchets taller on every
 * resize.
 *
 * Silent no-op when nothing measures, matching applyMasonry: a layout pass
 * that cannot measure must leave the CSS grid alone, not blank the view.
 */
export function applyUniformHeights(container) {
    if (!container)
        return;
    const cards = Array.from(container.children);
    if (!cards.length)
        return;
    for (const card of cards)
        card.style.height = "";
    const heights = cards.map((card) => card.getBoundingClientRect().height);
    if (heights.some((h) => !Number.isFinite(h) || h <= 0))
        return;
    const tallest = Math.max(...heights);
    for (const card of cards)
        card.style.height = `${tallest}px`;
}
/**
 * Lays out whichever grid is on screen. The two are mutually exclusive — the
 * queue and the completed log never render together — so this picks by which
 * container exists rather than by reading UI state, and stays usable from the
 * resize listener that knows nothing about filters.
 */
export function relayoutGrid() {
    const masonry = document.querySelector(".card-grid");
    if (masonry) {
        applyMasonry(masonry);
        return;
    }
    applyUniformHeights(document.querySelector(".completed-grid"));
}
/** Run after every `render()`, once the new markup is in the document. */
export function relayoutMasonry() {
    applyMasonry(currentGrid());
}
let resizeTimer;
/**
 * Attached once at startup, outside `render()`, for the same reason the click
 * and keydown handlers are: `render()` replaces `#app`'s innerHTML on every
 * state change, so a listener added there would accumulate without bound.
 * This is the third and last listener in the build.
 *
 * Debounced because a drag across the screen fires `resize` continuously and
 * each pass measures every card.
 */
export function initMasonry(debounceMs = 100) {
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(relayoutGrid, debounceMs);
    });
    // Web fonts land after first paint and change every card's height. Without
    // this the first layout is measured in the fallback face and stays wrong
    // until something else triggers a relayout.
    document.fonts?.ready.then(relayoutGrid).catch(() => { });
}
