import React from 'react';

interface FLLcdProps {
  label: string;
  value: string | number;
  title?: string;
  variant?: 'orange' | 'green' | 'red';
  className?: string;
}

export const FLLcd: React.FC<FLLcdProps> = ({
  label,
  value,
  title,
  variant = 'orange',
  className = '',
}) => {
  const textColor =
    variant === 'green'
      ? 'text-[var(--led)] [text-shadow:0_0_10px_rgba(155,227,74,0.35)]'
      : variant === 'red'
      ? 'text-[var(--danger)] [text-shadow:0_0_10px_rgba(229,72,77,0.35)]'
      : 'text-[var(--ac)] [text-shadow:0_0_10px_rgba(255,155,33,0.35)]';

  return (
    <div
      title={title}
      className={`min-w-0 p-[5px_7px_6px] bg-[var(--field)] border border-[#06080a] rounded-[3px] shadow-[inset_0_1px_4px_rgba(0,0,0,0.7)] select-none ${className}`}
    >
      <span className="block text-[9px] font-bold tracking-[0.12em] text-[var(--mut)] uppercase truncate">
        {label}
      </span>
      <b
        className={`block mt-1 text-[19px] leading-none font-bold tracking-tight tabular-nums truncate ${textColor}`}
      >
        {value}
      </b>
    </div>
  );
};
