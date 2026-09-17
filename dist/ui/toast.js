/**
 * A transient message, appended to <body> rather than rendered.
 *
 * render() reassigns #app's innerHTML on every state change, so a toast
 * living in that tree would be destroyed and rebuilt by unrelated clicks.
 * It is deliberately not in UiState either: the view derives nothing from
 * it, and it has its own lifetime measured in seconds.
 */
let hideTimer;
export function showToast(message) {
    let el = document.getElementById("toast");
    if (!el) {
        el = document.createElement("div");
        el.id = "toast";
        el.className = "toast";
        // Announced to assistive tech without taking focus away from the card
        // the reader is working in.
        el.setAttribute("role", "status");
        el.setAttribute("aria-live", "polite");
        document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add("toast--visible");
    if (hideTimer !== undefined)
        clearTimeout(hideTimer);
    const node = el;
    hideTimer = setTimeout(() => node.classList.remove("toast--visible"), 4500);
}
