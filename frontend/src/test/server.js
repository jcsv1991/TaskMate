import { setupServer } from 'msw/node';
import { fakeApi } from './fakeApi';

export const server = setupServer(...fakeApi.handlers);
