import { ButtonHTMLAttributes, forwardRef } from 'react';
import styles from './IconButton.module.css';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'small' | 'medium' | 'large';
  variant?: 'primary' | 'secondary' | 'ghost';
  rounded?: boolean;
  label: string; // per accessibilità
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      children,
      size = 'medium',
      variant = 'ghost',
      rounded = true,
      label,
      className = '',
      ...props
    },
    ref
  ) => {
    const buttonClasses = [
      styles.iconButton,
      styles[size],
      styles[variant],
      rounded ? styles.rounded : '',
      className,
    ].join(' ');

    return (
      <button
        ref={ref}
        className={buttonClasses}
        aria-label={label}
        title={label}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';