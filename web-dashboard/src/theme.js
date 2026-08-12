// src/theme.js - Premium Campus Security Theme
export const theme = {
  colors: {
    // Premium Dark Blue Gradient
    primary: '#0f0c29',
    primaryLight: '#302b63',
    primaryDark: '#24243e',
    primaryGradient: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
    
    // Accent Colors
    accent: '#00d4ff',
    accentLight: '#00b4d8',
    accentGradient: 'linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)',
    
    // Status Colors (Vibrant)
    success: '#00c853',
    successLight: '#69f0ae',
    danger: '#ff1744',
    dangerLight: '#ff8a80',
    warning: '#ff9100',
    warningLight: '#ffab40',
    info: '#2979ff',
    infoLight: '#82b1ff',
    purple: '#d500f9',
    purpleLight: '#ea80fc',
    
    // Backgrounds
    background: '#f8f9fe',
    card: '#ffffff',
    cardGradient: 'linear-gradient(135deg, #ffffff 0%, #f5f7fa 100%)',
    cardHover: 'linear-gradient(135deg, #ffffff 0%, #e8f0fe 100%)',
    
    // Text Colors
    text: '#2d3436',
    textLight: '#636e72',
    textWhite: '#ffffff',
    textMuted: '#b2bec3',
    
    // Borders
    border: '#dfe6e9',
    borderLight: '#f0f2f5',
    
    // Shadows
    shadow: '0 8px 32px rgba(0,0,0,0.08)',
    shadowHover: '0 16px 48px rgba(0,0,0,0.15)',
    shadowGlow: '0 0 40px rgba(0,212,255,0.15)',
    
    // Glass Effect
    glass: 'rgba(255,255,255,0.15)',
    glassBorder: 'rgba(255,255,255,0.2)',
  },
  fonts: {
    family: "'Poppins', 'Segoe UI', Arial, sans-serif",
    sizes: {
      xs: '11px',
      sm: '13px',
      md: '15px',
      lg: '18px',
      xl: '24px',
      xxl: '32px',
      xxxl: '42px'
    }
  },
  animation: {
    duration: '0.3s',
    timing: 'ease-in-out',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
  }
};
