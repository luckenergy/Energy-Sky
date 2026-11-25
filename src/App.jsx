import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Wallet, 
  LogOut, 
  PlusCircle, 
  Settings, 
  Users, 
  ShieldCheck,
  TrendingUp,
  Trash2,
  Edit3,
  Eye,
  Loader2,
  Zap,
  Globe,
  Cpu,
  Wind,
  Sun,
  Factory
} from 'lucide-react';

// --- CONFIGURAÇÃO SUPABASE ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const FALLBACK_PLANS_IMAGES = {
  'Micro Gerador': 'https://images.pexels.com/photos/37226176/pexels-photo-37226176.jpeg?auto=compress&cs=tinysrgb&w=400',
  'Painel Solar': 'https://images.pexels.com/photos/2569839/pexels-photo-2569839.jpeg?auto=compress&cs=tinysrgb&w=400',
  'Subestação Local': 'https://images.pexels.com/photos/9720534/pexels-photo-9720534.jpeg?auto=compress&cs=tinysrgb&w=400',
  'Usina Eólica': 'https://images.pexels.com/photos/185039/pexels-photo-185039.jpeg?auto=compress&cs=tinysrgb&w=400',
  'Complexo Industrial': 'https://images.pexels.com/photos/36756675/pexels-photo-36756675.jpeg?auto=compress&cs=tinysrgb&w=400',
  'Central Nuclear': 'https://images.pexels.com/photos/18335700/pexels-photo-18335700.jpeg?auto=compress&cs=tinysrgb&w=400',
};

function NavItem({ icon, label, active, onClick }) {
  return (
    <button 
      onClick={onClick} 
      className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${active ? 'bg-yellow-500 text-black font-bold' : 'text-gray-500 hover:text-white hover:bg-[#1a1a1a]'}`}
    >
      {React.cloneElement(icon, { className: 'w-6 h-6' })}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

function ProfileScreen({ user, session }) {
  const [investments, setInvestments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const userId = session?.user?.id;

  const money = (value) =>
    Number(value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });

  const dateFormat = (value) =>
    value
      ? new Date(value).toLocaleString('pt-BR')
      : 'Data não disponível';

  const completedStatuses = ['completed', 'paid', 'success', 'processed'];

  const statusLabel = (status) => {
    const labels = {
      approved: 'Aprovado',
      completed: 'Concluído',
      paid: 'Pago',
      success: 'Concluído',
      processed: 'Processado',
      pending: 'Pendente',
      active: 'Ativo',
      rejected: 'Rejeitado',
      cancelled: 'Cancelado',
      canceled: 'Cancelado',
      failed: 'Falhou'
    };
    return labels[String(status || '').toLowerCase()] || status || 'Não informado';
  };

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function loadProfileData() {
      setLoadingProfile(true);
      setErrorMessage('');
      const [invRes, transRes, withRes, depRes] = await Promise.all([
        supabase.from('investments').select('id, amount, status, created_at').eq('user_id', userId),
        supabase.from('transactions').select('id, type, amount, status, description, reference, created_at').eq('user_id', userId),
        supabase.from('withdrawal_requests').select('id, amount, status, created_at').eq('user_id', userId),
        supabase.from('deposit_requests').select('id, amount, status, created_at').eq('user_id', userId)
      ]);
      if (cancelled) return;
      if (invRes.error || transRes.error) setErrorMessage('Erro ao carregar dados financeiros.');
      setInvestments(invRes.data || []);
      setTransactions(transRes.data || []);
      setWithdrawals(withRes.data || []);
      setDeposits(depRes.data || []);
      setLoadingProfile(false);
    }
    loadProfileData();
    return () => { cancelled = true; };
  }, [userId]);

  const totalInvested = investments.filter(item => item.status === 'active').reduce((t, i) => t + Number(i.amount || 0), 0);
  const totalWithdrawn = withdrawals.filter(item => completedStatuses.includes(String(item.status || '').toLowerCase())).reduce((t, i) => t + Number(i.amount || 0), 0);

  const history = [
    ...transactions.map(item => ({ ...item, category: 'transaction', title: item.description || (item.type === 'purchase' ? 'Compra de investimento' : item.type === 'withdraw' ? 'Saque' : item.type === 'deposit' ? 'Depósito' : item.type) })),
    ...withdrawals.map(item => ({ ...item, type: 'withdraw', category: 'withdrawal', title: 'Solicitação de saque' })),
    ...deposits.map(item => ({ ...item, type: 'deposit', category: 'deposit', title: 'Solicitação de depósito' }))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const filteredHistory = history.filter(item => filter === 'all' || item.type === filter);

  return (
    <div className="p-5 md:p-8 max-w-6xl mx-auto space-y-8 pb-32">
      <div >
        <h2 className="text-3xl font-black text-white">Meu <span className="text-yellow-500">Perfil</span></h2>
        <p className="text-gray-500 mt-2">Consulte seus dados e seu histórico financeiro.</p>
      </div>
      <div className="bg-[#111] border border-[#222] rounded-3xl p-6 space-y-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center">
            <Users className="w-8 h-8 text-yellow-500" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">{user?.full_name || 'Cliente'}</h3>
            <p className="text-gray-500 text-sm">Dados da sua conta</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#1a1a1a] rounded-2xl p-4">
            <p className="text-gray-500 text-xs mb-2">NOME COMPLETO</p>
            <p className="text-white font-semibold">{user?.full_name || 'Não informado'}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-2xl p-4">
            <p className="text-gray-500 text-xs mb-2">E-MAIL</p>
            <p className="text-white font-semibold">{user?.email || 'Não informado'}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-2xl p-4">
            <p className="text-gray-500 text-xs mb-2">TELEFONE</p>
            <p className="text-white font-semibold">{user?.phone || 'Não informado'}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-2xl p-4 border border-yellow-500/20">
            <p className="text-yellow-500 text-xs mb-2 font-bold">CPF (IMUTÁVEL)</p>
            <p className="text-white font-bold">{user?.cpf || 'Não informado'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-green-400 text-xs">
          <ShieldCheck className="w-4 h-4" />
          Informações de segurança verificadas e imutáveis.
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#111] border border-[#222] rounded-3xl p-6">
          <div className="flex items-center justify-between">
            <p className="text-gray-500 text-sm">Total investido ativo</p>
            <TrendingUp className="text-green-400" />
          </div>
          <h3 className="text-3xl font-black text-green-400 mt-3">{money(totalInvested)}</h3>
        </div>
        <div className="bg-[#111] border border-[#222] rounded-3xl p-6">
          <div className="flex items-center justify-between">
            <p className="text-gray-500 text-sm">Total sacado concluído</p>
            <Wallet className="text-yellow-500" />
          </div>
          <h3 className="text-3xl font-black text-white mt-3">{money(totalWithdrawn)}</h3>
        </div>
      </div>
      <div className="bg-[#111] border border-[#222] rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-[#222] flex flex-col md:flex-row justify-between gap-4">
          <h3 className="text-xl font-bold text-white">Histórico financeiro</h3>
          <select value={filter} onChange={e => setFilter(e.target.value)} className="bg-[#1a1a1a] border border-[#333] text-white rounded-xl p-3 outline-none">
            <option value="all">Todas as movimentações</option>
            <option value="purchase">Investimentos</option>
            <option value="deposit">Depósitos</option>
            <option value="withdraw">Saques</option>
          </select>
        </div>
        {loadingProfile ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 text-yellow-500 animate-spin" /></div>
        ) : filteredHistory.length === 0 ? (
          <div className="p-12 text-center text-gray-500">Nenhuma movimentação encontrada.</div>
        ) : (
          <div className="divide-y divide-[#222]">
            {filteredHistory.map((item, index) => (
              <div key={index} className="p-5 flex items-center justify-between hover:bg-[#1a1a1a] transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${item.type === 'withdraw' ? 'bg-red-500/10 text-red-400' : item.type === 'deposit' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-500'}`}>
                    {item.type === 'withdraw' ? <Wallet className="w-5 h-5" /> : item.type === 'deposit' ? <PlusCircle className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-white font-bold">{item.title}</p>
                    <p className="text-gray-500 text-xs">{dateFormat(item.created_at)} • {statusLabel(item.status)}</p>
                  </div>
                </div>
                <p className={`font-bold ${item.type === 'withdraw' ? 'text-red-400' : item.type === 'deposit' ? 'text-green-400' : 'text-white'}`}>
                  {item.type === 'withdraw' ? '-' : item.type === 'deposit' ? '+' : ''}{money(item.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


function ReferralScreen({ user, setUser }) {
  const [code, setCode] = useState('');
  const [commissions, setCommissions] = useState([]);
  const [loadingReferral, setLoadingReferral] = useState(true);
  const [copied, setCopied] = useState(false);

  const money = (value) =>
    Number(value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });



useEffect(() => {
  if (!user?.id) return;

  let cancelled = false;

  async function loadReferral() {
    setLoadingReferral(true);

    try {
      // Buscar código de indicação
      let { data, error } = await supabase
        .from('referral_profiles')
        .select('referral_code')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      // Criar código caso não exista
      if (!data) {
        const newCode = crypto.randomUUID()
          .replace(/-/g, '')
          .substring(0, 10)
          .toUpperCase();

        const { data: newProfile, error: insertError } =
          await supabase
            .from('referral_profiles')
            .insert({
              user_id: user.id,
              referral_code: newCode
            })
            .select('referral_code')
            .single();

        if (insertError) throw insertError;

        data = newProfile;
      }

      if (cancelled) return;

      setCode(data.referral_code);

      // Buscar comissões
      const { data: commissionData, error: commissionError } =
        await supabase
          .from('referral_commissions')
          .select('id, referred_user_id, amount, rate, created_at')
          .eq('referrer_id', user.id)
          .order('created_at', { ascending: false });

      if (commissionError) throw commissionError;

      if (cancelled) return;

      setCommissions(commissionData || []);

      // Atualizar saldo da conta
      const { data: profileData, error: profileError } =
        await supabase
          .from('profiles')
          .select('balance')
          .eq('id', user.id)
          .single();

      if (profileError) throw profileError;

      if (!cancelled && profileData) {
        setUser(prev => ({
          ...prev,
          balance: Number(profileData.balance || 0)
        }));
      }

    } catch (error) {
      console.error('Erro nas indicações:', error);
      alert('Erro ao carregar indicações: ' + error.message);
    } finally {
      if (!cancelled) setLoadingReferral(false);
    }
  }

  loadReferral();

  return () => {
    cancelled = true;
  };
}, [user?.id, setUser]);



  const totalIndications = new Set(
    commissions.map(item => item.referred_user_id)
  ).size;

  const totalEarned = commissions.reduce(
    (total, item) => total + Number(item.amount || 0),
    0
  );

  const level =
    totalIndications >= 50
      ? { name: 'OURO', rate: 5, color: 'text-yellow-400' }
      : totalIndications >= 10
      ? { name: 'PRATA', rate: 2, color: 'text-gray-300' }
      : { name: 'BRONZE', rate: 1, color: 'text-orange-400' };

  const nextLevel = totalIndications >= 50 ? 50 :
    totalIndications >= 10 ? 50 : 10;

  const progress = totalIndications >= 50
    ? 100
    : totalIndications >= 10
    ? ((totalIndications - 10) / 40) * 100
    : (totalIndications / 10) * 100;

  const referralLink = code
    ? `${window.location.origin}/?ref=${code}`
    : '';

  const copyLink = async () => {
    if (!referralLink) return;

    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (loadingReferral) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-5 md:p-8 max-w-6xl mx-auto space-y-8 pb-32">

      <div>
        <h2 className="text-3xl font-black text-white">
          Programa de <span className="text-yellow-500">Indicações</span>
        </h2>
        <p className="text-gray-500 mt-2">
          Indique amigos e receba comissões sobre compras aprovadas.
        </p>
      </div>

      <div className="bg-[#111] border border-[#222] rounded-3xl p-6 md:p-8 space-y-5">
        <div>
          <p className="text-gray-400 text-sm">Seu link exclusivo</p>
          <h3 className="text-xl font-bold text-white mt-1">
            Compartilhe e indique
          </h3>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <input
            readOnly
            value={referralLink}
            placeholder="Seu link será gerado automaticamente"
            className="flex-1 min-w-0 bg-[#1a1a1a] border border-[#333] p-4 rounded-xl text-yellow-400"
          />

          <button
            onClick={copyLink}
            disabled={!referralLink}
            className="bg-yellow-500 text-black font-bold px-6 py-4 rounded-xl"
          >
            {copied ? 'Link copiado!' : 'Copiar link'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        <div className="bg-[#111] border border-[#222] rounded-3xl p-6">
          <Users className="text-yellow-500 w-7 h-7" />
          <p className="text-gray-500 mt-4 text-sm">
            Indicações confirmadas
          </p>
          <h3 className="text-3xl font-black text-white mt-2">
            {totalIndications}
          </h3>
        </div>

        <div className="bg-[#111] border border-[#222] rounded-3xl p-6">
          <Wallet className="text-green-400 w-7 h-7" />
          <p className="text-gray-500 mt-4 text-sm">
            Comissões acumuladas
          </p>
          <h3 className="text-3xl font-black text-green-400 mt-2">
            {money(totalEarned)}
          </h3>
        </div>

        <div className="bg-[#111] border border-[#222] rounded-3xl p-6">
          <TrendingUp className="text-yellow-500 w-7 h-7" />
          <p className="text-gray-500 mt-4 text-sm">Seu nível atual</p>
          <h3 className={`text-3xl font-black mt-2 ${level.color}`}>
            {level.name}
          </h3>
          <p className="text-gray-500 text-sm mt-1">
            Comissão de {level.rate}%
          </p>
        </div>

      </div>

      <div className="bg-[#111] border border-[#222] rounded-3xl p-6 space-y-5">
        <h3 className="text-xl font-bold text-white">
          Progresso dos níveis
        </h3>

        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Seu progresso</span>
          <span className="text-yellow-500 font-bold">
            {totalIndications} indicações
          </span>
        </div>

        <div className="w-full h-3 bg-[#222] rounded-full overflow-hidden">
          <div
            className="h-full bg-yellow-500 rounded-full transition-all"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-[#1a1a1a] rounded-xl p-3">
            <p className="text-orange-400 font-black">BRONZE</p>
            <p className="text-white font-bold">1%</p>
            <p className="text-gray-500 text-xs">Inicial</p>
          </div>

          <div className="bg-[#1a1a1a] rounded-xl p-3">
            <p className="text-gray-300 font-black">PRATA</p>
            <p className="text-white font-bold">2%</p>
            <p className="text-gray-500 text-xs">10 indicações</p>
          </div>

          <div className="bg-[#1a1a1a] rounded-xl p-3">
            <p className="text-yellow-400 font-black">OURO</p>
            <p className="text-white font-bold">5%</p>
            <p className="text-gray-500 text-xs">50 indicações</p>
          </div>
        </div>

        {totalIndications < 50 && (
          <p className="text-gray-400 text-sm">
            Faltam {nextLevel - totalIndications} indicações
            para o próximo nível.
          </p>
        )}
      </div>

      <div className="bg-[#111] border border-[#222] rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-[#222]">
          <h3 className="text-xl font-bold text-white">
            Histórico de comissões
          </h3>
        </div>

        {commissions.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            Você ainda não possui comissões.
          </div>
        ) : (
          <div className="divide-y divide-[#222]">
            {commissions.map(item => (
              <div
                key={item.id}
                className="p-5 flex justify-between items-center gap-3"
              >
                <div>
                  <p className="text-white font-bold">
                    Compra indicada
                  </p>
                  <p className="text-gray-500 text-xs">
                    {new Date(item.created_at).toLocaleDateString('pt-BR')}
                    {' • '}
                    {Number(item.rate) * 100}%
                  </p>
                </div>

                <p className="text-green-400 font-bold">
                  {money(item.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}


const WalletScreen = ({ user, setUser, handleWithdraw }) => {
  // Estados da carteira
  const [pixInput, setPixInput] = useState(user?.pixKey || user?.pix_key || '');
  const [pixSaved, setPixSaved] = useState(false);

  // Estados de depósito
  const [depositAmount, setDepositAmount] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositError, setDepositError] = useState('');
  const [pixPayment, setPixPayment] = useState(null);

  // Estados de saque
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  // Verifica se existe uma chave PIX cadastrada
  const savedPix = user?.pixKey || user?.pix_key || '';
  const isPixLocked = Boolean(String(savedPix).trim());

  // Formatação de valores
  const formatMoney = (value) =>
    Number(value || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // Salvar chave PIX
  const handleSavePix = async () => {
    if (isPixLocked) return;

    const cleanPix = String(pixInput || '').replace(/\D/g, '');

    if (cleanPix.length !== 11) {
      alert('Digite um CPF válido com 11 números.');
      return;
    }

    const userCpf = String(user?.cpf || '').replace(/\D/g, '');

    if (userCpf && cleanPix !== userCpf) {
      alert('A chave PIX deve ser exatamente o mesmo CPF do seu cadastro.');
      return;
    }

    if (!user?.id) {
      alert('Faça login novamente.');
      return;
    }

    const confirmar = window.confirm(
      `Atenção: após salvar a chave PIX (${cleanPix}), ela não poderá mais ser alterada. Deseja confirmar?`
    );

    if (!confirmar) return;

    try {
      // A gravação é feita pela função SECURITY DEFINER do banco.
      // Assim, o navegador não precisa de permissão UPDATE em profiles.
      const { data: result, error: rpcError } = await supabase.rpc(
        'register_my_pix',
        { p_pix_key: cleanPix }
      );

      if (rpcError) throw rpcError;

      if (result?.success !== true) {
        throw new Error('O banco não confirmou o salvamento da chave PIX.');
      }

      // Confirma a persistência lendo novamente os campos do próprio perfil.
      const { data: savedProfile, error: verifyError } = await supabase
        .from('profiles')
        .select('pix_key, pixKey')
        .eq('id', user.id)
        .single();

      if (verifyError) throw verifyError;

      const confirmedPix = String(
        savedProfile?.pix_key || savedProfile?.pixKey || ''
      ).replace(/\D/g, '');

      if (confirmedPix !== cleanPix) {
        throw new Error('A chave PIX não foi encontrada no perfil após a gravação.');
      }

      setUser((prev) => ({
        ...prev,
        pix_key: savedProfile.pix_key || cleanPix,
        pixKey: savedProfile.pixKey || cleanPix,
      }));

      setPixInput(confirmedPix);
      setPixSaved(true);

      setTimeout(() => setPixSaved(false), 3000);

      alert('Chave PIX salva e confirmada no banco de dados!');
    } catch (error) {
      console.error('Erro ao salvar PIX:', error);
      alert('Erro ao salvar chave PIX: ' + (error.message || 'Tente novamente.'));
    }
  };
// GERAR DEPÓSITO PIX - MISTICPay
// O CPF e o nome são conferidos pela Edge Function no perfil autenticado.
const handleDeposit = async () => {
  const amount = Number(depositAmount);

  if (!Number.isFinite(amount) || amount < 1 || amount !== Math.round(amount * 100) / 100) {
    setDepositError('Digite um valor válido, mínimo de R$ 1,00.');
    return;
  }

  if (!user?.id) {
    setDepositError('Faça login novamente.');
    return;
  }

  // Validação visual básica. A validação definitiva do CPF é feita no servidor.
  const profileCpf = String(user?.cpf || '').replace(/\D/g, '');
  if (profileCpf.length !== 11) {
    setDepositError('Cadastre um CPF válido no seu perfil antes de depositar.');
    return;
  }

  setDepositLoading(true);
  setDepositError('');
  setPixPayment(null);

  try {
    // Confirma a sessão autenticada
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError || !sessionData?.session) {
      throw new Error('Sua sessão expirou. Faça login novamente.');
    }

    // Chave única para identificar esta solicitação de depósito
    const idempotencyKey = crypto.randomUUID();

    const { data, error } = await supabase.functions.invoke(
      'create-misticpay-pix',
      {
        headers: {
          'X-Idempotency-Key': idempotencyKey,
        },
        body: {
          amount,
          transactionId: idempotencyKey,
          description: 'Deposito PIX',
        },
      }
    );

    if (error) {
      console.error('Erro ao chamar create-misticpay-pix:', error);
      throw new Error(error.message || 'Falha na comunicação com a função de depósito.');
    }

    if (!data?.success) {
      throw new Error(data?.error || 'Não foi possível gerar o PIX.');
    }

    const pixResult = data.data || data;

    const copyPaste =
      data.copyPaste ||
      pixResult.copyPaste ||
      pixResult.copy_paste ||
      pixResult.pixCopiaECola ||
      pixResult.pix_copy_paste ||
      pixResult.emv ||
      null;

    const qrCodeBase64 =
      data.qrCodeBase64 ||
      pixResult.qrCodeBase64 ||
      pixResult.qr_code_base64 ||
      pixResult.qrcodeBase64 ||
      pixResult.base64 ||
      data.qrcodeUrl ||
      pixResult.qrcodeUrl ||
      pixResult.qrCodeUrl ||
      null;

    if (!copyPaste && !qrCodeBase64) {
      throw new Error('A MisticPay não retornou os dados do PIX.');
    }

    // A Edge Function salva a solicitação no banco; não inserir novamente aqui.
    setPixPayment({
      ...pixResult,
      transactionId: data.transactionId || pixResult.transactionId,
      copyPaste,
      qrCodeBase64,
      amount,
    });

    setDepositAmount('');
  } catch (error) {
    console.error('Erro ao gerar depósito PIX:', error);
    setDepositError(error.message || 'Erro ao gerar PIX.');
  } finally {
    setDepositLoading(false);
  }
};
  
  // Solicitar saque
  const onWithdrawClick = async () => {
    const amount = Number(withdrawAmount);
    const balance = Number(user?.balance || 0);

    if (!isPixLocked) {
      alert('Cadastre sua chave PIX antes de solicitar um saque.');
      return;
    }

    if (!Number.isFinite(amount) || amount < 10) {
      alert('O valor mínimo para saque é R$ 10,00.');
      return;
    }

    if (amount > balance) {
      alert('Saldo insuficiente para este valor de saque.');
      return;
    }

    if (!handleWithdraw) {
      alert('Função de saque não encontrada.');
      return;
    }

    setWithdrawLoading(true);

    try {
      await handleWithdraw(amount);
      setWithdrawAmount('');
    } catch (error) {
      console.error('Erro ao solicitar saque:', error);
      alert(error.message || 'Não foi possível solicitar o saque.');
    } finally {
      setWithdrawLoading(false);
    }
  };

  // Copiar código PIX
  const copyPixCode = async () => {
    try {
      await navigator.clipboard.writeText(pixPayment.copyPaste);
      alert('Código PIX copiado com sucesso!');
    } catch (error) {
      alert('Não foi possível copiar automaticamente. Copie o código manualmente.');
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div className="bg-[#111] p-8 rounded-3xl border border-[#222] space-y-8">

        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222] pb-6">
          <div className="flex items-center gap-4">
            <Wallet className="text-yellow-500 w-8 h-8" />
            <h2 className="text-2xl font-bold text-white">
              Carteira Digital
            </h2>
          </div>

          <div className="bg-[#1a1a1a] px-4 py-2 rounded-2xl border border-[#333]">
            <p className="text-xs text-gray-500">
              Saldo Disponível
            </p>
            <p className="text-xl font-black text-yellow-500">
              R$ {formatMoney(user?.balance)}
            </p>
          </div>
        </div>

        {/* Chave PIX */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <label className="text-gray-400 text-sm font-medium">
              Chave PIX para Saque (Deve ser seu CPF)
            </label>

            {isPixLocked ? (
              <span className="text-yellow-500 text-xs font-bold">
                🔒 Chave vinculada
              </span>
            ) : (
              pixSaved && (
                <span className="text-green-500 text-xs font-bold">
                  ✓ Chave PIX salva!
                </span>
              )
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={isPixLocked ? savedPix : pixInput}
              onChange={(e) => setPixInput(e.target.value)}
              disabled={isPixLocked}
              maxLength={14}
              placeholder="Digite seu CPF (somente números)"
              className={`flex-1 min-w-0 bg-[#1a1a1a] border border-[#333] p-3 rounded-xl text-white outline-none transition-all ${
                isPixLocked
                  ? 'opacity-60 cursor-not-allowed text-gray-400'
                  : 'focus:border-yellow-500'
              }`}
            />

            {!isPixLocked && (
              <button
                type="button"
                onClick={handleSavePix}
                className="bg-green-600 hover:bg-green-500 text-white px-5 py-3 rounded-xl font-bold transition-all"
              >
                Salvar Chave
              </button>
            )}
          </div>

          {isPixLocked && (
            <p className="text-xs text-gray-500">
              Por segurança, esta chave PIX não pode ser alterada.
              Todos os saques serão destinados a ela.
            </p>
          )}
        </div>

        {/* Depósito e Saque */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-[#222]">

          {/* Depósito */}
          <div className="space-y-4">
            <label className="text-gray-400 text-sm font-medium block">
              Depositar Valor (PIX)
            </label>

            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                step="0.01"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="R$ 0,00"
                disabled={depositLoading}
                className="w-full min-w-0 bg-[#1a1a1a] border border-[#333] p-3 rounded-xl text-white outline-none focus:border-yellow-500"
              />

              <button
                type="button"
                onClick={handleDeposit}
                disabled={depositLoading}
                className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 rounded-xl font-bold disabled:opacity-50 transition-all whitespace-nowrap"
              >
                {depositLoading ? 'Gerando...' : 'Depositar'}
              </button>
            </div>

            {depositError && (
              <p className="text-red-500 text-sm">
                {depositError}
              </p>
            )}

            {/* Resultado do PIX */}
            {pixPayment && (
              <div className="bg-[#1a1a1a] border border-yellow-500/30 rounded-xl p-4 space-y-4">
                <h3 className="text-white font-bold text-center">
                  PIX gerado com sucesso!
                </h3>

                <p className="text-yellow-500 text-center font-bold">
                  R$ {formatMoney(pixPayment.amount || depositAmount)}
                </p>

                {pixPayment.qrCodeBase64 && (
                  <img
                    src={
                      pixPayment.qrCodeBase64.startsWith('data:image')
                        ? pixPayment.qrCodeBase64
                        : `data:image/png;base64,${pixPayment.qrCodeBase64}`
                    }
                    alt="QR Code PIX"
                    className="w-48 h-48 mx-auto bg-white p-2 rounded-xl object-contain"
                  />
                )}

                {pixPayment.copyPaste && (
                  <>
                    <textarea
                      readOnly
                      value={pixPayment.copyPaste}
                      className="w-full bg-black text-white p-3 rounded-lg text-xs resize-none"
                      rows={4}
                    />

                    <button
                      type="button"
                      onClick={copyPixCode}
                      className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold p-3 rounded-xl transition-all"
                    >
                      Copiar código PIX
                    </button>
                  </>
                )}

                <p className="text-gray-400 text-xs text-center">
                  Seu saldo será atualizado após a confirmação
                  do pagamento pelo sistema.
                </p>
              </div>
            )}
          </div>

          {/* Saque */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <label className="text-gray-400 text-sm font-medium">
                Solicitar Saque (Mín. R$ 10,00)
              </label>

              <button
                type="button"
                onClick={() =>
                  setWithdrawAmount(String(user?.balance || 0))
                }
                disabled={!isPixLocked || withdrawLoading}
                className="text-xs text-yellow-500 hover:underline font-bold disabled:opacity-40"
              >
                Usar Máx
              </button>
            </div>

            <input
              type="number"
              min="20"
              step="0.01"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="R$ 10,00"
              disabled={withdrawLoading || !isPixLocked}
              className="w-full bg-[#1a1a1a] border border-[#333] p-3 rounded-xl text-white outline-none focus:border-yellow-500 disabled:opacity-50"
            />

            <button
              type="button"
              onClick={onWithdrawClick}
              disabled={withdrawLoading || !isPixLocked}
              className="w-full bg-green-500 hover:bg-green-400 text-black px-5 py-3 rounded-xl font-bold disabled:opacity-50 transition-all"
            >
              {withdrawLoading ? 'Enviando...' : 'Solicitar Saque'}
            </button>

            {!isPixLocked ? (
              <p className="text-yellow-500 text-xs">
                🔒 Cadastre e salve sua chave PIX acima para
                liberar a solicitação de saque.
              </p>
            ) : (
              <p className="text-gray-400 text-xs">
                O saque será destinado à chave PIX cadastrada:
                <span className="text-yellow-500 font-bold">
                  {' '}{savedPix}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function EnergySkyApp() {
  const [page, setPage] = useState('auth'); 
  const [user, setUser] = useState(null); 
  const [session, setSession] = useState(null); 
  const [plans, setPlans] = useState([]);
  const [authMode, setAuthMode] = useState('login');
  const [loading, setLoading] = useState(true);
  const [gateway, setGateway] = useState('');
  const [communityLink, setCommunityLink] = useState('');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [buying, setBuying] = useState(false);
  const [referralCode, setReferralCode] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeFromUrl = params.get('ref');

    if (codeFromUrl) {
      localStorage.setItem('referral_code', codeFromUrl);
      setReferralCode(codeFromUrl);
    } else {
      setReferralCode(localStorage.getItem('referral_code') || '');
    }
  }, []);  

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchUserProfile(session.user.id);
      else setPage('auth');
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
        setPage('dashboard');
      } else {
        setUser(null);
        setPage('auth');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function loadAppData() {
      const { data: plansData } = await supabase.from('plans').select('*');
      const plansWithImages = (plansData || []).map(plan => ({
        ...plan,
        img: plan.img || FALLBACK_PLANS_IMAGES[plan.name] || 'https://via.placeholder.com/400'
      }));
      setPlans(plansWithImages);
      const { data: config } = await supabase.from('config').select('value').eq('key', 'pix_gateway').single();
      if (config) setGateway(config.value);
      const { data: communityConfig } = await supabase
      .from('config')
      .select('value')
      .eq('key', 'community_link')
      .maybeSingle();

      if (communityConfig?.value) {
      setCommunityLink(communityConfig.value);
      }
    }
    loadAppData();
  }, []);

  async function fetchUserProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setUser(data);
  }

  const handleAuth = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const email = formData.get('email') || formData.get('login');
    const password = formData.get('password');
    if (authMode === 'register') {
      const name = formData.get('name');
      const phone = formData.get('phone');
      const cpf = formData.get('cpf');
      if (!cpf) return alert('O CPF é obrigatório!');
      const savedReferral =
  localStorage.getItem('referral_code') || referralCode || null;

      const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
      data: {
      full_name: name,
      phone: phone,
      cpf: cpf,
      referral_code: savedReferral
      }
      }
      });
      if (error) return alert(error.message);
      if (data.user) {
        const { data: profileData } = await supabase.from('profiles').upsert({ id: data.user.id, full_name: name, phone: phone, email: email, cpf: cpf }).select().single();
        setUser(profileData);
        setPage('dashboard');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return alert('E-mail ou senha incorretos!');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setPage('auth');
  };

  const handleBuy = (plan) => setSelectedPlan(plan);

  const confirmBuy = async () => {
    if (!selectedPlan || buying) return;
    if (Number(user?.balance || 0) < Number(selectedPlan.price)) return alert('Saldo insuficiente!');
    setBuying(true);
    try {
      const { error } = await supabase.rpc('buy_plan', { user_id: user.id, plan_id: selectedPlan.id });
      if (error) throw error;
      await fetchUserProfile(user.id);
      setSelectedPlan(null);
      setPage('my-investments');
      alert('Compra realizada com sucesso!');
    } catch (e) { alert('Erro na compra: ' + e.message); } finally { setBuying(false); }
  };

  const handleWithdraw = async (requestedAmount) => {
    const amountToWithdraw = Number(requestedAmount || user?.balance || 0);
    if (amountToWithdraw < 20) return alert('Mínimo para saque: R$ 20,00');
    if (amountToWithdraw > Number(user?.balance || 0)) return alert('Saldo insuficiente.');

    const cleanPix = String(user?.pixKey || '').replace(/\D/g, '');
    const cleanCpf = String(user?.cpf || '').replace(/\D/g, '');

    if (!cleanPix) return alert('Configure sua chave PIX primeiro!');
    if (cleanCpf && cleanPix !== cleanCpf) {
      return alert('ERRO DE SEGURANÇA: A chave PIX deve ser o CPF cadastrado.');
    }

    const idempotencyKey = crypto.randomUUID();

    try {
      const { data, error } = await supabase.functions.invoke('withdraw-misticpay-pix', {
        headers: {
          'X-Idempotency-Key': idempotencyKey,
        },
        body: {
          userId: user.id,
          amount: amountToWithdraw,
          pixKey: cleanPix,
          pixKeyType: 'CPF',
          idempotencyKey: idempotencyKey,
        },
      });

      if (error) {
        // Tenta extrair a mensagem amigável retornada pela Edge Function (ex: erro 400)
        const errorBody = await error.context?.json?.().catch(() => null);
        throw new Error(errorBody?.error || error.message || 'Erro ao processar saque.');
      }

      if (data?.error) return alert(data.error);

      await fetchUserProfile(user.id);
      alert(`Saque de R$ ${amountToWithdraw.toFixed(2)} enviado com sucesso!`);
    } catch (err) {
      console.error('Erro ao sacar:', err);
      alert('Erro ao processar saque: ' + (err.message || 'Tente novamente.'));
    }
  };


const MyInvestments = () => {
  const [myAssets, setMyAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [assetsError, setAssetsError] = useState("");
  const [claimingId, setClaimingId] = useState(null);

  const loadAssets = async () => {
    if (!user?.id) {
      setMyAssets([]);
      setLoadingAssets(false);
      return;
    }

    setLoadingAssets(true);
    setAssetsError("");

    try {
      const { data, error } = await supabase
        .from("investments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const assets = (data || []).map((asset) => ({
        ...asset,
        plans: plans.find((p) => p.id === asset.plan_id) || {},
      }));

      setMyAssets(assets);
    } catch (error) {
      console.error("Erro ao carregar investimentos:", error);
      setAssetsError("Não foi possível carregar seus investimentos.");
    } finally {
      setLoadingAssets(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, [user?.id, plans]);

  const claimEarnings = async (assetId) => {
    if (claimingId) return;

    setClaimingId(assetId);

    try {
      const { error } = await supabase.rpc(
        "claim_asset_earnings",
        { investment_id: assetId }
      );

      if (error) throw error;

      await fetchUserProfile(user.id);
      await loadAssets();

      alert("Lucros coletados com sucesso!");
    } catch (error) {
      console.error("Erro ao coletar rendimentos:", error);
      alert("Erro ao coletar: " + error.message);
    } finally {
      setClaimingId(null);
    }
  };

  const AssetTimer = ({ asset }) => {
    const [timeLeft, setTimeLeft] = useState({
      h: 0,
      m: 0,
      s: 0,
      percent: 100,
      ready: false,
    });

    useEffect(() => {
      const updateTimer = () => {
        const lastClaim = asset.last_claim
          ? new Date(asset.last_claim).getTime()
          : asset.created_at
            ? new Date(asset.created_at).getTime()
            : Date.now();

        const nextClaim = lastClaim + 86400000;
        const diff = Math.max(0, nextClaim - Date.now());

        setTimeLeft({
          h: Math.floor(diff / 3600000),
          m: Math.floor((diff % 3600000) / 60000),
          s: Math.floor((diff % 60000) / 1000),
          percent: (diff / 86400000) * 100,
          ready: diff === 0,
        });
      };

      updateTimer();

      const interval = setInterval(updateTimer, 1000);

      return () => clearInterval(interval);
    }, [asset.last_claim, asset.created_at]);

    return (
      <div className="flex flex-col items-center gap-2">
        <div className="relative w-12 h-12">
          <svg className="w-full h-full" viewBox="0 0 36 36">
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke="#222"
              strokeWidth="3"
            />
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke="#eab308"
              strokeWidth="3"
              strokeDasharray="100"
              strokeDashoffset={100 - timeLeft.percent}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
          </svg>

          <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold">
            {timeLeft.h}h
          </div>
        </div>

        <p className="text-[10px] font-mono text-gray-400">
          {timeLeft.ready
            ? "Disponível"
            : `${timeLeft.m}m ${timeLeft.s}s`}
        </p>
      </div>
    );
  };

  if (loadingAssets) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
      </div>
    );
  }

  if (assetsError) {
    return (
      <div className="p-8 text-center text-red-400">
        <p>{assetsError}</p>
        <button
          onClick={loadAssets}
          className="mt-4 bg-yellow-500 text-black px-5 py-2 rounded-xl font-bold"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="grid gap-4">
        <h3 className="text-xl font-bold text-white">
          Meus Ativos{" "}
          <span className="text-yellow-500">Individuais</span>
        </h3>

        {myAssets.length === 0 ? (
          <div className="p-12 text-center bg-[#111] border border-dashed border-[#333] rounded-3xl text-gray-500">
            Nenhum ativo adquirido.
          </div>
        ) : (
          myAssets.map((asset) => {
            const lastClaim = asset.last_claim
              ? new Date(asset.last_claim).getTime()
              : asset.created_at
                ? new Date(asset.created_at).getTime()
                : Date.now();

            const canClaim =
              Date.now() >= lastClaim + 86400000;

            return (
              <div
                key={asset.id}
                className="bg-[#111] p-5 rounded-3xl border border-[#222] flex items-center justify-between hover:border-yellow-500/50 transition-all"
              >
                <div className="flex items-center gap-4">
                  <img
                    src={
                      asset.plans?.img ||
                      FALLBACK_PLANS_IMAGES[asset.plans?.name] ||
                      "https://via.placeholder.com/400"
                    }
                    className="w-16 h-16 rounded-2xl object-cover"
                    alt=""
                  />

                  <div>
                    <p className="text-white font-bold text-lg">
                      {asset.plans?.name || "Ativo"}
                    </p>
                    <p className="text-gray-500 text-xs">
                      Investimento: R${" "}
                      {Number(asset.amount || asset.plans?.price || 0).toFixed(2)}
                    </p>
                    <p className="text-green-400 font-bold text-sm">
                      + R${" "}
                      {Number(asset.plans?.yield || 0).toFixed(2)}
                      /dia
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <AssetTimer asset={asset} />

                  <button
                    onClick={() => claimEarnings(asset.id)}
                    disabled={!canClaim || claimingId !== null}
                    className="bg-yellow-500 text-black px-4 py-2 rounded-xl font-bold text-xs hover:bg-yellow-400 disabled:opacity-40"
                  >
                    {claimingId === asset.id
                      ? "Processando..."
                      : "Sacar Lucro"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
  const AuthScreen = () => (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white p-4">
      <div className="w-full max-w-md bg-[#111] border border-[#222] p-8 rounded-3xl shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-yellow-500/10 rounded-full mb-4"><ShieldCheck className="text-yellow-500 w-8 h-8" /></div>
          <h1 className="text-3xl font-black tracking-tighter">SKYNET <span className="text-yellow-500">ENERGY</span></h1>
          <p className="text-gray-500 mt-2">{authMode === 'login' ? 'Acesse sua conta' : 'Crie sua conta'}</p>
        </div>
        <form onSubmit={handleAuth} className="space-y-4">
          {authMode === 'register' && (
            <>
              <input name="name" placeholder="Nome Completo" required className="w-full bg-[#1a1a1a] border border-[#333] p-3 rounded-xl outline-none focus:border-yellow-500 transition-all" />
              <input name="cpf" placeholder="CPF (Somente números)" required className="w-full bg-[#1a1a1a] border border-[#333] p-3 rounded-xl outline-none focus:border-yellow-500 transition-all" />
              <input name="email" type="email" placeholder="E-mail" required className="w-full bg-[#1a1a1a] border border-[#333] p-3 rounded-xl outline-none focus:border-yellow-500 transition-all" />
              <input name="phone" placeholder="Telefone" required className="w-full bg-[#1a1a1a] border border-[#333] p-3 rounded-xl outline-none focus:border-yellow-500 transition-all" />
            </>
          )}
          {authMode === 'login' && (<input name="login" type="email" placeholder="E-mail" required className="w-full bg-[#1a1a1a] border border-[#333] p-3 rounded-xl outline-none focus:border-yellow-500 transition-all" />)}
          <input name="password" type="password" placeholder="Senha" required className="w-full bg-[#1a1a1a] border border-[#333] p-3 rounded-xl outline-none focus:border-yellow-500 transition-all" />
          <button className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold p-3 rounded-xl transition-all">{authMode === 'login' ? 'Entrar' : 'Cadastrar'}</button>
        </form>
        <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="w-full text-center mt-6 text-gray-500 text-sm hover:text-yellow-500 transition-colors">{authMode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça login'}</button>
      </div>
    </div>
  );

  const Dashboard = () => (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#111] p-6 rounded-3xl border border-[#222]"><p className="text-gray-500 text-sm">Saldo Disponível</p><h2 className="text-3xl font-bold text-white">R$ {user?.balance?.toFixed(2) || '0.00'}</h2></div>
        <div className="bg-[#111] p-6 rounded-3xl border border-[#222]"><p className="text-gray-500 text-sm">Rendimentos Pendentes</p><h2 className="text-3xl font-bold text-yellow-500">R$ {user?.pending_earnings?.toFixed(4) || '0.0000'}</h2></div>
        <div className="bg-[#111] p-6 rounded-3xl border border-[#222]"><p className="text-gray-500 text-sm">Total Sacado</p><h2 className="text-3xl font-bold text-white">R$ {user?.total_withdrawn?.toFixed(2) || '0.00'}</h2></div>
      </div>
      <div className="bg-yellow-500 p-8 rounded-3xl text-black flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-center md:text-left">
          <h3 className="text-2xl font-black uppercase italic">Olá, {user?.full_name || 'Investidor'}!</h3>
          <p className="font-medium opacity-80">Seu império energético está crescendo.</p>
        </div>
        <button onClick={() => setPage('shop')} className="bg-black text-white px-6 py-3 rounded-2xl font-bold hover:scale-105 transition-transform">Investir Agora</button>
      </div>
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Expansão <span className="text-yellow-500">Asiática</span></h2>
          <p className="text-gray-400 max-w-2xl mx-auto">Invista na maior potência energética do mundo. A China lidera a revolução verde com a tecnologia mais avançada do planeta.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { title: 'Micro Geradores', desc: 'Sistemas compactos de alta eficiência para redes urbanas densas.', icon: <Cpu />, img: 'https://images.pexels.com/photos/37226176/pexels-photo-37226176.jpeg?auto=compress&cs=tinysrgb&w=600' },
            { title: 'Painéis Solares', desc: 'Fazendas solares massivas no deserto de Gobi com rendimento recorde.', icon: <Sun />, img: 'https://images.pexels.com/photos/2569839/pexels-photo-2569839.jpeg?auto=compress&cs=tinysrgb&w=600' },
            { title: 'Subestações Locais', desc: 'Infraestrutura de distribuição inteligente para cidades inteligentes.', icon: <Zap />, img: 'https://images.pexels.com/photos/9720534/pexels-photo-9720534.jpeg?auto=compress&cs=tinysrgb&w=600' },
            { title: 'Usinas Eólicas', desc: 'Turbinas offshore de última geração capturando ventos oceânicos.', icon: <Wind />, img: 'https://images.pexels.com/photos/185039/pexels-photo-185039.jpeg?auto=compress&cs=tinysrgb&w=600' },
            { title: 'Complexos Industriais', desc: 'Centros de produção automatizados com energia autossustentável.', icon: <Factory />, img: 'https://images.pexels.com/photos/36756675/pexels-photo-36756675.jpeg?auto=compress&cs=tinysrgb&w=600' },
            { title: 'Centrais Nucleares', desc: 'Energia limpa e constante com reatores de 4ª geração.', icon: <Globe />, img: 'https://images.pexels.com/photos/18335700/pexels-photo-18335700.jpeg?auto=compress&cs=tinysrgb&w=600' },
          ].map((item, idx) => (
            <div key={idx} className="group bg-[#111] border border-[#222] rounded-3xl overflow-hidden hover:border-yellow-500 transition-all">
              <div className="relative h-40 overflow-hidden">
                <img src={item.img} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                <div className="absolute top-3 left-3 p-2 bg-black/50 backdrop-blur-md rounded-lg text-yellow-500">{item.icon}</div>
              </div>
              <div className="p-5 space-y-2">
                <h4 className="text-lg font-bold text-white">{item.title}</h4>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-gradient-to-r from-yellow-600 to-yellow-400 p-8 rounded-3xl text-black text-center space-y-4">
          <h3 className="text-2xl font-black uppercase">Por que investir na China?</h3>
          <p className="font-medium opacity-90 max-w-3xl mx-auto">A China detém 80% da cadeia de suprimentos de energia solar e eólica do mundo. Investir aqui é sobre <b className="font-black">lucratividade agressiva</b> e domínio tecnológico.</p>
          <button onClick={() => setPage('shop')} className="bg-black text-white px-8 py-4 rounded-2xl font-black hover:scale-105 transition-transform uppercase tracking-widest">Quero Lucrar Agora</button>
        </div>
      </div>
    </div>
  );

  const Shop = () => (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-white">Catálogo de <span className="text-yellow-500">Ativos</span></h2>
        <div className="bg-[#111] px-4 py-2 rounded-xl border border-[#222] text-white font-bold">Saldo: R$ {user?.balance?.toFixed(2)}</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map(plan => (
          <div key={plan.id} className="bg-[#111] rounded-3xl border border-[#222] overflow-hidden group hover:border-yellow-500 transition-all">
            <div className="relative overflow-hidden">
              <img src={plan.img} className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
              <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-yellow-500 border border-yellow-500/30">Ativo Ativo</div>
            </div>
            <div className="p-6 space-y-4">
              <h3 className="text-xl font-bold text-white">{plan.name}</h3>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Preço: <b className="text-white">R$ {plan.price}</b></span>
                <span className="text-gray-500">Rende: <b className="text-green-400">R$ {plan.yield}/dia</b></span>
              </div>
              <button onClick={() => handleBuy(plan)} className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-yellow-500 transition-colors">Comprar Ativo</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );




  const AdminScreen = () => {
    const [adminPlans, setAdminPlans] = useState([]);
    const [totalInvested, setTotalInvested] = useState(0);
    useEffect(() => {
      async function loadAdminData() {
        const { data: plansData } = await supabase.from('plans').select('*');
        setAdminPlans(plansData || []);
        const { data: invData } = await supabase.from('investments').select('plans(price)');
        setTotalInvested(invData?.reduce((acc, curr) => acc + Number(curr.plans?.price || 0), 0) || 0);
      }
      loadAdminData();
    }, []);
    const updatePlan = async (id, field, value) => {
      await supabase.from('plans').update({ [field]: value }).eq('id', id);
      await supabase.from('plans').select('*').then(res => setAdminPlans(res.data || []));
    };
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-8">
        <h2 className="text-3xl font-bold text-white">Painel <span className="text-yellow-500">Administrador</span></h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#111] p-6 rounded-3xl border border-[#222]"><p className="text-gray-500 text-sm">Total Investido</p><h3 className="text-4xl font-black text-white">R$ {totalInvested.toFixed(2)}</h3></div>
          <div className="bg-[#111] p-6 rounded-3xl border border-[#222]"><p className="text-gray-500 text-sm">Status</p><h3 className="text-4xl font-black text-green-500">Operacional</h3></div>
        </div>
        <div className="bg-[#111] rounded-3xl border border-[#222] overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#1a1a1a] text-gray-400"><tr><th className="p-4">Ativo</th><th className="p-4">Preço</th><th className="p-4">Rendimento</th></tr></thead>
            <tbody>
              {adminPlans.map(plan => (
                <tr key={plan.id} className="border-t border-[#222]">
                  <td className="p-4 text-white">{plan.name}</td>
                  <td className="p-4"><input className="bg-black border border-gray-700 p-1 rounded text-white w-20" value={plan.price} onChange={(e) => updatePlan(plan.id, 'price', Number(e.target.value))} /></td>
                  <td className="p-4"><input className="bg-black border border-gray-700 p-1 rounded text-white w-20" value={plan.yield} onChange={(e) => updatePlan(plan.id, 'yield', Number(e.target.value))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (loading) return (<div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 className="w-10 h-10 text-yellow-500 animate-spin" /></div>);
  if (page === 'auth') return <AuthScreen />;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">
      <nav className="fixed bottom-0 left-0 right-0 bg-[#111] border-t border-[#222] p-4 flex justify-around items-center z-40 md:top-0 md:left-0 md:w-64 md:h-full md:flex-col md:justify-start md:gap-8 md:pt-12">
        <div className="hidden md:block text-center mb-8"><h1 className="text-2xl font-black tracking-tighter">ENERGY <span className="text-yellow-500">SKY</span></h1></div>
        <NavItem icon={<LayoutDashboard />} label="Home" active={page === 'dashboard'} onClick={() => setPage('dashboard')} />
        <NavItem icon={<ShoppingBag />} label="Investir" active={page === 'shop'} onClick={() => setPage('shop')} />
        <NavItem icon={<TrendingUp />} label="Meus Ativos" active={page === 'my-investments'} onClick={() => setPage('my-investments')} />
        <NavItem icon={<Wallet />} label="Carteira" active={page === 'wallet'} onClick={() => setPage('wallet')} />
        <NavItem icon={<Users />} label="Meu Perfil" active={page === 'profile'} onClick={() => setPage('profile')} />
        <NavItem
         icon={<Users />}
         label="Indicações"
         active={page === 'referrals'}
         onClick={() => setPage('referrals')}
         />

        {user?.isAdmin && <NavItem icon={<Settings />} label="Admin" active={page === 'admin'} onClick={() => setPage('admin')} />}
        <button onClick={handleLogout} className="flex items-center gap-3 text-red-500 font-bold p-3 rounded-2xl hover:bg-red-500/10 transition-all">
          <LogOut className="w-6 h-6" /> <span className="hidden md:inline">Sair</span>
        </button>
      </nav>
      {selectedPlan && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#111] border border-[#333] rounded-3xl p-7 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center mx-auto mb-4"><ShoppingBag className="w-8 h-8 text-yellow-500" /></div>
              <h2 className="text-2xl font-black text-white">Confirmar <span className="text-yellow-500">Compra</span></h2>
            </div>
            <div className="bg-[#1a1a1a] rounded-2xl p-5 space-y-4 mb-6">
              <div className="flex justify-between"><span className="text-gray-500">Plano</span><strong className="text-white">{selectedPlan.name}</strong></div>
              <div className="flex justify-between"><span className="text-gray-500">Valor</span><strong className="text-yellow-500">R$ {Number(selectedPlan.price).toFixed(2)}</strong></div>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={confirmBuy} disabled={buying} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-xl transition-all">{buying ? 'Processando...' : 'CONFIRMAR COMPRA'}</button>
              <button onClick={() => setSelectedPlan(null)} className="w-full bg-[#222] text-white font-bold py-4 rounded-xl">CANCELAR</button>
            </div>
          </div>
        </div>
      )}
      <main className="pb-24 md:pb-0 md:pl-64">
        {page === 'dashboard' && <Dashboard />}
        {page === 'shop' && <Shop />}
        {page === 'my-investments' && <MyInvestments />}
        {page === 'wallet' && (
                  <WalletScreen 
                  user={user} 
                  setUser={setUser} 
                  handleWithdraw={handleWithdraw} 
                 />
                 )}

        {page === 'admin' && <AdminScreen />}
        {page === 'profile' && <ProfileScreen user={user} session={session} />}
        {page === 'referrals' && (<ReferralScreen user={user} setUser={setUser} />)}

      </main>
        {communityLink && (
         <a
          href={communityLink}
          target="_blank"
          rel="noopener noreferrer"
          title="Entre no nosso grupo"
          className="fixed bottom-24 right-3 md:bottom-8 md:right-6 z-[90] flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-bold text-sm px-3 py-2.5 rounded-full shadow-xl hover:scale-105 transition-all"
         >
          <Users className="w-5 h-5" />
          <span>GRUPO</span>
        </a>
        )}
    </div>
  );
}