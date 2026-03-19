import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Play, Pause, Download, Eye, RotateCcw, FileText, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useCheckouts, useCreateCheckout, useRetryTranscription, type Checkout as CheckoutType } from '@/hooks/useCheckouts';

const MIN_DURATION = 300; // 5 minutes in seconds

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function statusBadge(status: string) {
  switch (status) {
    case 'concluida':
      return <Badge className="bg-primary text-primary-foreground">Concluída</Badge>;
    case 'processando':
      return <Badge variant="secondary">Processando</Badge>;
    case 'erro':
      return <Badge variant="destructive">Erro</Badge>;
    default:
      return <Badge variant="outline">Pendente</Badge>;
  }
}

export default function Checkout() {
  const { usuario } = useAuth();
  const { toast } = useToast();

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Filters
  const [filterName, setFilterName] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Dialog
  const [viewCheckout, setViewCheckout] = useState<CheckoutType | null>(null);
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);

  const { data: checkouts = [], isLoading } = useCheckouts({
    collaborator: filterName || undefined,
    dateFrom: filterDateFrom || undefined,
    dateTo: filterDateTo || undefined,
    status: filterStatus && filterStatus !== 'all' ? filterStatus : undefined,
  });
  const createCheckout = useCreateCheckout();
  const retryTranscription = useRetryTranscription();

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setElapsed(0);
      setAudioBlob(null);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível acessar o microfone.', variant: 'destructive' });
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  const handleSubmit = useCallback(async () => {
    if (!audioBlob || !usuario) return;

    if (elapsed < MIN_DURATION) {
      toast({
        title: 'Tempo mínimo não atingido',
        description: `O áudio precisa ter no mínimo 5 minutos. Duração atual: ${formatDuration(elapsed)}.`,
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      const fileName = `${usuario.id}/${Date.now()}.webm`;

      const { error: uploadError } = await supabase.storage
        .from('checkout-audios')
        .upload(fileName, audioBlob, { contentType: 'audio/webm' });

      if (uploadError) throw uploadError;

      const checkout = await createCheckout.mutateAsync({
        usuario_id: usuario.id,
        collaborator_name: usuario.nome,
        duration_seconds: elapsed,
        audio_path: fileName,
      });

      // Trigger transcription in background
      supabase.functions
        .invoke('transcribe-checkout', {
          body: { checkoutId: checkout.id, audioPath: fileName },
        })
        .catch(console.error);

      setAudioBlob(null);
      setElapsed(0);
      toast({ title: 'Checkout enviado!', description: 'A transcrição será processada automaticamente.' });
    } catch (err: any) {
      toast({ title: 'Erro ao enviar', description: err.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  }, [audioBlob, elapsed, usuario, createCheckout, toast]);

  const handleDownloadTxt = (c: CheckoutType) => {
    const content = `CHECKOUT - ${c.collaborator_name}\nData: ${c.checkout_date}\nHora: ${c.checkout_time}\nDuração: ${formatDuration(c.duration_seconds)}\n\n--- TRANSCRIÇÃO ---\n\n${c.transcription || '(sem transcrição)'}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `checkout_${c.collaborator_name}_${c.checkout_date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePlayAudio = async (c: CheckoutType) => {
    if (!c.audio_path) return;
    const { data } = await supabase.storage.from('checkout-audios').createSignedUrl(c.audio_path, 3600);
    if (data?.signedUrl) {
      setPlayingAudioUrl(data.signedUrl);
    }
  };

  const clearFilters = () => {
    setFilterName('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterStatus('all');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Checkout</h1>

      {/* Recording Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5" />
            Gravar Checkout
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="w-4 h-4" />
            O áudio precisa ter no mínimo 5 minutos.
          </div>

          <div className="flex items-center gap-6">
            {/* Timer */}
            <div className={`text-4xl font-mono tabular-nums ${isRecording ? 'text-red-500' : 'text-foreground'}`}>
              {formatDuration(elapsed)}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              {!isRecording && !audioBlob && (
                <Button onClick={startRecording} size="lg" className="gap-2">
                  <Mic className="w-5 h-5" />
                  Gravar checkout
                </Button>
              )}

              {isRecording && (
                <Button onClick={stopRecording} variant="destructive" size="lg" className="gap-2">
                  <MicOff className="w-5 h-5" />
                  Parar gravação
                </Button>
              )}

              {audioBlob && !isRecording && (
                <div className="flex items-center gap-3">
                  <Button onClick={handleSubmit} size="lg" className="gap-2" disabled={isUploading}>
                    {isUploading ? (
                      <Clock className="w-5 h-5 animate-spin" />
                    ) : (
                      <FileText className="w-5 h-5" />
                    )}
                    {isUploading ? 'Enviando...' : 'Enviar checkout'}
                  </Button>
                  <Button onClick={() => { setAudioBlob(null); setElapsed(0); }} variant="outline" size="lg">
                    Descartar
                  </Button>
                </div>
              )}
            </div>
          </div>

          {isRecording && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm text-red-500 font-medium">Gravando...</span>
            </div>
          )}

          {elapsed > 0 && elapsed < MIN_DURATION && !isRecording && audioBlob && (
            <p className="text-sm text-destructive font-medium">
              ⚠ Duração insuficiente ({formatDuration(elapsed)}). O mínimo é 5 minutos.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Colaborador</label>
              <Input placeholder="Buscar por nome" value={filterName} onChange={(e) => setFilterName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data início</label>
              <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data fim</label>
              <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                  <SelectItem value="processando">Processando</SelectItem>
                  <SelectItem value="erro">Erro</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={clearFilters}>Limpar filtros</Button>
          </div>
        </CardContent>
      </Card>

      {/* Checkouts Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : checkouts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum checkout encontrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checkouts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.collaborator_name}</TableCell>
                    <TableCell>{new Date(c.checkout_date + 'T12:00:00').toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>{c.checkout_time?.slice(0, 5)}</TableCell>
                    <TableCell>{formatDuration(c.duration_seconds)}</TableCell>
                    <TableCell>{statusBadge(c.transcription_status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {c.transcription_status === 'concluida' && (
                          <>
                            <Button variant="ghost" size="icon" title="Ver transcrição" onClick={() => setViewCheckout(c)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Baixar .txt" onClick={() => handleDownloadTxt(c)}>
                              <Download className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {c.audio_path && (
                          <Button variant="ghost" size="icon" title="Ouvir áudio" onClick={() => handlePlayAudio(c)}>
                            <Play className="w-4 h-4" />
                          </Button>
                        )}
                        {c.transcription_status === 'erro' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Reprocessar"
                            onClick={() => retryTranscription.mutate(c)}
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Transcription Dialog */}
      <Dialog open={!!viewCheckout} onOpenChange={() => setViewCheckout(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Transcrição — {viewCheckout?.collaborator_name} ({viewCheckout?.checkout_date && new Date(viewCheckout.checkout_date + 'T12:00:00').toLocaleDateString('pt-BR')})
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm space-y-2">
            <p className="text-muted-foreground">
              Hora: {viewCheckout?.checkout_time?.slice(0, 5)} · Duração: {viewCheckout ? formatDuration(viewCheckout.duration_seconds) : ''}
            </p>
            <div className="whitespace-pre-wrap bg-muted rounded-lg p-4 text-sm leading-relaxed">
              {viewCheckout?.transcription || 'Sem transcrição disponível.'}
            </div>
          </div>
          {viewCheckout && (
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => handleDownloadTxt(viewCheckout)}>
                <Download className="w-4 h-4 mr-1" /> Baixar .txt
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Audio Player Dialog */}
      <Dialog open={!!playingAudioUrl} onOpenChange={() => setPlayingAudioUrl(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reproduzir áudio</DialogTitle>
          </DialogHeader>
          {playingAudioUrl && (
            <audio controls autoPlay className="w-full" src={playingAudioUrl} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
