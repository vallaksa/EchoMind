/**
 * EchoMind Design System
 * 
 * Dark glassmorphism theme inspired by Linear/Vercel.
 * Deep charcoal backgrounds, frosted glass surfaces,
 * electric indigo accents, Inter typography.
 */
import { createTheme } from '@mui/material/styles';

// ─── Color Tokens ────────────────────────────────────
export const colors = {
  // Backgrounds
  bg: {
    deep: '#0a0a0f',
    surface: '#12121a',
    elevated: '#1a1a2e',
    card: 'rgba(255, 255, 255, 0.04)',
    cardHover: 'rgba(255, 255, 255, 0.07)',
  },
  // Glass
  glass: {
    bg: 'rgba(255, 255, 255, 0.05)',
    bgHover: 'rgba(255, 255, 255, 0.08)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderHover: 'rgba(255, 255, 255, 0.14)',
    blur: '20px',
  },
  // Accent
  accent: {
    primary: '#6366f1',
    primaryHover: '#818cf8',
    primaryMuted: 'rgba(99, 102, 241, 0.15)',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
  },
  // Semantic
  success: '#10b981',
  successMuted: 'rgba(16, 185, 129, 0.15)',
  error: '#ef4444',
  errorMuted: 'rgba(239, 68, 68, 0.15)',
  warning: '#f59e0b',
  warningMuted: 'rgba(245, 158, 11, 0.15)',
  // Text hierarchy
  text: {
    primary: '#f1f5f9',
    secondary: '#94a3b8',
    muted: '#64748b',
    disabled: '#475569',
  },
  // Speaker palette for diarization
  speakers: [
    '#6366f1', // indigo
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#8b5cf6', // violet
    '#f97316', // orange
    '#14b8a6', // teal
  ],
} as const;

// ─── Spacing / Radius ────────────────────────────────
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 9999,
} as const;

// ─── Shadows ─────────────────────────────────────────
export const shadows = {
  sm: '0 2px 8px rgba(0, 0, 0, 0.3)',
  md: '0 4px 16px rgba(0, 0, 0, 0.4)',
  lg: '0 8px 32px rgba(0, 0, 0, 0.5)',
  glow: (color: string) => `0 0 20px ${color}40, 0 0 60px ${color}20`,
} as const;

// ─── Glass Panel Style Mixin ─────────────────────────
export const glassPanel = {
  background: colors.glass.bg,
  backdropFilter: `blur(${colors.glass.blur})`,
  WebkitBackdropFilter: `blur(${colors.glass.blur})`,
  border: `1px solid ${colors.glass.border}`,
  borderRadius: `${radius.lg}px`,
} as const;

// ─── MUI Theme ───────────────────────────────────────
export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: colors.accent.primary,
      light: colors.accent.primaryHover,
    },
    background: {
      default: colors.bg.deep,
      paper: colors.bg.elevated,
    },
    text: {
      primary: colors.text.primary,
      secondary: colors.text.secondary,
      disabled: colors.text.disabled,
    },
    success: { main: colors.success },
    error: { main: colors.error },
    warning: { main: colors.warning },
    divider: colors.glass.border,
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h5: { fontWeight: 600, letterSpacing: '-0.02em' },
    h6: { fontWeight: 600, letterSpacing: '-0.01em' },
    body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
    body2: { fontSize: '0.8125rem', lineHeight: 1.5 },
    caption: { fontSize: '0.75rem', color: colors.text.muted },
  },
  shape: {
    borderRadius: radius.md,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: `linear-gradient(180deg, ${colors.bg.deep} 0%, ${colors.bg.surface} 100%)`,
          minHeight: '100vh',
          scrollbarWidth: 'thin',
          scrollbarColor: `${colors.glass.border} transparent`,
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': {
            background: colors.glass.border,
            borderRadius: 3,
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: radius.md,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: colors.bg.elevated,
          border: `1px solid ${colors.glass.border}`,
          borderRadius: radius.sm,
          fontSize: '0.75rem',
        },
      },
    },
  },
});
