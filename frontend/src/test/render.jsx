import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppRoutes, Providers } from '../App';
import { TOKEN_KEY } from '../config';
import { fakeApi } from './fakeApi';

let currentLocation;
function LocationProbe() {
  currentLocation = useLocation();
  return null;
}

/** Where the router currently is (path + query), for asserting on navigation and URL-synced filters. */
export const location = () => ({ path: currentLocation.pathname, search: currentLocation.search, state: currentLocation.state });

/**
 * Render the whole app (layout, routes, providers) at `route`.
 * Signed in by default; pass `{ signedIn: false }` to start as a visitor.
 */
export function renderApp(route = '/', { signedIn = true } = {}) {
  if (signedIn) window.localStorage.setItem(TOKEN_KEY, fakeApi.token);
  const user = userEvent.setup();
  const utils = render(
    <MemoryRouter initialEntries={[route]}>
      <Providers>
        <LocationProbe />
        <AppRoutes />
      </Providers>
    </MemoryRouter>
  );
  return { user, ...utils };
}

/** Render a single component inside providers + a router (for component-level tests). */
export function renderWithProviders(ui, { route = '/' } = {}) {
  const user = userEvent.setup();
  const utils = render(
    <MemoryRouter initialEntries={[route]}>
      <Providers>
        <LocationProbe />
        {ui}
      </Providers>
    </MemoryRouter>
  );
  return { user, ...utils };
}
