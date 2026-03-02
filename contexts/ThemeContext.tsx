import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ThemeColorState } from '../types';

interface ThemeContextType {
  themeColor: string; // The current computed color (hex or rgb(a))
  setThemeColor: (color: string) => void;
  isRgbCycling: boolean;
  toggleRgbCycling: () => void;
  toggleFullscreen: () => void;
  isFullscreen: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Helper to convert HSL to RGB (for RGB cycling)
function hslToRgb(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  let c = (1 - Math.abs(2 * l - 1)) * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = l - c / 2,
    r = 0,
    g = 0,
    b = 0;

  if (0 <= h && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (60 <= h && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (120 <= h && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (180 <= h && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (240 <= h && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (300 <= h && h < 360) {
    r = c;
    g = 0;
    b = x;
  }
  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return `rgb(${r}, ${g}, ${b})`;
}

export const ThemeProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const [currentThemeColor, setCurrentThemeColor] = useState<string>(() => {
    // Initialize with a default blue if nothing in localStorage
    return localStorage.getItem('userThemeColor') || '#3B82F6'; // Tailwind's blue-500
  });
  const [isRgbCycling, setIsRgbCycling] = useState<boolean>(() => {
    return localStorage.getItem('isRgbCycling') === 'true';
  });
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Keep track of the hue for RGB cycling
  const hueRef = useRef(0);

  // Load initial theme settings from localStorage
  useEffect(() => {
    const savedThemeColor = localStorage.getItem('userThemeColor');
    const savedIsRgbCycling = localStorage.getItem('isRgbCycling') === 'true';

    if (savedThemeColor) {
      setCurrentThemeColor(savedThemeColor);
    }
    setIsRgbCycling(savedIsRgbCycling);
    // If RGB cycling was active, start the cycle
    if (savedIsRgbCycling) {
      hueRef.current = 0; // Reset hue on load for consistency
    }
  }, []);

  // Save theme settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('userThemeColor', currentThemeColor);
  }, [currentThemeColor]);

  useEffect(() => {
    localStorage.setItem('isRgbCycling', String(isRgbCycling));
  }, [isRgbCycling]);

  // RGB Cycling Effect
  useEffect(() => {
    // In a browser environment, setInterval returns a number, not NodeJS.Timeout
    let intervalId: number;
    if (isRgbCycling) {
      intervalId = setInterval(() => {
        hueRef.current = (hueRef.current + 1) % 360; // Cycle hue from 0 to 359
        setCurrentThemeColor(hslToRgb(hueRef.current, 70, 50)); // Saturated, mid-lightness
      }, 50); // Update every 50ms for a smooth transition
    }
    return () => clearInterval(intervalId);
  }, [isRgbCycling]);


  const setThemeColor = useCallback((color: string) => {
    setCurrentThemeColor(color);
    setIsRgbCycling(false); // Stop RGB cycling if a static color is chosen
  }, []);

  const toggleRgbCycling = useCallback(() => {
    setIsRgbCycling(prev => !prev);
    if (!isRgbCycling) {
      // If turning on RGB cycling, reset hue and start with initial RGB color
      hueRef.current = 0;
      setCurrentThemeColor(hslToRgb(hueRef.current, 70, 50));
    } else {
      // If turning off, revert to the last non-RGB color or a default
      setCurrentThemeColor(localStorage.getItem('userThemeColor') || '#3B82F6');
    }
  }, [isRgbCycling]);

  // Fullscreen logic
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch((err) => {
        console.error(`Error attempting to disable full-screen mode: ${err.message} (${err.name})`);
      });
    }
  }, []);

  // Listen for fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const value = {
    themeColor: currentThemeColor,
    setThemeColor,
    isRgbCycling,
    toggleRgbCycling,
    toggleFullscreen,
    isFullscreen,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};