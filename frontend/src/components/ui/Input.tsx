interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  required?: boolean;
}

export default function Input({ label, error, required = false, className = '', ...props }: InputProps) {
  return (
    <div className="space-y-1">
      {label ? <label className="text-sm font-medium">{label} {required ? <span className="text-xs text-red-600">*</span> : null}</label> : null}
      <input className={`crm-input ${className}`} {...props} />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
