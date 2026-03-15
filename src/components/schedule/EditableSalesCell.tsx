import { useState, useRef, useEffect } from 'react';

interface EditableSalesCellProps {
  label: string;
  value: number | null; // null = no data
  isCurrency?: boolean;
  onSave: (value: number) => void;
  className?: string;
}

export default function EditableSalesCell({ label, value, isCurrency = false, onSave, className = '' }: EditableSalesCellProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const formatDisplay = () => {
    if (value === null || value === undefined) return '-';
    if (value === 0 && !isCurrency) return '0';
    if (isCurrency) {
      return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return String(value);
  };

  const handleClick = () => {
    setInputValue(value && value > 0 ? String(value) : '');
    setEditing(true);
  };

  const handleSave = () => {
    const cleaned = inputValue.replace(/[R$\s.]/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num >= 0) {
      onSave(num);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        {label}{' '}
        <input
          ref={inputRef}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="w-20 bg-background border border-primary/30 rounded px-1 py-0 text-[10px] outline-none focus:border-primary"
          placeholder={isCurrency ? '0,00' : '0'}
        />
      </span>
    );
  }

  return (
    <span
      onClick={handleClick}
      className={`cursor-pointer hover:text-primary transition-colors ${className}`}
      title="Clique para editar"
    >
      {label} {formatDisplay()}
    </span>
  );
}
