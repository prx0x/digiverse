import type { SelectHTMLAttributes, ReactNode } from 'react';

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  id: string;
  children: ReactNode;
};

export function Select({ label, id, className = '', children, ...rest }: Props) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <select id={id} className={`select ${className}`.trim()} {...rest}>
        {children}
      </select>
    </div>
  );
}
