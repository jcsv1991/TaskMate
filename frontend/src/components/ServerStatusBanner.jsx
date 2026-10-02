import { useEffect, useRef, useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { health } from '../services/endpoints';

const SHOW_AFTER_MS = 2500;
const RETRY_EVERY_MS = 3000;
const GIVE_UP_AFTER_MS = 120000;

/**
 * Free hosting tiers put idle servers to sleep, and the first request can take
 * 30-60 seconds. Instead of a blank page and a spinner with no explanation, tell
 * the visitor what is happening and keep trying until the API answers.
 */
export default function ServerStatusBanner() {
  const [state, setState] = useState('checking'); // checking | slow | ready | failed
  const attempt = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let retryTimer;
    const started = Date.now();
    const myAttempt = ++attempt.current;

    const slowTimer = setTimeout(() => {
      if (!cancelled) setState((s) => (s === 'checking' ? 'slow' : s));
    }, SHOW_AFTER_MS);

    const probe = async () => {
      try {
        await health();
        if (!cancelled) setState('ready');
      } catch {
        if (cancelled) return;
        if (Date.now() - started > GIVE_UP_AFTER_MS) setState('failed');
        else retryTimer = setTimeout(probe, RETRY_EVERY_MS);
      }
    };
    probe();

    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
      clearTimeout(retryTimer);
      void myAttempt;
    };
  }, []);

  if (state === 'checking' || state === 'ready') return null;

  if (state === 'failed') {
    return (
      <div className="tm-banner tm-banner-danger" role="alert">
        <span>We can’t reach the server right now.</span>
        <Button size="sm" variant="light" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    );
  }

  return (
    <div className="tm-banner" role="status" data-testid="server-waking">
      <Spinner animation="border" size="sm" aria-hidden="true" />
      <span>
        Waking up the server. The free hosting tier sleeps when idle, so this can take up to a minute. Everything will load automatically.
      </span>
    </div>
  );
}
