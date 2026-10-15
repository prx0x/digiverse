import type { InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  id: string;
};

export function Input({ label, id, className = '', ...rest }: Props) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input id={id} className={`input ${className}`.trim()} {...rest} />
    </div>
  );
}
