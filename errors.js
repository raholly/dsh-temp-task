/**
 * Host-side errors carry a stable code next to the human-readable message.
 *
 * The Client renders every failure through `t()`; sending a code lets it pick
 * the text in the current DSH language instead of showing the Host's Chinese
 * fallback. `params` fills `{placeholders}` in the Client translation.
 */

export const ERROR_PREFIX = 'temp-task/';

/**
 * Build an Error that the RPC boundary serializes as
 * `{ code, message, details }`.
 */
export function pluginError(code, message, params = {}) {
  const error = new Error(message);
  error.code = `${ERROR_PREFIX}${code}`;
  error.params = params;
  return error;
}
