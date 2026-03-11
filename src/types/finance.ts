export type TipoTransacao = 'receita' | 'despesa';

export type FormaPagamento = 'conta_pessoal' | 'conta_empresa' | 'cartao_credito' | 'dinheiro' | 'pix';

export const FORMAS_PAGAMENTO_LABEL: Record<FormaPagamento, string> = {
  conta_pessoal: 'Conta Pessoal',
  conta_empresa: 'Conta Empresa',
  cartao_credito: 'Cartão de Crédito',
  dinheiro: 'Dinheiro',
  pix: 'PIX',
};

export interface Categoria {
  id: string;
  nome: string;
  tipo: TipoTransacao;
  cor: string;
}

export interface Transacao {
  id: string;
  descricao: string;
  valor: number;
  categoriaId: string;
  data: string; // ISO
  tipo: TipoTransacao;
  formaPagamento: FormaPagamento;
  observacoes?: string;
}

export interface MetaFinanceira {
  id: string;
  mes: string; // YYYY-MM
  valorMeta: number;
  valorAtual: number;
}

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarData(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR');
}
