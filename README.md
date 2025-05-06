# react-native-kraken-oauth

This package is used to handle OAuth authentication for React Native Kraken mobile apps.

## Prerequisites

Tested with React Native 0.77.1. It may work on other versions, but it's not guaranteed.

## Installation

### Install the `react-native-kraken-oauth` package from GitHub:

```sh
yarn add react-native-kraken-oauth@github:krakenfx/react-native-kraken-oauth
```

### Install the oauth-mobile dependencies:

```sh
yarn add expo-auth-session expo-crypto expo-web-browser
```

### Use Kraken's fork of `expo-web-browser`

You will need to update `expo-web-browser` to use the [Kraken expo-web-browser-universal-link-support fork](https://github.com/krakenfx/expo-web-browser-universal-link-support) to support universal links on iOS:

```json
"expo-web-browser": "https://github.com/krakenfx/expo-web-browser-universal-link-support.git",
```

### Install pods on iOS

```sh
cd ios && bundle exec pod install
```

### Setup new OAuth client

> **Important**  
> You will need to repeat these steps for each environment (e.g. dev and production).

Contact your representative at Kraken to setup a new oauth client with the relevant redirectURIs. Take note of the `clientId` as you will need this later.

You'll need to add two redirectURIs for the primary universal + app link:

- https://example-domain.com/oauth/callback/my-app
- https://www.example-domain.com/oauth/callback/my-app

> **Important**  
> Do not use custom URL schemes for the redirectURIs as these can be [hijacked](https://evanconnelly.github.io/post/ios-oauth/) by malicious apps.

### iOS Steps

#### Setup universal links

Make sure the primary redirectURI universal link is registered in the primary domain apple-app-site-association file:

```ts
// https://example-domain.com/.well-known/apple-app-site-association
{
  "applinks": {
    "details": [
      {
        "appID": "ABC123ABC.com.myapp",
        "paths": [
          "/oauth/callback/my-app",
        ]
      }
    ]
  }
}
```

We need to add a secondary universal link to support iOS 17.3 and below. For more details see [Supporting iOS 17.3 and below](#supporting-ios-173-and-below). This secondary universal link needs to be on a different domain or subdomain to the primary. For example:

```ts
// https://id.example-domain.com/.well-known/apple-app-site-association
{
  "applinks": {
    "details": [
      {
        "appID": "ABC123ABC.com.myapp",
        "paths": [
          "/oauth/callback/my-app/open"
        ]
      }
    ]
  }
}
```

#### Setup web credentials

In Xcode navigate to Signing & Capabilities -> Associated Domains and ensure the following are listed:

```
webcredentials:www.example-domain.com
webcredentials:example-domain.com
```

Make sure your app is inside `webcredentials.apps` array in primary domain apple-app-site-association file:

```ts
// https://example-domain.com/.well-known/apple-app-site-association
{
  "webcredentials": {
    "apps": [
      "ABC123ABC.com.myapp",
    ]
  }
}
```

#### Setup app links

In Xcode navigate to Signing & Capabilities -> Associated Domains and ensure the following are listed:

```
applinks:example-domain.com
applinks:www.example-domain.com
applinks:id.example-domain.com
applinks:www.id.example-domain.com
```

#### Supporting iOS 17.3 and below

On iOS 17.3 and below universal links redirects do not work in the [ASWebAuthenticationSession](<https://developer.apple.com/documentation/authenticationservices/aswebauthenticationsession/init(url:callbackurlscheme:completionhandler:)>) as only Custom URL schemes are supported.

As a workaround we can add a secondary universal link on another domain or subdomain. This secondary universal link will need to be triggered via a button press on a webpage hosted at the primary universal link.

> **Example**  
> Primary redirect URI: https://example-domain.com/oauth/callback/my-app
> Secondary redirect URI: https://id.example-domain.com/oauth/callback/my-app/open

##### Add Primary Redirect URI Webpage

Add a webpage to the primary redirect URI domain. This webpage will be used to trigger the secondary universal link.

```html
<a href="https://id.example-domain.com/oauth/callback/my-app/open">Open App</a>
```

##### Update App To Handle Secondary Universal Link

We now need to handle the secondary universal link in the app code to obtain the session using the OAuth code from the redirectURI.

First ensure deep links from both `example-domain.com` and `id.example-domain.com` are allowed. See [React Navigation Deep Linking](https://reactnavigation.org/docs/deep-linking) docs for more details.

Then update the deep link handler to handle the secondary universal link path, dismiss the `ASWebAuthenticationSession` and obtain the access token:

```ts
const onDeepLink = (url: string) => {
  if (
    // Handle secondary universal link path
    parsed.url.endsWith('/oauth/callback/my-app/open') &&
    // Authorization code
    parsed.query.code &&
    // CSRF state
    parsed.query.state
  ) {
    // Dismisses the ASWebAuthenticationSession
    dismissAuthSession();

    try {
      // Obtain the session using the authorization code and csrf state
      const response = await signInWithOAuthAuthorizationCode(
        parsed.query.code,
        parsed.query.state,
      );

      if ('error' in response) {
        throw new Error('Error');
      }

      const { accessToken } = response.data;

      // Do something with the access token
    } catch (error) {
      Alert.alert('Sign in error');
    }
  }
};
```

### Android Steps

#### Setup Android App Links

Follow the (Google Documentation)[https://developer.android.com/training/app-links] to setup App Links in your app.

Make sure the app is registered to handle all URLs in both the primary and secondary redirectURI domains `assetlinks.json` files:

```json
// https://www.example-domain.com/.well-known/assetlinks.json
[
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'com.myapp',
      sha256_cert_fingerprints: ['...'],
    },
  },
];
```

Secondary redirectURI domain assetlinks.json file:

```json
// https://id.example-domain.com/.well-known/assetlinks.json
[
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'com.myapp',
      sha256_cert_fingerprints: ['...'],
    },
  },
];
```

Inside the main `AndroidManifest.xml` file, add the primary and secondary redirectURIs `intent-filter`'s to the `MainActivity`:

```xml
<!-- Primary app link redirectURI -->
<intent-filter android:label="OAuth redirect" android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="https"
    android:host="www.example-domain.com"
    android:pathPrefix="/oauth/callback/my-app" />
</intent-filter>
<!-- Secondary app link redirectURI -->
<intent-filter android:label="OAuth redirect open" android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="https"
    android:host="id.example-domain.com"
    android:pathPrefix="/oauth/callback/my-app/open" />
</intent-filter>
```

## Fallback

Both iOS Universal Links and Android App Links can be disabled by the user:

- on iOS simply long press the link in Safari and open in Safari
- on Android go to Apps -> Default apps -> Open Links -> [app you want to disable] -> Disable Open Supported Links

To handle this we recommend displaying support links on the primary redirectURI webpage that links to our support page:

```html
<a
  href="https://support.kraken.com/hc/en-us/articles/how-to-enable-app-links-and-universal-links-on-mobile-devices"
  >Support</a
>
```

## Usage

Import the `useSignInOAuth` hook in your component pass the required config to the hook:

```ts
const { signIn, isLoading } = useSignInOAuth({
  // Your Kraken representative will provide you with the clientId
  clientId: 'YOUR_CLIENT_ID',
  // Scopes to request
  scopes: ['account.info:basic'],
  // Your primary redirectURI
  redirectUri: 'https://example-domain.com/oauth/callback/my-app',
  discovery: {
    authorizationEndpoint: 'https://id.kraken.com/oauth/authorize',
    tokenEndpoint: 'https://api.kraken.com/oauth/token',
  },
});
```

Call the `signIn` function to start the OAuth flow and handle the response appropriately:

```tsx
const onSignInPress = async () => {
  // Handle loading state
  if (isLoading) {
    return;
  }

  // Start OAuth flow
  const response = await signIn();

  // Handle error
  if ('error' in response) {
    if (response.error !== 'UserCancelled') {
      Alert.alert('Sign in error');
    }
    return;
  }

  const { accessToken } = response.data;

  // Do something with the access token
};

<Button onPress={onSignInPress} title="Sign In" />;
```

That's it 🎉 Make sure to re-build the app so the native changes are applied and you're good to go 🚀

## Troubleshooting

### Nothing happens when calling the SDK and it returns a cancelled error

Unfortunately the `expo-web-browser` doesn't always return useful errors, but if you are calling sign in, it does nothing and returns a `UserCancelled` error. You are probably encountering issues with iOS Web Credentials.

To fix this ensure the following:

- The Apple App Site Association file includes your app under `webcredentials`
- Inside Xcode -> Signing and Capabilities -> Associated Domains you see both `example-domain.com` and `www.example-domain.com`
- Restart your device or reset the simulator (sometimes it caches old data)

### URLSearchParams.get is not implemented error

If you encounter the `Error: URLSearchParams.get is not implemented` error, you may need to polyfill `url-search-params` in your project.

To do this we can use [core-js](https://github.com/zloirock/core-js) and import it at the root of the app `index.ts` file like this:

```ts
import 'core-js/features/url';
import 'core-js/features/url-search-params';
```

See [this React Native issue](https://github.com/facebook/react-native/issues/38656) for more details.

### Cannot read property 'decode' of undefined error

If you encounter the `Cannot read property 'decode' of undefined` error, there is a conflict with your `URL` polyfill and it is probably being overridden by a third party library.

To locate the issue add this to your root index:

```ts
Object.defineProperty(global, 'URL', {
  value: global.URL,
  writable: false,
  enumerable: true,
  configurable: false,
});
```

Then restart the app and it should throw a `Failed to set polyfill` error, showing where it was called. Remove this polyfill to fix.

If you continue to have issues add the following snippet to your app and confirm it works:

```ts
const url = new URL('https://example-domain.com');
console.log('URL WORKS', url);
```

The `URL` implementation is required by `expo-web-browser`.

## Tests

```sh
$ yarn test
$ yarn test:watch # during development
```
