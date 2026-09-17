/**
 * Escapes a value for interpolation into markup. Components return HTML
 * strings, so every payload value must pass through here — payload content is
 * authored rather than user-submitted today, but a live Highland-backed
 * ActionSource will carry text this code did not write.
 *
 * Ampersand is replaced first; doing it later would re-escape the ampersands
 * introduced by the other replacements.
 */
export function esc(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
