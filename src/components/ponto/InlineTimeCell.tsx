import { useState, useRef, useEffect } from 'react';

interface InlineTimeCellProps {
  value: string | null;
  onSave: (newValue: string | null) => void;
  canEdit: boolean;
}

export function InlineTimeCell({ value, onSave, canEdit }: InlineTimeCellProps) {
  const [editing, setEditing] = useState(false);
  const [tempVal, setTempVal] = useState(value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const handleSave = () => {
    setEditing(false);
    const trimmed = tempVal.trim();
    const newVal = trimmed === '' ? null : trimmed;
    if (newVal !== value) {
      onSave(newVal);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') { setTempVal(value ?? ''); setEditing(false); }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="time"
        value={tempVal}
        onChange={e => setTempVal(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="w-20 h-6 text-xs tabular-nums border border-input rounded px-1 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
      />
    );
  }

  if (!canEdit) {
    return <span className="text-xs tabular-nums">{value ?? '—'}</span>;
  }

  return (
    <button
      onClick={() => { setTempVal(value ?? ''); setEditing(true); }}
      className="text-xs tabular-nums hover:bg-muted/60 rounded px-1 py-0.5 transition-colors cursor-pointer min-w-[2rem] text-left"
      title={value ? 'Clique para editar' : 'Clique para adicionar'}
    >
      {value ? value : <span className="text-muted-foreground">+</span>}
    </button>
  );
}
