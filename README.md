# Mitch — actions inbox (public demo build)

A static, read-only demo of the **Mitch** AI Staff Member actions inbox,
published here so it can be framed inside a Microsoft Teams tab. Teams
cannot frame the gated build (Cloudflare Access sends
`frame-ancestors 'none'`), which is why this public copy exists.

## This is a build artifact, not source

Source lives in the private repo `Btrmnt/ai-staff-cli`. Everything here is
generated from it — do not edit these files by hand; the next publish
overwrites them.

## The data is synthetic

`src/data/highland-mitch-actions.json` contains four fabricated actions.
Property addresses are marked `(sample)`; property-manager names and email
addresses are fictional and use `example.com`. No real client data, and no
real person's contact details, appear in this repository.

## Limits

Decisions are held in memory only — approving an action and reloading
resets it. There is no backend.
