import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAsync } from './useAsync';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('useAsync', () => {
  it('starts loading, then exposes the data', async () => {
    const { result } = renderHook(() => useAsync(() => Promise.resolve('hello'), []));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe('hello');
    expect(result.current.error).toBeNull();
  });

  it('exposes errors without throwing', async () => {
    const boom = new Error('boom');
    const { result } = renderHook(() => useAsync(() => Promise.reject(boom), []));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(boom);
    expect(result.current.data).toBeNull();
  });

  it('refetches when its dependencies change', async () => {
    const calls = [];
    const { result, rerender } = renderHook(({ q }) => useAsync(() => { calls.push(q); return Promise.resolve(q); }, [q]), { initialProps: { q: 'a' } });
    await waitFor(() => expect(result.current.data).toBe('a'));
    rerender({ q: 'b' });
    await waitFor(() => expect(result.current.data).toBe('b'));
    expect(calls).toEqual(['a', 'b']);
  });

  it('ignores a slow response that arrives after a newer one (search race)', async () => {
    const first = deferred();
    const second = deferred();
    const pending = { a: first, ab: second };
    const { result, rerender } = renderHook(({ q }) => useAsync(() => pending[q].promise, [q]), { initialProps: { q: 'a' } });
    rerender({ q: 'ab' });

    await act(async () => second.resolve('result for ab'));
    await waitFor(() => expect(result.current.data).toBe('result for ab'));

    await act(async () => first.resolve('stale result for a'));
    expect(result.current.data).toBe('result for ab');
    expect(result.current.loading).toBe(false);
  });

  it('ignores an old failure once a newer request has succeeded', async () => {
    const first = deferred();
    const second = deferred();
    const pending = { a: first, ab: second };
    const { result, rerender } = renderHook(({ q }) => useAsync(() => pending[q].promise, [q]), { initialProps: { q: 'a' } });
    rerender({ q: 'ab' });
    await act(async () => second.resolve('ok'));
    await act(async () => first.reject(new Error('late failure')));
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBe('ok');
  });

  it('reload runs the function again and clears a previous error', async () => {
    let attempt = 0;
    const { result } = renderHook(() => useAsync(() => (++attempt === 1 ? Promise.reject(new Error('first try')) : Promise.resolve('second try')), []));
    await waitFor(() => expect(result.current.error).toBeTruthy());
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBe('second try');
  });

  it('keeps the previous data visible while reloading', async () => {
    const next = deferred();
    let n = 0;
    const { result } = renderHook(() => useAsync(() => (++n === 1 ? Promise.resolve('one') : next.promise), []));
    await waitFor(() => expect(result.current.data).toBe('one'));
    act(() => {
      result.current.reload();
    });
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe('one');
    await act(async () => next.resolve('two'));
    expect(result.current.data).toBe('two');
  });

  it('does not update state after unmount', async () => {
    const d = deferred();
    const { result, unmount } = renderHook(() => useAsync(() => d.promise, []));
    unmount();
    await act(async () => d.resolve('late'));
    expect(result.current.data).toBeNull();
  });

  it('setData lets callers patch the data optimistically', async () => {
    const { result } = renderHook(() => useAsync(() => Promise.resolve(1), []));
    await waitFor(() => expect(result.current.data).toBe(1));
    act(() => result.current.setData(2));
    expect(result.current.data).toBe(2);
  });
});
