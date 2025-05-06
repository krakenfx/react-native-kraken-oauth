import type { AuthRequestConfig, DiscoveryDocument } from 'expo-auth-session';

export interface SignInOAuthConfig extends AuthRequestConfig {
  discovery: DiscoveryDocument;
  scopes: string[];
}

export interface GlobalSignInOAuthConfig extends SignInOAuthConfig {
  codeVerifier: string;
  csrfState: string;
}

interface SignInOAuthSuccessResponse {
  data: {
    accessToken: string;
  };
}

export interface SignInOAuthErrorResponse {
  error: 'UserCancelled' | string;
  originalError?: unknown;
}

export type SignInOAuthResponse =
  | SignInOAuthSuccessResponse
  | SignInOAuthErrorResponse;
