import type { CameraViewIconId } from '../../camera/views';

export const CameraViewIcon = ({ icon }: { icon: CameraViewIconId }) => {
  if (icon === 'cube')
    return (
      <svg data-icon={icon} viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 0v9m8-4.5-8 4.5m-8-4.5 8 4.5m0 9v-9" />
      </svg>
    );
  if (icon === 'out-of-plane')
    return (
      <svg data-icon={icon} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 9h10v10H9zM14 14 4 4m0 0v6m0-6h6" />
      </svg>
    );
  if (icon === 'into-plane')
    return (
      <svg data-icon={icon} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 5h10v10H5zM4 4l10 10m0 0V8m0 6H8" />
      </svg>
    );
  const path = {
    'arrow-left': 'M20 12H4m0 0 6-6m-6 6 6 6',
    'arrow-right': 'M4 12h16m0 0-6-6m6 6-6 6',
    'arrow-up': 'M12 20V4m0 0-6 6m6-6 6 6',
    'arrow-down': 'M12 4v16m0 0-6-6m6 6 6-6',
  }[icon];

  return (
    <svg data-icon={icon} viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} />
    </svg>
  );
};
