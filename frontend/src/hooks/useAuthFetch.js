import { useCallback } from 'react';

/**
 * useAuthFetch
 *
 * Returns a fetch wrapper that automatically attaches the Bearer token
 * from the current auth session. Drop-in replacement for raw `fetch`
 * anywhere in the app.
 *
 * Usage:
 *   const authFetch = useAuthFetch(token);
 *   const res = await authFetch('/api/something', { method: 'POST', ... });
 *
 * @param {string|null} authToken
 * @returns {function} fetch-compatible function
 */
const useAuthFetch = (authToken) => {
  return useCallback((url, opts = {}) => {
    return fetch(url, {
      ...opts,
      headers: {
        ...(opts.headers || {}),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    });
  }, [authToken]);
};

export default useAuthFetch;
