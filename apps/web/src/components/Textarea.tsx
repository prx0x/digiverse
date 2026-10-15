import type { TextareaHTMLAttributes } from 'react';

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  id: string;
};

export function Textarea({ label, id, className = '', ...rest }: Props) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <textarea id={id} className={`input textarea ${className}`.trim()} {...rest} />
    </div>
  );
}
