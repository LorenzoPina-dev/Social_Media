import { SelectHTMLAttributes, forwardRef } from 'react';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helper?: string;
  options: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helper,
      options,
      id,
      className = '',
      ...props
    },
    ref
  ) => {
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className={`${styles.container} ${className}`}>
        {label && (
          <label htmlFor={selectId} className={styles.label}>
            {label}
          </label>
        )}
        
        <div className={styles.wrapper}>
          <select
            ref={ref}
            id={selectId}
            className={`${styles.select} ${error ? styles.error : ''}`}
            aria-invalid={!!error}
            {...props}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <svg className={styles.arrow} viewBox="0 0 24 24">
            <path d="M7 10l5 5 5-5z"/>
          </svg>
        </div>
        
        {error && (
          <p className={styles.errorMessage}>{error}</p>
        )}
        
        {helper && !error && (
          <p className={styles.helper}>{helper}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';