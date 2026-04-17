/**
 * NutriCore Premium Logo Component
 * Text-based NTC monogram with NUTRICORE wordmark
 * Adapts to light/dark mode via CSS variables
 */

import React from 'react';

interface NutriCoreLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  className?: string;
}

const sizeMap = {
  sm: {
    monogram: 'text-xl',
    wordmark: 'text-[8px]',
    underline: 'w-12 h-[1px]',
    gap: 'gap-0.5',
  },
  md: {
    monogram: 'text-3xl',
    wordmark: 'text-[10px]',
    underline: 'w-16 h-[1px]',
    gap: 'gap-1',
  },
  lg: {
    monogram: 'text-5xl md:text-6xl',
    wordmark: 'text-xs md:text-sm',
    underline: 'w-24 h-[2px]',
    gap: 'gap-2',
  },
};

export function NutriCoreLogo({ 
  size = 'md', 
  showWordmark = true,
  className = '' 
}: NutriCoreLogoProps) {
  const styles = sizeMap[size];
  
  return (
    <div className={`flex flex-col items-center ${styles.gap} ${className}`} data-testid="nutricore-logo">
      {/* NTC Monogram */}
      <span 
        className={`font-display font-bold tracking-tight leading-none logo-monogram ${styles.monogram}`}
      >
        NTC
      </span>
      
      {showWordmark && (
        <>
          {/* NUTRICORE Wordmark */}
          <span 
            className={`font-display font-medium tracking-[0.25em] uppercase logo-wordmark ${styles.wordmark}`}
          >
            NUTRICORE
          </span>
          
          {/* Gold Accent Underline */}
          <div className={`bg-[#D4AF37] mt-1 ${styles.underline}`} />
        </>
      )}
    </div>
  );
}

// Inline navbar variant - horizontal layout
export function NutriCoreLogoInline({ 
  className = '' 
}: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`} data-testid="nutricore-logo-inline">
      <span className="font-display font-bold text-lg tracking-tight leading-none logo-monogram">
        NTC
      </span>
      <div className="w-[1px] h-4 bg-[#D4AF37] opacity-60" />
      <span className="font-display font-medium text-sm tracking-wide logo-wordmark">
        NutriCore
      </span>
    </div>
  );
}

export default NutriCoreLogo;
