import { HTMLAttributes, forwardRef } from 'react';
import styles from './Card.module.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'small' | 'medium' | 'large';
  bordered?: boolean;
  hoverable?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      padding = 'medium',
      bordered = true,
      hoverable = false,
      className = '',
      ...props
    },
    ref
  ) => {
    const cardClasses = [
      styles.card,
      styles[`padding-${padding}`],
      bordered ? styles.bordered : '',
      hoverable ? styles.hoverable : '',
      className,
    ].join(' ');

    return (
      <div ref={ref} className={cardClasses} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';