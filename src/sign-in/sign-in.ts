import { useAuthRequest } from 'expo-auth-session';
import { useCallback, useState } from 'react';

import {
  GlobalSignInOAuthConfig,
  SignInOAuthConfig,
  SignInOAuthResponse,
} from './sign-in.types';

// This is needed to support iOS 17.3 and below
let globalSignInOAuthConfig: GlobalSignInOAuthConfig | null = null;

export const signInWithOAuthAuthorizationCode = async (
  authorizationCode: string | undefined,
  csrfState: string | undefined
) => {
  if (!globalSignInOAuthConfig) {
    throw new Error('No globalSignInOAuthConfig');
  }

  if (!globalSignInOAuthConfig.discovery.tokenEndpoint) {
    throw new Error('No discovery token endpoint');
  }

  if (!authorizationCode) {
    throw new Error('No authorization code');
  }

  if (!csrfState || csrfState !== globalSignInOAuthConfig.csrfState) {
    throw new Error('Failed CSRF check');
  }

  const response = await fetch(
    globalSignInOAuthConfig.discovery.tokenEndpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(
          `${globalSignInOAuthConfig.clientId}:`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        code: authorizationCode,
        grant_type: 'authorization_code',
        redirect_uri: globalSignInOAuthConfig.redirectUri,
        code_verifier: globalSignInOAuthConfig.codeVerifier,
      }).toString(),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to get access token');
  }

  const { access_token: accessToken } = await response.json();

  return {
    data: {
      accessToken,
    },
  };
};

export const useSignInOAuth = ({ discovery, ...config }: SignInOAuthConfig) => {
  const [isLoading, setIsLoading] = useState(false);
  const oAuthConfig = {
    ...config,
  };

  const [request] = useAuthRequest(oAuthConfig, discovery);

  const signIn = useCallback(async (): Promise<SignInOAuthResponse> => {
    // If config.redirectUri is not a valid universal/app link return an error
    if (!config.redirectUri.startsWith('https://')) {
      console.error('OAuth invalid redirectUri error', {
        extra: { redirectUri: config.redirectUri },
      });
      return {
        error:
          'Invalid redirectUri, it must be a valid https universal link and app link',
      };
    }

    if (request === null) {
      return {
        error: 'Request is still loading, try again later',
      };
    }

    try {
      setIsLoading(true);

      // Get the generated codeVerifier from the request
      const codeVerifier = request.codeVerifier;
      const requestCsrfState = request.state;

      if (!codeVerifier) {
        throw new Error('No codeVerifier');
      }

      if (!requestCsrfState) {
        throw new Error('No requestCsrfState for CSRF check');
      }

      if (!discovery.tokenEndpoint) {
        throw new Error('No discovery token endpoint');
      }

      globalSignInOAuthConfig = {
        ...config,
        discovery,
        codeVerifier,
        csrfState: requestCsrfState,
      };

      const oAuthResponse = await request.promptAsync(discovery);

      if (
        oAuthResponse?.type === 'cancel' ||
        oAuthResponse?.type === 'dismiss'
      ) {
        return {
          error: 'UserCancelled',
        };
      }

      if (oAuthResponse?.type !== 'success') {
        throw new Error('No oAuthResponse');
      }

      const { code: authorizationCode, state: csrfState } =
        oAuthResponse.params;

      return await signInWithOAuthAuthorizationCode(
        authorizationCode,
        csrfState
      );
    } catch (error) {
      console.error('OAuth sign in error', { error });
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        originalError: error,
      };
    } finally {
      setIsLoading(false);
    }
  }, [discovery, request, config]);

  return {
    signIn,
    isLoading,
  };
};
