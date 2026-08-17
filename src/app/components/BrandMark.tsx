import { Link } from 'react-router';
import { LANDING_ROUTE } from '../routes';

export const BrandMark = () => (
  <Link className="brand-mark" to={LANDING_ROUTE} aria-label="Open Keychain">
    <img src="/brand/open-keychain-mark.svg" alt="" width="34" height="34" />
    <span>Open Keychain</span>
  </Link>
);
