import React, { useState, useEffect } from 'react';

interface NumericInputProps {
  value: number;
  onChange: (value: number) => void;
  fallbackValue?: number;
  min?: number;
  max?: number;
  step?: number | string;
  integer?: boolean;
  /** Multiply stored value by scale for display (e.g. 100 for decimal rates displayed as %) */
  displayScale?: number;
  className?: string;
  placeholder?: string;
  title?: string;
}

const formatDisplayValue = (val: number, scale: number): string => {
  if (!Number.isFinite(val)) return '';
  if (scale === 1) return String(val);
  // Strip IEEE-754 noise like 0.06 * 100 -> 6.000000000000001
  return String(Number((val * scale).toFixed(4)));
};

export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChange,
  fallbackValue,
  min,
  max,
  step,
  integer = false,
  displayScale = 1,
  className,
  placeholder,
  title,
}) => {
  const [text, setText] = useState<string>(() => formatDisplayValue(value, displayScale));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setText(formatDisplayValue(value, displayScale));
    }
  }, [value, displayScale, isFocused]);

  const clamp = (n: number): number => {
    let result = n;
    if (min !== undefined && result < min) result = min;
    if (max !== undefined && result > max) result = max;
    return result;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);

    if (raw.trim() === '' || raw === '-' || raw === '.' || raw === '-.') {
      return;
    }

    const parsed = integer ? parseInt(raw, 10) : parseFloat(raw);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      const scaled = displayScale === 1 ? parsed : parsed / displayScale;
      onChange(scaled);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const trimmed = text.trim();
    const parsed = integer ? parseInt(trimmed, 10) : parseFloat(trimmed);

    if (trimmed === '' || Number.isNaN(parsed) || !Number.isFinite(parsed)) {
      const restored = fallbackValue !== undefined ? fallbackValue : value;
      onChange(restored);
      setText(formatDisplayValue(restored, displayScale));
      return;
    }

    const clampedDisplay = clamp(parsed);
    const finalStored = displayScale === 1 ? clampedDisplay : clampedDisplay / displayScale;
    onChange(finalStored);
    setText(formatDisplayValue(finalStored, displayScale));
  };

  return (
    <input
      type="number"
      step={step}
      min={min}
      max={max}
      value={text}
      onFocus={() => setIsFocused(true)}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
      placeholder={placeholder}
      title={title}
    />
  );
};
