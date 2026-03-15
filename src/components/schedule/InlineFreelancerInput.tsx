import { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';

interface InlineFreelancerInputProps {
  onAdd: (name: string) => void;
  compact?: boolean;
  textSize?: string;
}

export default function InlineFreelancerInput({ onAdd, compact, textSize = 'text-xs' }: InlineFreelancerInputProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const handleSave = () => {
    const trimmed = value.trim().toUpperCase();
    if (trimmed) {
      onAdd(trimmed);
    }
    setValue('');
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setValue('');
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        placeholder="Nome do free-lancer..."
        className={`w-full bg-transparent border-none outline-none ${textSize} text-primary placeholder:text-muted-foreground/50 ${compact ? 'py-0' : 'py-0.5'}`}
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={`w-full text-left ${textSize} text-muted-foreground/40 hover:text-primary/60 transition-colors flex items-center gap-1 ${compact ? 'py-0' : 'py-0.5'}`}
    >
      <Plus className="w-3 h-3" />
      <span className="italic">+ free-lancer</span>
    </button>
  );
}
