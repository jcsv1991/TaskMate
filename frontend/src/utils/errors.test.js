import { describe, expect, it } from 'vitest';
import { getErrorMessage, getFieldErrors } from './errors';

const httpError = (status, data) => ({ response: { status, data } });

describe('getErrorMessage', () => {
  it('prefers the message the API sent', () => {
    expect(getErrorMessage(httpError(400, { msg: 'Invalid credentials' }))).toBe('Invalid credentials');
  });
  it('explains rate limiting', () => {
    expect(getErrorMessage(httpError(429, {}))).toMatch(/too many requests/i);
  });
  it('does not leak server internals on 5xx', () => {
    expect(getErrorMessage(httpError(500, { stack: 'secret' }))).toMatch(/server had a problem/i);
  });
  it('explains an unreachable server', () => {
    expect(getErrorMessage({ request: {}, message: 'Network Error' })).toMatch(/can't reach the server/i);
  });
  it('explains timeouts in terms of a sleeping server', () => {
    expect(getErrorMessage({ code: 'ECONNABORTED' })).toMatch(/took too long/i);
  });
  it('falls back to the error message, then to a default', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
    expect(getErrorMessage(null)).toMatch(/something went wrong/i);
    expect(getErrorMessage(httpError(418, {}), 'Custom fallback')).toBe('Custom fallback');
  });
});

describe('getFieldErrors', () => {
  it('maps validation errors onto field names, keeping the first per field', () => {
    const err = httpError(400, { errors: [{ path: 'email', message: 'Bad email' }, { path: 'email', message: 'Second' }, { path: 'name', message: 'Required' }] });
    expect(getFieldErrors(err)).toEqual({ email: 'Bad email', name: 'Required' });
  });
  it('returns an empty object for anything else', () => {
    expect(getFieldErrors(null)).toEqual({});
    expect(getFieldErrors(httpError(500, { msg: 'x' }))).toEqual({});
    expect(getFieldErrors(httpError(400, { errors: 'nope' }))).toEqual({});
  });
});
