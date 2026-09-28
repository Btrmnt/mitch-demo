/**
 * A CSV reader, because this project has no runtime dependencies and adding
 * one to read a spreadsheet export would be a poor trade.
 *
 * Handles what a real export actually contains: quoted fields, commas and
 * newlines inside quotes, doubled quotes as an escape, and a BOM, which
 * Excel writes and which otherwise turns the first column heading into
 * something no column map will ever match.
 */
export function parseCsv(input) {
    const text = input.replace(/^﻿/, "");
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i += 1;
                }
                else
                    quoted = false;
            }
            else
                field += ch;
            continue;
        }
        if (ch === '"') {
            quoted = true;
            continue;
        }
        if (ch === ",") {
            row.push(field);
            field = "";
            continue;
        }
        if (ch === "\r")
            continue;
        if (ch === "\n") {
            row.push(field);
            rows.push(row);
            row = [];
            field = "";
            continue;
        }
        field += ch;
    }
    // A file that does not end in a newline still has a last row.
    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    const [header, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ""));
    if (!header)
        return [];
    const keys = header.map((h) => h.trim());
    return body.map((cells) => {
        const record = {};
        keys.forEach((key, i) => { record[key] = (cells[i] ?? "").trim(); });
        return record;
    });
}
