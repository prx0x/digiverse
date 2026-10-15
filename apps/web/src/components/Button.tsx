import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  block?: boolean;
  children: ReactNode;
};

const variantClass: Record<Variant, string> = {
  primary: '',
  secondary: 'btn--secondary',
  danger: 'btn--danger',
  ghost: 'btn--ghost',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', block = false, className = '', children, type = 'button', ...rest },
  ref,
) {
  const classes = ['btn', variantClass[variant], block ? 'btn--block' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button ref={ref} type={type} className={classes} {...rest}>
      {children}
    </button>
  );
});
