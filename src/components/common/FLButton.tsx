import React from 'react';

interface FLButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  danger?: boolean;
  led?: boolean;
  ledActive?: boolean;
  children: React.ReactNode;
}

export const FLButton: React.FC<FLButtonProps> = ({
  active = false,
  danger = false,
  led = false,
  ledActive = false,
  children,
  className = '',
  ...props
}) => {
  let stateClasses = 'bg-gradient-to-b from-[#4a525c] to-[#363d45] text-[var(--tx)] border-[var(--bd)]';

  if (active) {
    stateClasses =
      'bg-gradient-to-b from-[#ffb04a] to-[#e8800c] text-[#1d1300] border-[#7a4300] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_0_10px_rgba(255,155,33,0.35)]';
  } else if (danger) {
    stateClasses =
      'bg-gradient-to-b from-[#4a525c] to-[#363d45] text-[#ffb4b6] border-[var(--bd)] hover:from-[#6b3438] hover:to-[#4a2528] hover:text-white';
  }

  if (led) {
    if (ledActive) {
      stateClasses =
        'bg-gradient-to-b from-[#4a525c] to-[#363d45] text-[var(--tx)] border-[#5d7a2a] shadow-[inset_0_1px_0_rgba(255,255,255,0.13),0_0_0_1px_rgba(155,227,74,0.25)]';
    }
  }

  return (
    <button
      className={`font-semibold text-[12px] leading-none tracking-[0.03em] h-[28px] px-[10px] border rounded-[3px] shadow-[inset_0_1px_0_rgba(255,255,255,0.13),0_1px_1px_rgba(0,0,0,0.4)] cursor-pointer select-none inline-flex items-center justify-center gap-[6px] whitespace-nowrap transition-all duration-75 hover:brightness-110 active:translate-y-[1px] active:brightness-95 focus-visible:outline-2 focus-visible:outline-[var(--ac2)] ${stateClasses} ${className}`}
      {...props}
    >
      {led && (
        <span
          className={`w-2 h-2 rounded-full inline-block flex-shrink-0 transition-all ${
            ledActive
              ? 'bg-[var(--led)] shadow-[0_0_8px_var(--led)]'
              : 'bg-[#2f3d20] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.6)]'
          }`}
        />
      )}
      {children}
    </button>
  );
};
