import { useEffect } from 'react';

import { CREATE_ROUTE } from '../routes';
import { releasePrewarmedGeometry } from '../routing/geometryPrewarm';
import { isLandingPath } from './useLandingIdlePrewarm';

const isCreatePath = (pathname: string): boolean => pathname.replace(/\/+$/, '') === CREATE_ROUTE;

export const useGeometryPrewarmRelease = (pathname: string): void => {
  useEffect(() => {
    if (isLandingPath(pathname) || isCreatePath(pathname)) return;

    releasePrewarmedGeometry();
  }, [pathname]);
};
