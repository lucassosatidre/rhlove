import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Categoria, Transacao, MetaFinanceira, TipoTransacao, FormaPagamento } from '@/types/finance';

const CATEGORIAS_INICIAIS: Categoria[] = [
  { id: '1', nome: 'Salário', tipo: 'receita', cor: '#2a9d6f' },
  { id: '2', nome: 'Freelance', tipo: 'receita', cor: '#3b82f6' },
  { id: '3', nome: 'Investimentos', tipo: 'receita', cor: '#8b5cf6' },
  { id: '4', nome: 'Outros (Receita)', tipo: 'receita', cor: '#6b7280' },
  { id: '5', nome: 'Alimentação', tipo: 'despesa', cor: '#ef4444' },
  { id: '6', nome: 'Transporte', tipo: 'despesa', cor: '#f97316' },
  { id: '7', nome: 'Moradia', tipo: 'despesa', cor: '#eab308' },
  { id: '8', nome: 'Saúde', tipo: 'despesa', cor: '#14b8a6' },
  { id: '9', nome: 'Educação', tipo: 'despesa', cor: '#6366f1' },
  { id: '10', nome: 'Lazer', tipo: 'despesa', cor: '#ec4899' },
  { id: '11', nome: 'Roupas', tipo: 'despesa', cor: '#a855f7' },
  { id: '12', nome: 'Assinaturas', tipo: 'despesa', cor: '#0ea5e9' },
  { id: '13', nome: 'Outros (Despesa)', tipo: 'despesa', cor: '#6b7280' },
];

const hoje = new Date();
const mesAtual = hoje.getMonth();
const anoAtual = hoje.getFullYear();

function dataAleatoria(mes: number, ano: number): string {
  const dia = Math.floor(Math.random() * 28) + 1;
  return new Date(ano, mes, dia).toISOString();
}

const TRANSACOES_INICIAIS: Transacao[] = [
  { id: 't1', descricao: 'Salário mensal', valor: 8500, categoriaId: '1', data: dataAleatoria(mesAtual, anoAtual), tipo: 'receita', formaPagamento: 'conta_pessoal' },
  { id: 't2', descricao: 'Projeto website freelance', valor: 3200, categoriaId: '2', data: dataAleatoria(mesAtual, anoAtual), tipo: 'receita', formaPagamento: 'pix' },
  { id: 't3', descricao: 'Dividendos FIIs', valor: 450, categoriaId: '3', data: dataAleatoria(mesAtual, anoAtual), tipo: 'receita', formaPagamento: 'conta_pessoal' },
  { id: 't4', descricao: 'Supermercado Pão de Açúcar', valor: 687.50, categoriaId: '5', data: dataAleatoria(mesAtual, anoAtual), tipo: 'despesa', formaPagamento: 'cartao_credito' },
  { id: 't5', descricao: 'Uber e 99', valor: 234.80, categoriaId: '6', data: dataAleatoria(mesAtual, anoAtual), tipo: 'despesa', formaPagamento: 'cartao_credito' },
  { id: 't6', descricao: 'Aluguel apartamento', valor: 2800, categoriaId: '7', data: dataAleatoria(mesAtual, anoAtual), tipo: 'despesa', formaPagamento: 'conta_pessoal' },
  { id: 't7', descricao: 'Plano de saúde Unimed', valor: 580, categoriaId: '8', data: dataAleatoria(mesAtual, anoAtual), tipo: 'despesa', formaPagamento: 'conta_pessoal' },
  { id: 't8', descricao: 'Curso Udemy', valor: 79.90, categoriaId: '9', data: dataAleatoria(mesAtual, anoAtual), tipo: 'despesa', formaPagamento: 'pix' },
  { id: 't9', descricao: 'Cinema e jantar', valor: 185, categoriaId: '10', data: dataAleatoria(mesAtual, anoAtual), tipo: 'despesa', formaPagamento: 'cartao_credito' },
  { id: 't10', descricao: 'Netflix + Spotify', valor: 55.80, categoriaId: '12', data: dataAleatoria(mesAtual, anoAtual), tipo: 'despesa', formaPagamento: 'cartao_credito' },
  { id: 't11', descricao: 'iFood delivery', valor: 312, categoriaId: '5', data: dataAleatoria(mesAtual, anoAtual), tipo: 'despesa', formaPagamento: 'cartao_credito' },
  { id: 't12', descricao: 'Gasolina', valor: 250, categoriaId: '6', data: dataAleatoria(mesAtual, anoAtual), tipo: 'despesa', formaPagamento: 'dinheiro' },
  // Previous months
  { id: 't13', descricao: 'Salário mensal', valor: 8500, categoriaId: '1', data: dataAleatoria(mesAtual - 1, anoAtual), tipo: 'receita', formaPagamento: 'conta_pessoal' },
  { id: 't14', descricao: 'Freelance app mobile', valor: 5000, categoriaId: '2', data: dataAleatoria(mesAtual - 1, anoAtual), tipo: 'receita', formaPagamento: 'pix' },
  { id: 't15', descricao: 'Supermercado', valor: 720, categoriaId: '5', data: dataAleatoria(mesAtual - 1, anoAtual), tipo: 'despesa', formaPagamento: 'cartao_credito' },
  { id: 't16', descricao: 'Aluguel', valor: 2800, categoriaId: '7', data: dataAleatoria(mesAtual - 1, anoAtual), tipo: 'despesa', formaPagamento: 'conta_pessoal' },
  { id: 't17', descricao: 'Academia', valor: 120, categoriaId: '8', data: dataAleatoria(mesAtual - 1, anoAtual), tipo: 'despesa', formaPagamento: 'pix' },
  { id: 't18', descricao: 'Salário mensal', valor: 8500, categoriaId: '1', data: dataAleatoria(mesAtual - 2, anoAtual), tipo: 'receita', formaPagamento: 'conta_pessoal' },
  { id: 't19', descricao: 'Roupas shopping', valor: 450, categoriaId: '11', data: dataAleatoria(mesAtual - 2, anoAtual), tipo: 'despesa', formaPagamento: 'cartao_credito' },
  { id: 't20', descricao: 'Aluguel', valor: 2800, categoriaId: '7', data: dataAleatoria(mesAtual - 2, anoAtual), tipo: 'despesa', formaPagamento: 'conta_pessoal' },
];

const METAS_INICIAIS: MetaFinanceira[] = [
  { id: 'm1', mes: `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}`, valorMeta: 3000, valorAtual: 0 },
];

interface FinanceContextType {
  categorias: Categoria[];
  transacoes: Transacao[];
  metas: MetaFinanceira[];
  adicionarTransacao: (t: Omit<Transacao, 'id'>) => void;
  removerTransacao: (id: string) => void;
  editarTransacao: (t: Transacao) => void;
  adicionarCategoria: (c: Omit<Categoria, 'id'>) => void;
  editarCategoria: (c: Categoria) => void;
  removerCategoria: (id: string) => void;
  atualizarMeta: (m: MetaFinanceira) => void;
}

const FinanceContext = createContext<FinanceContextType | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [categorias, setCategorias] = useState<Categoria[]>(CATEGORIAS_INICIAIS);
  const [transacoes, setTransacoes] = useState<Transacao[]>(TRANSACOES_INICIAIS);
  const [metas, setMetas] = useState<MetaFinanceira[]>(METAS_INICIAIS);

  let nextId = 100;
  const genId = () => String(nextId++);

  const adicionarTransacao = (t: Omit<Transacao, 'id'>) => {
    setTransacoes(prev => [{ ...t, id: `t${Date.now()}` }, ...prev]);
  };

  const removerTransacao = (id: string) => {
    setTransacoes(prev => prev.filter(t => t.id !== id));
  };

  const editarTransacao = (t: Transacao) => {
    setTransacoes(prev => prev.map(x => x.id === t.id ? t : x));
  };

  const adicionarCategoria = (c: Omit<Categoria, 'id'>) => {
    setCategorias(prev => [...prev, { ...c, id: `c${Date.now()}` }]);
  };

  const editarCategoria = (c: Categoria) => {
    setCategorias(prev => prev.map(x => x.id === c.id ? c : x));
  };

  const removerCategoria = (id: string) => {
    setCategorias(prev => prev.filter(c => c.id !== id));
  };

  const atualizarMeta = (m: MetaFinanceira) => {
    setMetas(prev => {
      const exists = prev.find(x => x.id === m.id);
      if (exists) return prev.map(x => x.id === m.id ? m : x);
      return [...prev, m];
    });
  };

  return (
    <FinanceContext.Provider value={{
      categorias, transacoes, metas,
      adicionarTransacao, removerTransacao, editarTransacao,
      adicionarCategoria, editarCategoria, removerCategoria,
      atualizarMeta,
    }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider');
  return ctx;
}
