/**
 * This file is the contract. Everything downstream — the terminal CLI today,
 * a Teams bot later, a live service later still — talks in these shapes.
 * Swapping the mock JSON payload for a live service means changing what
 * populates an InteractionPayload and what implements ResponseSource,
 * never these types themselves.
 */
export {};
