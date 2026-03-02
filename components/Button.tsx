import React from 'react';
import { useTheme } from '../contexts/ThemeContext'; // Import useTheme hook

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  style, // Capture existing style prop
  ...rest
}) => {
  const { themeColor } = useTheme();

  const baseStyles = 'font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-150 ease-in-out';
  
  const variantStyles = {
    primary: `bg-[var(--theme-color)] hover:brightness-110 text-white`, // Use CSS variable
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white',
    outline: `border border-[var(--theme-color)] text-[var(--theme-color)] hover:bg-[var(--theme-color)] hover:text-white`, // Use CSS variable
  };

  const sizeStyles = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg px-6 py-3',
  };

  // Combine existing style with new CSS variable for theme color
  const combinedStyle = {
    '--theme-color': themeColor,
    ...style // Apply any other styles passed in
  } as React.CSSProperties;


  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className} ${rest.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      style={combinedStyle}
      {...rest}
    >
      {children}
    </button>
  );
};

export default Button;