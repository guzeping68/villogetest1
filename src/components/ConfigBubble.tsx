import React from 'react';

interface ConfigBubbleProps {
  file: string;
  field: string;
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right' | 'start';
  theme?: 'light' | 'dark';
}

export const ConfigBubble: React.FC<ConfigBubbleProps> = ({ 
  children, 
}) => {
  return <>{children}</>;
};
