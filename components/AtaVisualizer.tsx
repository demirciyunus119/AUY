import React from 'react';
import { useTheme } from '../contexts/ThemeContext'; // Import useTheme hook

interface AtaVisualizerProps {
  isSpeaking: boolean;
}

const AtaVisualizer: React.FC<AtaVisualizerProps> = ({ isSpeaking }) => {
  const { themeColor } = useTheme();

  const lineStyles = (delay: string) =>
    `h-1 w-10 mx-1 rounded-full transform transition-all duration-300 ease-in-out ${
      isSpeaking ? 'animate-bounce-custom' : ''
    }`;

  // Custom Tailwind animation for varied bounce
  const customAnimationStyles = `
    @keyframes bounce-custom {
      0%, 100% { transform: translateY(0); }
      20% { transform: translateY(-10px); }
      40% { transform: translateY(0); }
      60% { transform: translateY(-5px); }
      80% { transform: translateY(0); }
    }
    .animate-bounce-custom {
      animation: bounce-custom 1.5s infinite;
    }
    .delay-100 { animation-delay: 0.1s; }
    .delay-200 { animation-delay: 0.2s; }
    .delay-300 { animation-delay: 0.3s; }
    .delay-400 { animation-delay: 0.4s; }
    .delay-500 { animation-delay: 0.5s; }
  `;

  return (
    <div className="relative flex justify-center items-center h-24 w-full">
      <style>{customAnimationStyles}</style>
      <div className={`${lineStyles('delay-100')} ${isSpeaking ? 'delay-100' : ''}`} style={{ backgroundColor: themeColor }} />
      <div className={`${lineStyles('delay-200')} ${isSpeaking ? 'delay-200' : ''}`} style={{ backgroundColor: themeColor }} />
      <div className={`${lineStyles('delay-300')} ${isSpeaking ? 'delay-300' : ''}`} style={{ backgroundColor: themeColor }} />
      <div className={`${lineStyles('delay-400')} ${isSpeaking ? 'delay-400' : ''}`} style={{ backgroundColor: themeColor }} />
      <div className={`${lineStyles('delay-500')} ${isSpeaking ? 'delay-500' : ''}`} style={{ backgroundColor: themeColor }} />
    </div>
  );
};

export default AtaVisualizer;