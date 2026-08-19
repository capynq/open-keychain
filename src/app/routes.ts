/**
 * Public routes are deliberately kept as a small manifest so browser checks and
 * the application agree on the URLs we support.
 */
export const ROUTE_MANIFEST = [
  { id: 'landing', path: '/' },
  { id: 'create', path: '/create' },
] as const;

export const LANDING_ROUTE = ROUTE_MANIFEST[0].path;
export const CREATE_ROUTE = ROUTE_MANIFEST[1].path;
/** Available only when the hosted account service is enabled. */
export const PROFILE_ROUTE = '/profile';
