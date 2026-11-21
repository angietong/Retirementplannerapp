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
  /** Format displayed number with thousands separators when not focused */
  formatWithCommas?: boolean;
  /** Optional inline prefix (e.g. "$") */
  prefix?: string;
  /** Optional inline suffix (e.g. "%", "/mo", "yrs") */
  suffix?: string;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  className?: string;
  placeholder?: string;
  title?: string;
}

const formatDisplayValue = (val: number, scale: number, commas: boolean): string => {
  if (!Number.isFinite(val)) return '';
  const scaled = scale === 1 ? val : Number((val * scale).toFixed(4));
  if (!commas) return String(scaled);
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 4,
  }).format(scaled);
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
  formatWithCommas = false,
  prefix,
  suffix,
  disabled = false,
  id,
  ariaLabel,
  className = '',
  placeholder,
  title,
}) => {
  const [text, setText] = useState<string>(() =>
    formatDisplayValue(value, displayScale, formatWithCommas)
  );
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setText(formatDisplayValue(value, displayScale, formatWithCommas));
    }
  }, [value, displayScale, formatWithCommas, isFocused]);

  const clamp = (n: number): number => {
    let result = n;
    if (min !== undefined && result < min) result = min;
    if (max !== undefined && result > max) result = max;
    return result;
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    // Strip commas on focus for easy numeric editing
    setText(formatDisplayValue(value, displayScale, false));
    // Select on focus for quick overwrite
    requestAnimationFrame(() => {
      try {
        e.target.select();
      } catch {
        // Ignore selection errors on unsupported input types
      }
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);

    const cleaned = raw.replace(/,/g, '').trim();
    if (cleaned === '' || cleaned === '-' || cleaned === '.' || cleaned === '-.') {
      return;
    }

    const parsed = integer ? parseInt(cleaned, 10) : parseFloat(cleaned);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      const scaled = displayScale === 1 ? parsed : parsed / displayScale;
      onChange(scaled);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const cleaned = text.replace(/,/g, '').trim();
    const parsed = integer ? parseInt(cleaned, 10) : parseFloat(cleaned);

    if (cleaned === '' || Number.isNaN(parsed) || !Number.isFinite(parsed)) {
      const restored = fallbackValue !== undefined ? fallbackValue : value;
      onChange(restored);
      setText(formatDisplayValue(restored, displayScale, formatWithCommas));
      return;
    }

    const clampedDisplay = clamp(parsed);
    const finalStored = displayScale === 1 ? clampedDisplay : clampedDisplay / displayScale;
    onChange(finalStored);
    setText(formatDisplayValue(finalStored, displayScale, formatWithCommas));
  };

  const inputType = formatWithCommas ? 'text' : 'number';
  const inputMode = integer ? 'numeric' : 'decimal';

  const inputEl = (
    <input
      id={id}
      type={inputType}
      inputMode={inputMode}
      step={formatWithCommas ? undefined : step}
      min={formatWithCommas ? undefined : min}
      max={formatWithCommas ? undefined : max}
      disabled={disabled}
      value={text}
      aria-label={ariaLabel}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      onWheel={e => {
        if (document.activeElement === e.currentTarget) {
          e.currentTarget.blur();
        }
      }}
      className={`tabular-nums ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-11' : ''} ${className}`}
      placeholder={placeholder}
      title={title}
    />
  );

  if (!prefix && !suffix) {
    return inputEl;
  }

  return (
    <div className="relative flex items-center w-full">
      {prefix && (
        <span className="pointer-events-none absolute left-2.5 text-slate-400 text-xs font-medium select-none">
          {prefix}
        </span>
      )}
      {inputEl}
      {suffix && (
        <span className="pointer-events-none absolute right-2.5 text-slate-400 text-xs font-medium select-none">
          {suffix}
        </span>
      )}
    </div>
  );
};
