import Spinner from './Spinner';

type ButtonVariant = 'primary' | 'ghost' | 'danger';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

export default function Button({
  children,
  className = '',
  variant = 'primary',
  loading = false,
  disabled,
  ...props
}: ButtonProps) {
  const variantClass =
    variant === 'danger' ? 'crm-btn-danger' : variant === 'ghost' ? 'crm-btn-ghost' : 'crm-btn-primary';

  return (
    <button className={`crm-btn cursor-pointer ${variantClass} ${className}`} disabled={disabled || loading} {...props}>
      {loading ? <Spinner dark={variant === 'ghost'} /> : null}
      {children}
    </button>
  );
}
