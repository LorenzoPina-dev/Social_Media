import { TextareaHTMLAttributes, forwardRef } from 'react';
import styles from './TextArea.module.css';

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helper?: string;
  maxLength?: number;
  showCount?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      label,
      error,
      helper,
      maxLength,
      showCount = false,
      value = '',
      id,
      className = '',
      ...props
    },
    ref
  ) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
    const currentLength = String(value).length;

    return (
      <div className={`${styles.container} ${className}`}>
        <div className={styles.header}>
          {label && (
            <label htmlFor={textareaId} className={styles.label}>
              {label}
            </label>
          )}
          {showCount && maxLength && (
            <span className={styles.counter}>
              {currentLength}/{maxLength}
            </span>
          )}
        </div>
        
        <textarea
          ref={ref}
          id={textareaId}
          className={`${styles.textarea} ${error ? styles.error : ''}`}
          maxLength={maxLength}
          value={value}
          aria-invalid={!!error}
          {...props}
        />
        
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

TextArea.displayName = 'TextArea';