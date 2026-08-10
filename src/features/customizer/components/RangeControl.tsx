export const RangeControl = ({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}) => (
  <label className="range-control">
    <span className="control-label">
      <span>{label}</span>
      <span>
        {value.toFixed(1)} {unit}
      </span>
    </span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      aria-label={label}
    />
  </label>
);
