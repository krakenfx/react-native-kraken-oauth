import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const handlers = [
  // Mock oauth/token endpoint as it is not part of the kweb handlers
  http.post('https://api.kraken.com/oauth/token', () => {
    return HttpResponse.json({ access_token: 'test-access-token' });
  }),
];

export const mockApi = setupServer(...handlers);

export const createMockApi = () => {
  const apiInstance = {
    use: (handler: any) => {
      mockApi.use(handler);
    },
    resetHandlers: () => {
      mockApi.resetHandlers();
    },
    initSession: {
      mockDefaultResult: jest.fn(),
      mockErrors: jest.fn(),
    },
  };

  beforeAll(() => {
    mockApi.listen({ onUnhandledRequest: 'error' });
  });

  afterEach(() => {
    mockApi.resetHandlers();
  });

  afterAll(() => {
    mockApi.close();
  });

  return () => apiInstance;
};
