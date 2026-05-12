interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export default function Select({ label, error, className = '', children, ...props }: SelectProps) {
  return (
    <div className="space-y-1">
      {label ? <label className="text-sm font-medium">{label}</label> : null}
      <select className={`crm-input ${className}`} {...props}>
        {children}
      </select>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
