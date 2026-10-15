import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
};

export function IconButton({ label, className = '', children, type = 'button', ...rest }: Props) {
  return (
    <button type={type} className={`icon-btn ${className}`.trim()} aria-label={label} {...rest}>
      {children}
    </button>
  );
}
