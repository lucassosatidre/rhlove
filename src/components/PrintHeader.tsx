interface PrintHeaderProps {
  title: string;
  subtitle?: string;
}

export default function PrintHeader({ title, subtitle }: PrintHeaderProps) {
  const now = new Date();
  const formatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} – ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <>
      <div className="print-header hidden print:!flex">
        <div>
          <h1>PIZZARIA ESTRELA DA ILHA – {title.toUpperCase()}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <p>Gerado em: {formatted}</p>
      </div>
      <div className="print-footer hidden print:!block">
        RH Love · Propósito Soluções
      </div>
    </>
  );
}
