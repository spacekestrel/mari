declare const __APP_VERSION__: string;

/**
 * The version this build was made from.
 *
 * Written in by the build out of package.json, so it isn't a fifth place to
 * remember when the version goes up. The fallback is only for a test run,
 * where nothing has been through the build at all.
 */
export const appVersion: string =
  typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0";
