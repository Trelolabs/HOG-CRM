export default function Spinner({ dark = false }: { dark?: boolean }) {
  return <span className={`crm-spinner ${dark ? 'crm-spinner-dark' : ''}`} aria-hidden="true" />;
}
