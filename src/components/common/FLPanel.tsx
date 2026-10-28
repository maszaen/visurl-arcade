import React from 'react';

interface FLPanelProps {
  title: string;
  tag?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  dotColor?: 'orange' | 'green';
}

export const FLPanel: React.FC<FLPanelProps> = ({
  title,
  tag,
  children,
  className = '',
  bodyClassName = '',
  dotColor = 'orange',
}) => {
  return (
    <section
      className={`min-w-0 bg-gradient-to-b from-[var(--p1)] to-[var(--p2)] border border-[var(--bd)] rounded-[4px] shadow-[inset_0_1px_0_var(--hl),0_1px_2px_rgba(0,0,0,0.45)] ${className}`}
    >
      <div className="flex items-center gap-[6px] h-[22px] px-2 text-[10px] font-bold tracking-[0.14em] uppercase text-[#b9c3ce] bg-gradient-to-b from-[#2c3239] to-[#23282e] border-b border-[var(--bd)] rounded-t-[3px]">
        <span
          className={`w-[6px] h-[6px] rounded-[1px] flex-shrink-0 ${
            dotColor === 'green'
              ? 'bg-[var(--led)] shadow-[0_0_6px_rgba(155,227,74,0.6)]'
              : 'bg-[var(--ac)] shadow-[0_0_6px_rgba(255,155,33,0.6)]'
          }`}
        />
        <span className="truncate">{title}</span>
        {tag && (
          <span className="ml-auto font-semibold tracking-[0.06em] text-[var(--mut)] normal-case text-[10px] whitespace-nowrap">
            {tag}
          </span>
        )}
      </div>
      <div className={`p-[6px] ${bodyClassName}`}>{children}</div>
    </section>
  );
};
