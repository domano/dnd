/** Canonical breakpoint scale for SRD Ledger (CSS media queries use these values). */
export const bp = {
  sm: '480px',
  md: '720px',
  lg: '960px',
  xl: '1100px',
} as const;

export const mq = {
  sm: `(min-width: ${bp.sm})`,
  md: `(min-width: ${bp.md})`,
  lg: `(min-width: ${bp.lg})`,
  xl: `(min-width: ${bp.xl})`,
  maxSm: `(max-width: 479px)`,
  maxMd: `(max-width: 719px)`,
  maxLg: `(max-width: 959px)`,
} as const;
