import { ButtonHTMLAttributes, forwardRef } from 'react';
import { Spinner } from '../Loading/Spinner';
import styles from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'medium',
      fullWidth = false,
      loading = false,
      icon,
      iconPosition = 'left',
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const buttonClasses = [
      styles.button,
      styles[variant],
      styles[size],
      fullWidth ? styles.fullWidth : '',
      loading ? styles.loading : '',
      className,
    ].join(' ');

    return (
      <button
        ref={ref}
        className={buttonClasses}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <span className={styles.spinner}>
            <Spinner size="small" color="white" />
          </span>
        )}
        
        {icon && iconPosition === 'left' && !loading && (
          <span className={styles.iconLeft}>{icon}</span>
        )}
        
        <span className={styles.content}>{children}</span>
        
        {icon && iconPosition === 'right' && !loading && (
          <span className={styles.iconRight}>{icon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';