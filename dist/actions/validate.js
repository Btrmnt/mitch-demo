const STATUSES = ["needs_you", "waiting", "sent", "closed"];
/** Fields every action item must carry as a non-empty string. */
const REQUIRED_STRINGS = [
    "id",
    "title",
    "subtitle",
    "tag",
    "source",
    "proposal",
    "rule",
    "ruleNote",
    "pm",
    "decidedBy",
    "whoSees",
    "confidence",
];
function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
}
/**
 * Validates a parsed payload without throwing. Returns every problem found
 * rather than stopping at the first, so one run reports the whole picture.
 */
export function validateActionsPayload(input) {
    const issues = [];
    if (typeof input !== "object" ||
        input === null ||
        !Array.isArray(input.actions)) {
        return [{ id: null, message: "payload must be an object with an actions array" }];
    }
    const actions = input.actions;
    const seen = new Set();
    actions.forEach((raw, index) => {
        const a = raw;
        const id = isNonEmptyString(a.id) ? a.id : `#${index}`;
        for (const field of REQUIRED_STRINGS) {
            if (!isNonEmptyString(a[field])) {
                issues.push({ id, message: `${field} is required and must be a non-empty string` });
            }
        }
        if (!STATUSES.includes(a.status)) {
            issues.push({ id, message: `status must be one of ${STATUSES.join(", ")}` });
        }
        else if (a.status === "needs_you") {
            const pa = a.primaryAction;
            if (pa === undefined) {
                issues.push({ id, message: "primaryAction is required when status is needs_you" });
            }
            else {
                for (const field of ["label", "does", "note", "history"]) {
                    if (!isNonEmptyString(pa[field])) {
                        issues.push({ id, message: `primaryAction.${field} is required` });
                    }
                }
                // An action that lands back on needs_you would leave the item exactly
                // where it started, so the button would appear to do nothing.
                if (!STATUSES.includes(pa.status) || pa.status === "needs_you") {
                    issues.push({
                        id,
                        message: `primaryAction.status must be one of ${STATUSES.filter((x) => x !== "needs_you").join(", ")}`,
                    });
                }
            }
        }
        else if (a.primaryAction !== undefined) {
            issues.push({ id, message: "primaryAction is only allowed when status is needs_you" });
        }
        if (!Array.isArray(a.history) || a.history.length === 0) {
            issues.push({ id, message: "history must be a non-empty array" });
        }
        else {
            a.history.forEach((h, i) => {
                if (!isNonEmptyString(h?.time) || !isNonEmptyString(h?.text)) {
                    issues.push({ id, message: `history[${i}] needs a time and a text` });
                }
            });
        }
        if (a.ruleAdjust !== undefined && !isNonEmptyString(a.ruleAdjust)) {
            issues.push({ id, message: "ruleAdjust must be a non-empty string when present" });
        }
        // links is optional, but a malformed one renders a button that lies about
        // where it goes — checked as strictly as a required field when present.
        if (a.links !== undefined) {
            if (!Array.isArray(a.links)) {
                issues.push({ id, message: "links must be an array when present" });
            }
            else {
                a.links.forEach((l, i) => {
                    for (const field of ["system", "label", "opens"]) {
                        if (!isNonEmptyString(l?.[field])) {
                            issues.push({ id, message: `links[${i}].${field} is required` });
                        }
                    }
                    if (l?.url !== undefined && !isNonEmptyString(l.url)) {
                        issues.push({ id, message: `links[${i}].url must be a non-empty string when present` });
                    }
                });
            }
        }
        if (isNonEmptyString(a.id)) {
            if (seen.has(a.id)) {
                issues.push({ id, message: `duplicate id ${a.id}` });
            }
            seen.add(a.id);
        }
    });
    return issues;
}
/**
 * The completed log, checked on the same terms as the queue. These rows are
 * rendered, so a malformed one breaks the screen exactly as a malformed
 * action would — being lower-stakes information is not a reason to trust it.
 */
export function validateCompleted(input) {
    const issues = [];
    const completed = input?.completed;
    if (completed === undefined)
        return issues;
    if (!Array.isArray(completed)) {
        return [{ id: null, message: "completed must be an array when present" }];
    }
    const seen = new Set();
    completed.forEach((raw, index) => {
        const c = raw;
        const id = isNonEmptyString(c?.id) ? c.id : `completed[${index}]`;
        for (const field of ["id", "title", "subtitle", "time", "summary"]) {
            if (!isNonEmptyString(c?.[field])) {
                issues.push({ id, message: `${field} is required on a completed item` });
            }
        }
        if (isNonEmptyString(c?.id)) {
            if (seen.has(c.id)) {
                issues.push({ id, message: `duplicate completed id ${String(c.id)}` });
            }
            seen.add(c.id);
        }
    });
    return issues;
}
