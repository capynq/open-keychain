import type { SimpleIcon } from 'simple-icons';

/** Brand artwork from Simple Icons; the parent action supplies its official brand color. */
export const SocialBrandIcon = ({ icon }: { icon: SimpleIcon }) => (
  <svg
    viewBox="0 0 24 24"
    width={20}
    height={20}
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
    data-social-brand={icon.slug}
  >
    <path d={icon.path} />
  </svg>
);
