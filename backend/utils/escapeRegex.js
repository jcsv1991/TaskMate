/**
 * Escape user input before placing it inside a RegExp. Without this a search
 * for "(" crashes the request and a crafted pattern can trigger catastrophic
 * backtracking (ReDoS).
 */
module.exports = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
