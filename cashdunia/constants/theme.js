export const C = {
  bg: '#0D0D0D',
  surface: '#1A1A2E',
  card: '#141E2E',
  border: '#1E2D45',
  primary: '#E8175D',
  blue: '#4DA6FF',
  gold: '#FFC947',
  gem: '#00C853',
  white: '#FFFFFF',
  muted: '#8A9AB0',
  success: '#00E5A0',
  error: '#FF4757',
  disabled: '#2D3748',
};

export const F = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  bold: 'Poppins_700Bold',
};

export const LEVEL_CONFIG = {
  1: { gemTarget: 5, coinsAwarded: 350, offerType: 'simple', label: 'Level 1', steps: 3 },
  2: { gemTarget: 5, coinsAwarded: 350, offerType: 'install', label: 'Level 2', steps: 5 },
  3: { gemTarget: 5, coinsAwarded: 250, offerType: 'install', label: 'Level 3', steps: 5 },
  4: { gemTarget: 3, coinsAwarded: 250, offerType: 'install', label: 'Level 4', steps: 5 },
};

export const getNextLevel = (current) => (current >= 4 ? 1 : current + 1);

export const avatarColor = (name = '') => {
  const colors = ['#E8175D', '#4DA6FF', '#00C853', '#FFC947', '#B87CFF', '#FF6B35'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + hash * 31;
  return colors[Math.abs(hash) % colors.length];
};

export const COINS_PER_RUPEE = 80;
export const WITHDRAWAL_MIN_COINS = 1200;
