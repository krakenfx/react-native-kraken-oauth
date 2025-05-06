import { waitFor, act, renderHook } from '@testing-library/react-native';
import {
  AuthRequest,
  AuthRequestPromptOptions,
  AuthSessionResult,
  CodeChallengeMethod,
  Prompt,
  useAuthRequest,
} from 'expo-auth-session';
import { http, HttpResponse } from 'msw';

import { createMockApi, mockApi } from '../tests/mockApi';

import { signInWithOAuthAuthorizationCode, useSignInOAuth } from './sign-in';
import { SignInOAuthConfig } from './sign-in.types';

const defaultConfig: SignInOAuthConfig = {
  clientId: 'test-client-id',
  redirectUri: 'https://example-domain.com/oauth/callback/my-app',
  scopes: ['account.info:basic'],
  discovery: {
    authorizationEndpoint: 'https://id.kraken.com/oauth/authorize',
    tokenEndpoint: 'https://api.kraken.com/oauth/token',
  },
};

const defaultResult = {
  type: 'success',
  errorCode: null,
  error: null,
  params: {
    state: 'test-csrf-state',
    code: 'test-authorization-code',
  },
  authentication: null,
  url: 'https://example-domain.com/oauth/callback/my-app?code=test-authorization-code&state=test-csrf-state',
};

const defaultRequest = {
  responseType: 'code',
  clientId: defaultConfig.clientId,
  extraParams: {},
  usePKCE: true,
  codeChallengeMethod: CodeChallengeMethod.S256,
  redirectUri: defaultConfig.redirectUri,
  scopes: ['openid'],
  clientSecret: 'test-client-secret',
  prompt: Prompt.Login,
  state: 'test-csrf-state',
  codeVerifier: 'test-code-verifier',
  url: defaultConfig.discovery.authorizationEndpoint!,
  getAuthRequestConfigAsync: jest.fn(),
  promptAsync: jest.fn().mockResolvedValue(defaultResult),
  parseReturnUrl: jest.fn(),
};

jest.mock('expo-auth-session', () => ({
  ...jest.requireActual('expo-auth-session'),
  useAuthRequest: jest.fn(),
}));

type MockAuthRequest = Omit<
  AuthRequest,
  'ensureCodeIsSetupAsync' | 'makeAuthUrlAsync'
>;

const mockUseAuthRequest = (
  useAuthRequest as jest.Mock<
    [
      MockAuthRequest | null,
      AuthSessionResult | null,
      (options?: AuthRequestPromptOptions | undefined) => Promise<any>,
    ]
  >
).mockReturnValue([null, null, jest.fn()]);

const renderUseSignInOAuth = async (overrideConfig = {}) => {
  const config = {
    ...defaultConfig,
    ...overrideConfig,
  };
  const hook = renderHook(() => useSignInOAuth(config));
  await waitFor(() => new Promise(process.nextTick));
  return hook;
};

const renderUseSignInOAuthAndCallSignIn = async (
  overrideConfig = {},
  overrideRequest = {}
) => {
  mockUseAuthRequest.mockReturnValue([
    overrideRequest === null ? null : { ...defaultRequest, ...overrideRequest },
    null,
    jest.fn(),
  ]);
  const { result } = await renderUseSignInOAuth(overrideConfig);
  const response = await act(async () => result.current.signIn());
  await waitFor(() => new Promise(process.nextTick));
  return response;
};

const renderUseSignInOAuthToPopulateGlobalConfig = (
  overrideConfig = {},
  overrideRequest = {}
) =>
  renderUseSignInOAuthAndCallSignIn(overrideConfig, {
    ...overrideRequest,
    // Mock cancel so it doesn't complete the hook flow
    promptAsync: jest.fn().mockResolvedValue({ type: 'cancel' }),
  });

const api = createMockApi();

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuthRequest.mockReturnValue([defaultRequest, null, jest.fn()]);
  api().initSession.mockDefaultResult();
  mockApi.use(
    http.post(defaultConfig.discovery.tokenEndpoint!, () => {
      return HttpResponse.json(
        {
          access_token: 'mock_access_token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
        { status: 200 }
      );
    })
  );
});

describe('signInWithOAuthAuthorizationCode', () => {
  describe('Errors', () => {
    it('should throw error if no globalSignInOAuthConfig is set', async () => {
      const response = signInWithOAuthAuthorizationCode(
        'test-code',
        'test-csrf-state'
      );
      await expect(response).rejects.toThrow('No globalSignInOAuthConfig');
    });

    it('should throw error if no authorization code is provided', async () => {
      await renderUseSignInOAuthToPopulateGlobalConfig();
      const response = signInWithOAuthAuthorizationCode(
        undefined,
        'test-csrf-state'
      );
      await expect(response).rejects.toThrow('No authorization code');
    });

    it('should throw error if no csrfState is provided', async () => {
      await renderUseSignInOAuthToPopulateGlobalConfig();
      const response = signInWithOAuthAuthorizationCode('test-code', undefined);
      await expect(response).rejects.toThrow('Failed CSRF check');
    });

    it('should throw error if csrfState is different from the initial request csrfState', async () => {
      await renderUseSignInOAuthToPopulateGlobalConfig(
        {},
        { state: 'csrf-state-initial' }
      );
      const response = signInWithOAuthAuthorizationCode(
        'test-code',
        'csrf-state-tampered'
      );
      await expect(response).rejects.toThrow('Failed CSRF check');
    });

    it('should throw error if tokenEndpoint fails', async () => {
      await renderUseSignInOAuthToPopulateGlobalConfig();

      mockApi.use(
        http.post(defaultConfig.discovery.tokenEndpoint!, () => {
          return HttpResponse.json(
            {
              error: 'test-error',
            },
            { status: 400 }
          );
        })
      );
      const response = signInWithOAuthAuthorizationCode(
        'test-code',
        'test-csrf-state'
      );
      await expect(response).rejects.toThrow('Failed to get access token');
    });
  });

  it('should successfully obtain a session and return an accessToken', async () => {
    await renderUseSignInOAuthToPopulateGlobalConfig();
    const response = signInWithOAuthAuthorizationCode(
      'test-code',
      'test-csrf-state'
    );
    await waitFor(() =>
      expect(response).resolves.toStrictEqual({
        data: {
          accessToken: 'mock_access_token',
        },
      })
    );
  });
});

describe('useSignInOAuth', () => {
  it('should return isLoading and signIn function', async () => {
    const { result } = await renderUseSignInOAuth();
    expect(result.current.isLoading).toBe(false);
    expect(typeof result.current.signIn).toBe('function');
  });

  it('should successfully obtain a session and return an accessToken', async () => {
    const response = await renderUseSignInOAuthAndCallSignIn();
    expect(response).toStrictEqual({
      data: {
        accessToken: 'mock_access_token',
      },
    });
  });

  describe('Errors', () => {
    it('should return error if redirectUri is not a valid universal/app link', async () => {
      const response = await renderUseSignInOAuthAndCallSignIn({
        redirectUri: 'krakenpro://oauth/callback/pro-mobile',
      });
      expect('error' in response && response.error).toBe(
        'Invalid redirectUri, it must be a valid https universal link and app link'
      );
    });

    it('should return error if no codeVerifier', async () => {
      const response = await renderUseSignInOAuthAndCallSignIn(
        {},
        { codeVerifier: undefined }
      );
      expect('error' in response && response.error).toBe('No codeVerifier');
    });

    it('should return error if no csrfState', async () => {
      const response = await renderUseSignInOAuthAndCallSignIn(
        {},
        { state: undefined }
      );
      expect('error' in response && response.error).toBe(
        'No requestCsrfState for CSRF check'
      );
    });

    it('should return error if no discovery token endpoint', async () => {
      const response = await renderUseSignInOAuthAndCallSignIn({
        discovery: {},
      });
      expect('error' in response && response.error).toBe(
        'No discovery token endpoint'
      );
    });

    it('should return error if user cancels oAuth flow', async () => {
      const response = await renderUseSignInOAuthAndCallSignIn(
        {},
        {
          promptAsync: jest.fn().mockResolvedValue({ type: 'cancel' }),
        }
      );
      expect('error' in response && response.error).toBe('UserCancelled');
    });

    it('should return error if user dismisses oAuth flow', async () => {
      const response = await renderUseSignInOAuthAndCallSignIn(
        {},
        { promptAsync: jest.fn().mockResolvedValue({ type: 'dismiss' }) }
      );
      expect('error' in response && response.error).toBe('UserCancelled');
    });

    it('should return error if no success type', async () => {
      const response = await renderUseSignInOAuthAndCallSignIn(
        {},
        { promptAsync: jest.fn().mockResolvedValue({ type: 'error' }) }
      );
      expect('error' in response && response.error).toBe('No oAuthResponse');
    });

    it('should return error if promptAsync throws an error', async () => {
      const response = await renderUseSignInOAuthAndCallSignIn(
        {},
        {
          promptAsync: jest.fn().mockRejectedValue(new Error('test-error')),
        }
      );
      expect('error' in response && response.error).toBe('test-error');
    });
  });
});
