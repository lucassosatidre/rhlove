import { useState, useCallback, useRef } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DropZoneProps {
  accept?: string;
  multiple?: boolean;
  onFiles: (files: FileList) => void;
  children?: React.ReactNode;
  /** Compact inline mode — just wraps children with drag support, no visual drop area */
  inline?: boolean;
  className?: string;
  label?: string;
}

export function DropZone({ accept, multiple, onFiles, children, inline, className, label }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const counter = useRef(0);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    counter.current++;
    if (e.dataTransfer.items?.length) setDragging(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    counter.current--;
    if (counter.current === 0) setDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    counter.current = 0;
    if (e.dataTransfer.files?.length) {
      onFiles(e.dataTransfer.files);
    }
  }, [onFiles]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      onFiles(e.target.files);
    }
    e.target.value = '';
  }, [onFiles]);

  if (inline) {
    return (
      <div
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={cn('relative', dragging && 'ring-2 ring-primary ring-offset-2 rounded-lg', className)}
      >
        <input ref={inputRef} type="file" accept={accept} multiple={multiple} className="hidden" onChange={handleChange} />
        {children}
        {dragging && (
          <div className="absolute inset-0 bg-primary/10 rounded-lg flex items-center justify-center pointer-events-none z-10">
            <p className="text-xs font-medium text-primary">Solte aqui</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'relative cursor-pointer border-2 border-dashed rounded-lg p-6 text-center transition-colors',
        dragging
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-primary/50',
        className,
      )}
    >
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} className="hidden" onChange={handleChange} />
      {children || (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Upload className="w-8 h-8 opacity-50" />
          <p className="text-sm">{label || 'Arraste um arquivo aqui ou clique para selecionar'}</p>
        </div>
      )}
      {dragging && !children && (
        <div className="absolute inset-0 bg-primary/10 rounded-lg flex items-center justify-center">
          <p className="text-sm font-medium text-primary">Solte o arquivo aqui</p>
        </div>
      )}
    </div>
  );
}
