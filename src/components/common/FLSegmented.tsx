import React from 'react';

interface FLSegmentedOption<T extends string | number> {
  value: T;
  label: string;
}

interface FLSegmentedProps<T extends string | number> {
  options: FLSegmentedOption<T>[];
  value: T;
  onChange: (val: T) => void;
  className?: string;
}

export function FLSegmented<T extends string | number>({
  options,
  value,
  onChange,
  className = '',
}: FLSegmentedProps<T>) {
  return (
    <div className={`flex w-full ${className}`}>
      {options.map((opt, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === options.length - 1;
        const isSelected = opt.value === value;

        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 min-w-0 font-semibold text-[12px] leading-none tracking-[0.03em] h-[28px] px-1 border border-[var(--bd)] select-none inline-flex items-center justify-center -ml-[1px] cursor-pointer transition-all ${
              isFirst ? 'rounded-l-[3px] ml-0' : ''
            } ${isLast ? 'rounded-r-[3px]' : ''} ${
              isSelected
                ? 'relative z-10 bg-gradient-to-b from-[#ffb04a] to-[#e8800c] text-[#1d1300] border-[#7a4300] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_0_10px_rgba(255,155,33,0.35)]'
                : 'bg-gradient-to-b from-[#4a525c] to-[#363d45] text-[var(--tx)] hover:brightness-110 active:translate-y-[1px]'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
