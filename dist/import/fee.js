/**
 * Reads a fee as an agreement states it.
 *
 * The point is not to compute with it — nothing here does arithmetic on a
 * fee. It is to tell three things apart that a spreadsheet cell renders
 * identically: a percentage, a fixed amount, and a number of weeks' rent.
 * Those are different commercial instruments, and entering one as another is
 * the error Highland's money-field rule exists to stop.
 *
 * GST is read separately because its absence is the finding. An agreement
 * that says "5.5%" has not said whether that includes GST, and inclusive
 * versus exclusive differs by ten per cent on every invoice for the life of
 * the management.
 */
export function parseFee(raw) {
    const text = (raw ?? "").trim();
    const empty = { kind: "unknown", value: null, gst: "unstated", raw: text };
    if (!text)
        return empty;
    const lower = text.toLowerCase();
    const gst = /incl\w*\s*(of\s*)?gst|gst\s*incl/.test(lower)
        ? "inclusive"
        : /excl\w*\s*(of\s*)?gst|plus\s*gst|\+\s*gst|gst\s*excl/.test(lower)
            ? "exclusive"
            : "unstated";
    // Weeks first: "1.5 weeks rent" contains no % and no $, but "2 weeks" with
    // a dollar sign elsewhere in the cell would otherwise read as fixed.
    const weeks = /(\d+(?:\.\d+)?)\s*weeks?\b/.exec(lower);
    if (weeks) {
        return { kind: "weeks", value: Number(weeks[1]), gst, raw: text };
    }
    const percent = /(\d+(?:\.\d+)?)\s*%/.exec(lower);
    if (percent) {
        return { kind: "percent", value: Number(percent[1]), gst, raw: text };
    }
    // A currency amount. Commas are stripped so "$1,250.00" reads as 1250.
    const fixed = /\$\s*(\d[\d,]*(?:\.\d+)?)/.exec(lower);
    if (fixed) {
        return { kind: "fixed", value: Number(fixed[1].replace(/,/g, "")), gst, raw: text };
    }
    return { ...empty, gst };
}
/**
 * Whether a percentage sits outside what the rest of the portfolio does.
 *
 * Highland's management fees cluster; one well outside that cluster is worth
 * a human look even though it is perfectly well formed — which is a different
 * kind of finding from a malformed one, and the reason this is separate from
 * parseFee.
 *
 * The band is computed from the data rather than hardcoded: a portfolio's
 * normal range is whatever that portfolio actually does, and a constant here
 * would be wrong for the next client. Falls back to no opinion when there is
 * too little to compare against — three fees is not a distribution.
 */
export function feeBand(percentages) {
    const values = percentages.filter((n) => Number.isFinite(n));
    if (values.length < 5)
        return null;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, n) => sum + (n - mean) ** 2, 0) / values.length;
    const sd = Math.sqrt(variance);
    // Two standard deviations. Wide on purpose: this raises a question, and a
    // question asked too often is one nobody reads.
    return { low: mean - 2 * sd, high: mean + 2 * sd };
}
