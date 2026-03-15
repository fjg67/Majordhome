import { NativeModules, Platform } from 'react-native';

const { NativeHttp } = NativeModules;

/**
 * Native fetch implementation that uses Android's HttpURLConnection
 * directly, bypassing the JS fetch/OkHttp bridge that can hang on
 * some devices (Samsung S24 Ultra / One UI 7).
 *
 * Falls back to global fetch on iOS or if native module unavailable.
 */
export async function nativeFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  // Only use native on Android
  if (Platform.OS !== 'android' || !NativeHttp) {
    return fetch(input, init);
  }

  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const method = init?.method?.toUpperCase() || 'GET';
  const body = init?.body ? String(init.body) : '';

  // Convert Headers to JSON string
  let headersJson = '';
  if (init?.headers) {
    const headerObj: Record<string, string> = {};
    if (init.headers instanceof Headers) {
      init.headers.forEach((value: string, key: string) => {
        headerObj[key] = value;
      });
    } else if (Array.isArray(init.headers)) {
      for (const [key, value] of init.headers) {
        headerObj[key] = value;
      }
    } else {
      Object.assign(headerObj, init.headers);
    }
    headersJson = JSON.stringify(headerObj);
  }

  const result: { status: number; data: string } = await NativeHttp.request(
    method,
    url,
    body,
    headersJson,
  );

  return new Response(result.data, {
    status: result.status,
    headers: { 'content-type': 'application/json' },
  });
}
