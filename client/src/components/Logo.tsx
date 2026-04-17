/**
 * NutriCore Official Logo Component
 * Uses the NTC monogram with NUTRICORE wordmark.
 * This is the ONLY official logo for the app.
 */

import officialLogo from '@assets/IMG_2362-Photoroom_1765782477249.png';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'h-10',
  md: 'h-16',
  lg: 'h-32 md:h-40',
};

export function Logo({ size = 'md', className = '' }: LogoProps) {
  return (
    <img
      src={officialLogo}
      alt="NutriCore"
      className={`${sizeMap[size]} w-auto object-contain ${className}`}
      data-testid="nutricore-logo"
    />
  );
}

export default Logo;
