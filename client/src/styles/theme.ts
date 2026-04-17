/**
 * NUTRICORE UNIFIED DESIGN SYSTEM
 * Dark Mode Only - 3-Color System (Black, White, Gold)
 * All colors, spacing, fonts must come from this file.
 * 
 * ============================================================
 * BRANDING LOCK - IMMUTABLE WITHOUT EXPLICIT INSTRUCTION
 * ============================================================
 * 
 * 3-COLOR SYSTEM:
 * 1. Background: Near-black tones (#000000 to #1A1A1A)
 * 2. Content: White primary (#FFFFFF), soft gray secondary (#B8B8B8)
 * 3. Gold Accent: Warm amber gold for logo, active nav, primary CTAs
 * 
 * ACCENT RESTRICTIONS - Do NOT use for:
 * - Body text
 * - Charts
 * - Error or warning states
 * 
 * ============================================================
 */

// Brand colors - LOCKED
export const brand = {
  gold: "#D4A84B",
  goldDark: "#C49A3D",
  goldLight: "#E4B85B",
  black: "#000000",
  nearBlack: "#0A0A0A",
  elevatedBlack: "#141414",
  subtleBlack: "#1A1A1A",
  white: "#FFFFFF",
  softGray: "#B8B8B8",
  mutedGray: "#888888",
} as const;

// Single theme - Dark mode only
export const darkTheme = {
  background: brand.black,
  foreground: brand.white,
  card: brand.nearBlack,
  cardForeground: brand.white,
  primary: brand.gold,
  primaryForeground: brand.black,
  muted: brand.nearBlack,
  mutedForeground: brand.softGray,
  border: brand.subtleBlack,
  input: brand.nearBlack,
  chatInputBg: brand.nearBlack,
  chatInputBorder: brand.subtleBlack,
  chatBubbleUser: brand.elevatedBlack,
  chatBubbleAi: brand.nearBlack,
  logoGlow: "0 0 20px rgba(212, 168, 75, 0.15)",
} as const;

export const theme = {
  brand,
  dark: darkTheme,
  
  colors: {
    // Primary accent - gold (use sparingly)
    primary: brand.gold,
    primaryHex: brand.gold,
    primaryDark: brand.goldDark,
    primaryLight: brand.goldLight,
    primaryAlpha10: "rgba(212, 168, 75, 0.1)",
    primaryAlpha20: "rgba(212, 168, 75, 0.2)",
    
    // Gold gradient stops
    metallicStart: brand.goldDark,
    metallicMid: brand.gold,
    metallicEnd: brand.goldLight,
    
    // Status colors - no gold
    success: "#22C55E",
    warning: "#EAB308",
    error: "#EF4444",
  },
  
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    section: 32  // Section padding
  },
  
  fontSizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 28,
    xxl: 36
  },
  
  fontWeights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  },
  
  lineHeights: {
    title: 1.1,
    body: 1.45
  },
  
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 18,
    pill: 28,
    bubble: 24,
    full: 9999
  },
  
  shadows: {
    subtle: "0 2px 8px rgba(0, 0, 0, 0.3)",
    card: "0 4px 16px rgba(0, 0, 0, 0.4)",
    inner: "inset 0 2px 4px rgba(0, 0, 0, 0.3)"
  },
  
  transitions: {
    fast: "150ms ease",
    normal: "200ms ease",
    slow: "300ms ease"
  },
  
  layout: {
    maxContentWidth: 900,
    chatMaxWidth: 750,
    inputHeight: 56
  }
} as const;

export type Theme = typeof theme;
