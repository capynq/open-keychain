export const ResetIconButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    type="button"
    className="reset-icon-button"
    aria-label={label}
    title={label}
    onClick={onClick}
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9a8 8 0 1 1 2.34 5.66M4 9V4m0 5h5" />
    </svg>
  </button>
);
