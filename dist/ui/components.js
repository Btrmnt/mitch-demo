import { esc } from "./escape.js?v=cab4bfc";
/** Human labels for each status, as the design system writes them. */
export const STATUS_LABEL = {
    needs_you: "Needs You",
    waiting: "Waiting",
    sent: "Sent",
    closed: "Closed",
};
export function statusBadge(status) {
    return `<span class="badge badge--${esc(status)}">${esc(STATUS_LABEL[status])}</span>`;
}
export function tagBadge(tag) {
    return `<span class="badge badge--tag">${esc(tag)}</span>`;
}
export function filterChip(opts) {
    const count = opts.count === undefined ? "" : ` · ${esc(String(opts.count))}`;
    const active = opts.active ? " chip--active" : "";
    return (`<button class="chip${active}" data-action="filter" ` +
        `data-value="${esc(opts.value)}">${esc(opts.label)}${count}</button>`);
}
/**
 * The three button tiers. One shape, three classes — the difference is
 * entirely visual, which is the point: nothing about what a button *does*
 * should depend on which tier it wears.
 *
 * Primary is the one decision a surface is asking for. Secondary is a real
 * alternative to it. Tertiary is a way out rather than a choice.
 */
/**
 * Primary and secondary labels come from the payload and from fixed copy that
 * is longer than the space allows — "Acknowledge & Request Pool Compliance"
 * beside "Close (Handled Outside Mitch)". They share one row and truncate, so
 * each carries the full label in `title` for hover.
 */
function button(cls, label, action, id, title = label) {
    return (`<button class="${esc(cls)}" data-action="${esc(action)}" ` +
        `data-id="${esc(id)}" title="${esc(title)}">${esc(label)}</button>`);
}
export function primaryButton(label, action, id, title) {
    return button("btn-primary", label, action, id, title);
}
export function secondaryButton(label, action, id) {
    return button("btn-secondary", label, action, id);
}
/**
 * `extraClass` exists for the overflow menu, whose entries are tertiary
 * buttons that additionally have to sit as full-width rows. The tier carries
 * the type; the extra class carries the arrangement.
 */
export function tertiaryButton(label, action, id, extraClass = "") {
    return button(extraClass ? `btn-tertiary ${extraClass}` : "btn-tertiary", label, action, id);
}
/**
 * The filter row: one chip per status, then the red-alert toggle. Takes the
 * counts and which filters are on, not the whole UiState — this module is
 * the design system in code and holds no app logic.
 */
export function chipRow(counts, active, redAlertsOnly) {
    const order = [
        { label: "All", value: "all" },
        { label: "Needs You", value: "needs_you" },
        { label: "Waiting", value: "waiting" },
        { label: "Sent", value: "sent" },
        { label: "Closed", value: "closed" },
    ];
    const chips = order
        .map((o) => filterChip({
        label: o.label,
        count: counts[o.value],
        value: o.value,
        active: active === o.value,
    }))
        .join("");
    const alerts = filterChip({
        label: "Red Alerts",
        value: "alerts",
        active: redAlertsOnly,
    });
    return `${chips}<span class="chip-divider"></span>${alerts}`;
}
/** A card's red alert, or nothing. Shown identically on card and modal. */
function alertBlock(card) {
    return card.hasAlert
        ? `<div class="card-alert">${esc(card.flag ?? "")}</div>`
        : "";
}
/**
 * Stand-in for Font Awesome's `fa-circle-info`. The design system names Font
 * Awesome 6 solid, but this build has no Font Awesome and may not add a
 * dependency — and a CDN link would break a demo run offline. So the icons
 * it names are inlined as SVG at the same visual weight. The counter is from
 * the panel's own surface token rather than white, so it reads as punched
 * out of the disc the way the solid original does.
 */
const ICON_CIRCLE_INFO = `<svg class="icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">` +
    `<circle cx="8" cy="8" r="7.25" fill="currentColor"/>` +
    `<circle class="icon__counter" cx="8" cy="4.5" r="1.1"/>` +
    `<rect class="icon__counter" x="6.95" y="6.6" width="2.1" height="5.2" rx="1.05"/>` +
    `</svg>`;
/** Stand-in for `fa-ellipsis-vertical`, on the same terms. */
const ICON_ELLIPSIS_VERTICAL = `<svg class="icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">` +
    `<circle cx="8" cy="3.1" r="1.45" fill="currentColor"/>` +
    `<circle cx="8" cy="8" r="1.45" fill="currentColor"/>` +
    `<circle cx="8" cy="12.9" r="1.45" fill="currentColor"/>` +
    `</svg>`;
/**
 * The Context construct: plain-language reasoning for why this Action exists.
 * CJ — the reference build the design system is lifted from — attaches it to
 * the *opened detail*, tucked behind the panel, not beside every tile in the
 * queue.
 *
 * So this is rendered as a sibling of the modal inside `.modal-row`, and the
 * pairing has to stay that shape: the row's height is the modal's height,
 * which is the only thing that lets the panel stretch inside it and still be
 * inset 14px top and bottom. Nested in the modal, or parked loose in the
 * scrim, there is nothing for it to be shorter *than*.
 */
export function contextPanel(card) {
    // The pill truncates to one line, so the whole rule name goes in the title
    // as well — escaped exactly like the visible copy, since an attribute is
    // the easier of the two places to break out of. Rule names are verbatim
    // from the source documents and are not shortened to fit.
    const rule = `Rule: ${esc(card.rule)}`;
    return `
    <aside class="context-panel">
      <div class="context-panel__eyebrow">${ICON_CIRCLE_INFO}<span>Context</span></div>
      <p class="context-panel__note">${esc(card.ruleNote)}</p>
      <span class="context-panel__rule" title="${rule}">${rule}</span>
    </aside>`;
}
/**
 * What a card or modal says in place of a button. Coloured from the same
 * status token as the badge — a Waiting note is amber and a Closed note is
 * grey, as the design system pairs them.
 */
export function statusNote(card) {
    return (`<div class="card-note card-note--${esc(card.status)}">` +
        `${esc(card.noteText)}</div>`);
}
/**
 * The card's overflow menu. Only the last item does anything this phase: it
 * applies the same close-handled decision the modal offers. The others are
 * inert — they carry a data-action so the delegated handler can recognise
 * and dismiss the menu, but nothing acts on those names.
 *
 * CJ's "Not Managed by Us" is deliberately absent. It belongs to a staff
 * member looking after an existing portfolio, where declining a property is
 * a real answer. Mitch onboards new business: everything in this queue is a
 * property being taken on, so the option would never be the right one.
 *
 * Out of scope, explicitly: CJ's `@assign` teammate-search popover behind
 * "Assign to a Teammate". That is a feature, not a visual treatment.
 */
export function cardMenu(card) {
    const item = (action, label) => tertiaryButton(label, action, card.id, "card-menu__item");
    return `
    <div class="card-menu" role="menu">
      ${item("assign", "Assign to a Teammate")}
      ${item("redirect", "Redirect")}
      ${item("close-handled", "Close (Handled Outside Mitch)")}
    </div>`;
}
/**
 * CJ's card anatomy: the title leads on one truncated line, the badges sit
 * beneath it, and two 24px circular controls hold the top right — an "i"
 * opening the detail view and an ellipsis opening the overflow menu.
 */
export function actionCard(card) {
    const alert = alertBlock(card);
    // "Review", not the decision's own label. The card carried primaryLabel
    // here — the same words as the button in the modal that actually approves
    // — so a collapsed card appeared to offer a decision it cannot take. The
    // card's job is to get you to the detail; what is being asked is already
    // said by the title, the badges and the alert.
    const footer = card.isNeedsYou && card.primaryAction
        ? primaryButton("Review", "open", card.id, card.primaryAction.does)
        : statusNote(card);
    const menu = card.menuOpen ? cardMenu(card) : "";
    const open = card.menuOpen ? " card--menu-open" : "";
    return `
    <article class="card${open}" data-action="open" data-id="${esc(card.id)}">
      <div class="card__head">
        <div class="card__headings">
          <h2 class="card__title">${esc(card.title)}</h2>
          <div class="card__badges">${tagBadge(card.tag)}${statusBadge(card.status)}</div>
        </div>
        <div class="card__controls">
          <button class="card-ctl card-ctl--info" data-action="open"
                  data-id="${esc(card.id)}" aria-label="Open details">i</button>
          <button class="card-ctl card-ctl--menu" data-action="toggle-menu"
                  data-id="${esc(card.id)}" aria-haspopup="menu"
                  aria-expanded="${card.menuOpen ? "true" : "false"}"
                  aria-label="More actions">${ICON_ELLIPSIS_VERTICAL}</button>
          ${menu}
        </div>
      </div>
      <p class="card__subtitle">${esc(card.subtitle)}</p>
      ${alert}
      ${footer}
    </article>`;
}
export function cardGrid(cards) {
    if (!cards.length) {
        return `<div class="queue-empty">No actions match this filter</div>`;
    }
    return `<div class="card-grid">${cards.map(actionCard).join("")}</div>`;
}
function metaRow(label, value) {
    return `<dt>${esc(label)}</dt><dd>${esc(value)}</dd>`;
}
/**
 * The supporting actions: where a person would go to act on this — the
 * systems of record, not pages in this UI. Secondary, because going to
 * PropertyMe is a real alternative to approving Mitch's draft, not a way
 * out of the card.
 *
 * These belong in the pinned footer beside the primary. They spent one
 * revision as a section in the scrollable body, where a long card hid them
 * below the fold — which is exactly where the actions must never be.
 */
export function supportingActions(card) {
    if (!card.links?.length)
        return "";
    return card.links
        .map((l, i) => `<button class="btn-secondary link-btn" data-action="open-system" ` +
        `data-id="${esc(card.id)}" data-link="${esc(String(i))}" ` +
        `title="${esc(l.opens)}">${esc(l.label)}</button>`)
        .join("");
}
/**
 * The tertiary rail: the ways to push this action somewhere else rather than
 * resolve it here. Same four entries as the card's overflow menu, shown
 * openly in the modal — a reader deciding on a card should not have to know
 * they are hidden behind an ellipsis.
 *
 * "Close (Handled Outside Mitch)" lives here, not beside the primary. It is
 * not an alternative way to decide; it is a way to take the item off the
 * queue, which is what the rail is for.
 *
 * DO NOT ADD a "Withdrawn" / "Not proceeding" entry here. Onboarding does
 * have that failure mode — it is Notion scenario Mitch-030, Cancellation &
 * Withdrawal Handling — but cancelling an MAA is a consequential, externally
 * visible act: it stops in-flight work and closes a real piece of business.
 * A row of small text links in a queue is exactly where someone clicks the
 * wrong one, and this rail carries no confirmation step.
 *
 * Mitch-030 is Phase 2 and will need its own surface with its own
 * confirmation. Closing a case belongs there, deliberately, not one stray
 * click away from "Redirect". (Rei, 2026-09-18.)
 */
export function tertiaryRail(card) {
    const item = (action, label) => tertiaryButton(label, action, card.id, "modal__rail-item");
    return `
        <div class="modal__rail">
          ${item("assign", "Assign")}
          ${item("redirect", "Redirect")}
          ${item("close-handled", "Close (handled outside)")}
        </div>`;
}
/**
 * The heading over what Mitch has to say about an item, which depends on
 * whether it has happened yet.
 *
 * Both headings replaced "What Mitch drafted", inherited from CJ. There the
 * field held a literal draft — a letter you read and sent — so the word was
 * accurate. Mitch's field holds a decision: "Entry stopped before
 * PropertyMe. A dollar value in a percentage field is the error this hard
 * stop exists to catch." Nothing was drafted.
 *
 * Splitting on status matters because "proposes" is only true while the item
 * is waiting on a person. On the rest Mitch has already acted — the case was
 * opened, the ad was posted, the routing was applied — and calling that a
 * proposal would trade one inaccuracy for another.
 *
 * Its sibling heading moved to the plural present for the same reason: CJ
 * quoted back one received message, while Mitch reads a set of standing
 * records that still say what they say. That they can change underneath a
 * decision is the whole premise of reconcile().
 */
export function draftedHeading(card) {
    return card.isNeedsYou ? "What action Mitch proposes" : "What Mitch did";
}
export function modal(card) {
    if (!card)
        return "";
    const alert = alertBlock(card);
    // Row one is the decision and the things that support making it; row two
    // is everything that moves the item elsewhere. Both pinned, because an
    // action a reader cannot reach without scrolling is an action they will
    // not take.
    const decision = card.isNeedsYou && card.primaryAction
        ? primaryButton(card.primaryAction.label, "approve", card.id, card.primaryAction.does)
        : statusNote(card);
    const footer = `
        <div class="modal__footer">
          <div class="modal__actions">
            ${decision}
            ${supportingActions(card)}
          </div>
          ${tertiaryRail(card)}
        </div>`;
    const history = card.history
        .map((h) => `<li><span class="modal__time">${esc(h.time)}</span>${esc(h.text)}</li>`)
        .join("");
    return `
    <div class="modal-scrim" data-action="dismiss">
      <div class="modal-row">
        <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(card.title)}">
          <header class="modal__head">
            <div>
              <h2 class="modal__title">${esc(card.title)}</h2>
              <p class="modal__subtitle">${esc(card.subtitle)}</p>
            </div>
            <button class="icon-btn" data-action="dismiss" aria-label="Close">&times;</button>
          </header>

          <section>
            <div class="modal__eyebrow">What the sources say</div>
            <div class="modal__quote">${esc(card.source)}</div>
          </section>

          <section>
            <div class="modal__eyebrow">${draftedHeading(card)}</div>
            <div class="modal__draft">${esc(card.drafted)}</div>
          </section>

          ${alert}

          <dl class="modal__meta">
            ${metaRow("Property manager", card.pm)}
            ${metaRow("Decided by", card.decidedBy)}
            ${metaRow("Who can see this", card.whoSees)}
            ${metaRow("Confidence", card.confidence)}
          </dl>

          <section>
            <div class="modal__eyebrow">History</div>
            <ul class="modal__history">${history}</ul>
          </section>

          ${footer}
        </div>
        ${contextPanel(card)}
      </div>
    </div>`;
}
/**
 * What the page shows instead of the queue when a source hands back a payload
 * that does not satisfy the contract. It lists every problem rather than the
 * first, matching what `npm run check:actions` prints, because the person
 * looking at this is about to go and fix the payload.
 */
export function issueScreen(issues) {
    const rows = issues
        .map((i) => `<li><span class="issues__id">${esc(i.id ?? "(payload)")}</span>` +
        `${esc(i.message)}</li>`)
        .join("");
    return `
    <div class="issues">
      <h2 class="issues__title">This actions payload cannot be displayed</h2>
      <p class="issues__lede">
        ${esc(String(issues.length))} problem(s) found. Run
        <code>npm run check:actions</code> for the same list at the terminal.
      </p>
      <ul class="issues__list">${rows}</ul>
    </div>`;
}
