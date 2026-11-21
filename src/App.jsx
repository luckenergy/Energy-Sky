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
  Loader2
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

export default function EnergySkyApp() {
  const [page, setPage] = useState('auth'); 
  const [user, setUser] = useState(null); 
  const [session, setSession] = useState(null); 
  const [plans, setPlans] = useState([]);
  const [authMode, setAuthMode] = useState('login');
  const [loading, setLoading] = useState(true);
  const [gateway, setGateway] = useState('');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [buying, setBuying] = useState(false);

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

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            phone: phone
          }
        }
      });

      if (error) return alert(error.message);

      if (data.user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            full_name: name,
            phone: phone,
            email: email
          })
          .select()
          .single();

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

// Abre a confirmação antes de comprar
const handleBuy = (plan) => {
  setSelectedPlan(plan);
};

// Executa a compra somente após confirmação
const confirmBuy = async () => {
  if (!selectedPlan || buying) return;

  if (Number(user?.balance || 0) < Number(selectedPlan.price)) {
    alert('Saldo insuficiente!');
    return;
  }

  setBuying(true);

  try {
    const { error } = await supabase.rpc('buy_plan', {
      user_id: user.id,
      plan_id: selectedPlan.id
    });

    if (error) {
      alert('Erro na compra: ' + error.message);
      return;
    }

    await fetchUserProfile(user.id);

    setSelectedPlan(null);
    setPage('my-investments');

    alert('Compra realizada com sucesso! Seu ativo já está disponível.');

  } catch (error) {
    alert('Não foi possível concluir a compra.');
    console.error(error);
  } finally {
    setBuying(false);
  }
};

  const handleWithdraw = async () => {
    if (user.balance < 20) return alert('Mínimo para saque: R$ 20,00');
    if (!user.pixKey) return alert('Configure sua chave PIX primeiro!');
    const { error } = await supabase.from('transactions').insert([{ user_id: user.id, type: 'withdraw', amount: user.balance, status: 'pending', pix_key: user.pixKey }]);
    if (error) return alert('Erro ao solicitar saque');
    await supabase.rpc('request_withdraw', { user_id: user.id });
    await fetchUserProfile(user.id);
    alert('Solicitação de saque enviada!');
  };

  // --- COMPONENTE DE MEUS ATIVOS COM RELÓGIO E LISTAGEM ---
  const MyInvestments = () => {
    const [myAssets, setMyAssets] = useState([]);

    useEffect(() => {
      async function loadAssets() {
        const { data, error } = await supabase
          .from('investments')
          .select('*')
          .eq('user_id', user.id);

        if (error) console.error('Erro ao carregar ativos:', error);

        const ativosComPlanos = (data || []).map(asset => ({
          ...asset,
          plans: plans.find(p => p.id === asset.plan_id) || {}
        }));

        setMyAssets(ativosComPlanos);
      }
      if (user?.id) loadAssets();
    }, [user?.id, plans]);
    const claimEarnings = async (assetId) => {
      const { error } = await supabase.rpc('claim_asset_earnings', { investment_id: assetId });
      if (error) return alert('Erro ao coletar: ' + error.message);
      await fetchUserProfile(user.id);
      alert('Lucros deste ativo coletados!');
    };

    const AssetTimer = ({ asset }) => {
      const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0, percent: 100 });

      useEffect(() => {
        const interval = setInterval(() => {
          const lastClaim = asset.last_claim ? new Date(asset.last_claim).getTime() : Date.now();
          const nextClaim = lastClaim + 86400000;
          const diff = nextClaim - Date.now();

          if (diff <= 0) {
            setTimeLeft({ h: 0, m: 0, s: 0, percent: 0 });
          } else {
            setTimeLeft({
              h: Math.floor(diff / 3600000),
              m: Math.floor((diff % 3600000) / 60000),
              s: Math.floor((diff % 60000) / 1000),
              percent: (diff / 86400000) * 100
            });
          }
        }, 1000);
        return () => clearInterval(interval);
      }, [asset]);

      return (
        <div className="flex flex-col items-center gap-2">
          <div className="relative w-12 h-12">
            <svg className="w-full h-full" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="none" stroke="#222" strokeWidth="3" />
              <circle 
                cx="18" cy="18" r="16" fill="none" stroke="#eab308" 
                strokeWidth="3" strokeDasharray="100" 
                strokeDashoffset={100 - timeLeft.percent} 
                strokeLinecap="round" 
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold">
              {timeLeft.h}h
            </div>
          </div>
          <p className="text-[10px] font-mono text-gray-400">{timeLeft.m}m {timeLeft.s}s</p>
        </div>
      );
    };

    return (
      <div className="p-6 max-w-5xl mx-auto space-y-8">
        <div className="grid gap-4">
          <h3 className="text-xl font-bold text-white">Meus Ativos <span className="text-yellow-500">Individuais</span></h3>
          {myAssets.length === 0 ? (
            <div className="p-12 text-center bg-[#111] border border-dashed border-[#333] rounded-3xl text-gray-500">
              Nenhum ativo adquirido ainda.
            </div>
          ) : (
            myAssets.map((asset, i) => (
              <div key={i} className="bg-[#111] p-5 rounded-3xl border border-[#222] flex items-center justify-between hover:border-yellow-500/50 transition-all">
                <div className="flex items-center gap-4">
                  <img 
                    src={asset.plans?.img || FALLBACK_PLANS_IMAGES[asset.plans?.name] || 'https://via.placeholder.com/400'} 
                    className="w-16 h-16 rounded-2xl object-cover" 
                    alt={asset.plans?.name}
                  />
                  <div>
                    <p className="text-white font-bold text-lg">{asset.plans?.name}</p>
                    <p className="text-gray-500 text-xs">Investimento: R$ {asset.plans?.price}</p>
                    <p className="text-green-400 font-bold text-sm">+ R$ {asset.plans?.yield}/dia</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <AssetTimer asset={asset} />
                  <button 
                    onClick={() => claimEarnings(asset.id)}
                    disabled={asset.last_claim && (new Date(asset.last_claim).getTime() + 86400000 > Date.now())}
                    className="bg-yellow-500 text-black px-4 py-2 rounded-xl font-bold text-xs hover:bg-yellow-400 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Sacar Lucro
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const AuthScreen = () => (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white p-4">
      <div className="w-full max-w-md bg-[#111] border border-[#222] p-8 rounded-3xl shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-yellow-500/10 rounded-full mb-4">
            <ShieldCheck className="text-yellow-500 w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter">SKYNET <span className="text-yellow-500">ENERGY</span></h1>
          <p className="text-gray-500 mt-2">{authMode === 'login' ? 'Acesse sua conta' : 'Crie sua conta'}</p>
        </div>
        <form onSubmit={handleAuth} className="space-y-4">
          {authMode === 'register' && (
            <>
              <input name="name" placeholder="Nome Completo" required className="w-full bg-[#1a1a1a] border border-[#333] p-3 rounded-xl outline-none focus:border-yellow-500 transition-all" />
              <input name="email" type="email" placeholder="E-mail" required className="w-full bg-[#1a1a1a] border border-[#333] p-3 rounded-xl outline-none focus:border-yellow-500 transition-all" />
              <input name="phone" placeholder="Telefone" required className="w-full bg-[#1a1a1a] border border-[#333] p-3 rounded-xl outline-none focus:border-yellow-500 transition-all" />
            </>
          )}
          {authMode === 'login' && (
            <input name="login" type="email" placeholder="E-mail" required className="w-full bg-[#1a1a1a] border border-[#333] p-3 rounded-xl outline-none focus:border-yellow-500 transition-all" />
          )}
          <input name="password" type="password" placeholder="Senha" required className="w-full bg-[#1a1a1a] border border-[#333] p-3 rounded-xl outline-none focus:border-yellow-500 transition-all" />
          <button className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold p-3 rounded-xl transition-all active:scale-95">
            {authMode === 'login' ? 'Entrar' : 'Cadastrar'}
          </button>
        </form>
        <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="w-full text-center mt-6 text-gray-500 text-sm hover:text-yellow-500 transition-colors">
          {authMode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça login'}
        </button>
      </div>
    </div>
  );

  const Dashboard = () => (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#111] p-6 rounded-3xl border border-[#222] hover:border-yellow-500/30 transition-all">
          <p className="text-gray-500 text-sm font-medium">Saldo Disponível</p>
          <h2 className="text-3xl font-bold text-white">R$ {user?.balance?.toFixed(2) || '0.00'}</h2>
        </div>
        <div className="bg-[#111] p-6 rounded-3xl border border-[#222] hover:border-yellow-500/30 transition-all">
          <p className="text-gray-500 text-sm font-medium">Rendimentos Pendentes</p>
          <h2 className="text-3xl font-bold text-yellow-500">R$ {user?.pending_earnings?.toFixed(4) || '0.0000'}</h2>
        </div>
        <div className="bg-[#111] p-6 rounded-3xl border border-[#222] hover:border-yellow-500/30 transition-all">
          <p className="text-gray-500 text-sm font-medium">Total Sacado</p>
          <h2 className="text-3xl font-bold text-white">R$ {user?.total_withdrawn?.toFixed(2) || '0.00'}</h2>
        </div>
      </div>
      <div className="bg-yellow-500 p-8 rounded-3xl text-black flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl shadow-yellow-500/10">
        <div className="text-center md:text-left">
          <h3 className="text-2xl font-black uppercase italic">Olá, {user?.name}!</h3>
          <p className="font-medium opacity-80">Seu império energético está crescendo.</p>
        </div>
        <button onClick={() => setPage('shop')} className="bg-black text-white px-6 py-3 rounded-2xl font-bold hover:scale-105 transition-transform active:scale-95">
          Investir Agora
        </button>
      </div>
    </div>
  );

  const Shop = () => (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-white">Catálogo de <span className="text-yellow-500">Ativos</span></h2>
        <div className="bg-[#111] px-4 py-2 rounded-xl border border-[#222] text-white font-bold">
          Saldo: R$ {user?.balance?.toFixed(2)}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map(plan => (
          <div key={plan.id} className="bg-[#111] rounded-3xl border border-[#222] overflow-hidden group hover:border-yellow-500 transition-all duration-300">
            <div className="relative overflow-hidden">
              <img src={plan.img} className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500" />
              <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-yellow-500 border border-yellow-500/30">
                Ativo Ativo
              </div>
            </div>
            <div className="p-6 space-y-4">
              <h3 className="text-xl font-bold text-white">{plan.name}</h3>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Preço: <b className="text-white">R$ {plan.price}</b></span>
                <span className="text-gray-500">Rende: <b className="text-green-400">R$ {plan.yield}/dia</b></span>
              </div>
              <button onClick={() => handleBuy(plan)} className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-yellow-500 transition-colors active:scale-95">
                Comprar Ativo
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const WalletScreen = () => (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div className="bg-[#111] p-8 rounded-3xl border border-[#222] space-y-8">
        <div className="flex items-center gap-4">
          <Wallet className="text-yellow-500 w-8 h-8" />
          <h2 className="text-2xl font-bold text-white">Carteira Digital</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="text-gray-500 text-sm font-medium">Chave PIX</label>
            <div className="flex gap-2">
              <input 
                value={user?.pixKey || ''} 
                onChange={async (e) => {
                  await supabase.from('profiles').update({ pixKey: e.target.value }).eq('id', user.id);
                  fetchUserProfile(user.id);
                }}
                placeholder="CPF, E-mail ou Celular" 
                className="flex-1 bg-[#1a1a1a] border border-[#333] p-3 rounded-xl text-white outline-none focus:border-yellow-500 transition-all" 
              />
            </div>
          </div>
          <div className="space-y-4">
            <label className="text-gray-500 text-sm font-medium">Depositar Valor</label>
            <div className="flex gap-2">
              <input id="dep-val" type="number" placeholder="R$ 0,00" className="flex-1 bg-[#1a1a1a] border border-[#333] p-3 rounded-xl text-white outline-none focus:border-yellow-500 transition-all" />
              <button onClick={() => handleDeposit(Number(document.getElementById('dep-val').value))} className="bg-white text-black px-4 rounded-xl font-bold hover:bg-yellow-500 transition-colors">OK</button>
            </div>
          </div>
        </div>
        <div className="pt-8 border-t border-[#222] text-center space-y-4">
          <p className="text-gray-500">Saldo para Saque</p>
          <h3 className="text-5xl font-black text-white">R$ {user?.balance?.toFixed(2)}</h3>
          <button onClick={handleWithdraw} className="w-full max-w-xs bg-yellow-500 text-black font-black py-4 rounded-2xl hover:bg-yellow-600 transition-all uppercase tracking-widest active:scale-95">
            Solicitar Saque PIX
          </button>
        </div>
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
        const total = invData?.reduce((acc, curr) => acc + Number(curr.plans?.price || 0), 0) || 0;
        setTotalInvested(total);
      }
      loadAdminData();
    }, []);

    const updatePlan = async (id, field, value) => {
      const { error } = await supabase.from('plans').update({ [field]: value }).eq('id', id);
      if (error) return alert('Erro ao atualizar');
      await loadAdminData();
    };

    return (
      <div className="p-6 max-w-6xl mx-auto space-y-8">
        <h2 className="text-3xl font-bold text-white">Painel <span className="text-yellow-500">Administrador</span></h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#111] p-6 rounded-3xl border border-[#222]">
            <p className="text-gray-500 text-sm">Total Investido por Usuários</p>
            <h3 className="text-4xl font-black text-white">R$ {totalInvested.toFixed(2)}</h3>
          </div>
          <div className="bg-[#111] p-6 rounded-3xl border border-[#222]">
            <p className="text-gray-500 text-sm">Status do Sistema</p>
            <h3 className="text-4xl font-black text-green-500">Operacional</h3>
          </div>
        </div>

        <div className="bg-[#111] rounded-3xl border border-[#222] overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#1a1a1a] text-gray-400">
              <tr>
                <th className="p-4">Ativo</th>
                <th className="p-4">Preço (R$)</th>
                <th className="p-4">Rendimento/Dia (R$)</th>
              </tr>
            </thead>
            <tbody>
              {adminPlans.map(plan => (
                <tr key={plan.id} className="border-t border-[#222]">
                  <td className="p-4 text-white font-medium">{plan.name}</td>
                  <td className="p-4">
                    <input 
                      className="bg-[#0a0a0a] border border-[#333] p-1 rounded text-white w-24"
                      value={plan.price}
                      onChange={(e) => updatePlan(plan.id, 'price', Number(e.target.value))}
                    />
                  </td>
                  <td className="p-4">
                    <input 
                      className="bg-[#0a0a0a] border border-[#333] p-1 rounded text-white w-24"
                      value={plan.yield}
                      onChange={(e) => updatePlan(plan.id, 'yield', Number(e.target.value))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
    </div>
  );

  if (page === 'auth') return <AuthScreen />;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">
      <nav className="fixed bottom-0 left-0 right-0 bg-[#111] border-t border-[#222] p-4 flex justify-around items-center z-40 md:top-0 md:left-0 md:w-64 md:h-full md:flex-col md:justify-start md:gap-8 md:pt-12">
        <div className="hidden md:block text-center mb-8">
          <h1 className="text-2xl font-black tracking-tighter">ENERGY <span className="text-yellow-500">SKY</span></h1>
        </div>
        <NavItem icon={<LayoutDashboard />} label="Home" active={page === 'dashboard'} onClick={() => setPage('dashboard')} />
        <NavItem icon={<ShoppingBag />} label="Investir" active={page === 'shop'} onClick={() => setPage('shop')} />
        <NavItem icon={<TrendingUp />} label="Meus Ativos" active={page === 'my-investments'} onClick={() => setPage('my-investments')} />
        <NavItem icon={<Wallet />} label="Carteira" active={page === 'wallet'} onClick={() => setPage('wallet')} />
        <NavItem
  icon={<Users />}
  label="Meu Perfil"
  active={page === 'profile'}
  onClick={() => setPage('profile')}
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
        <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
          <ShoppingBag className="w-8 h-8 text-yellow-500" />
        </div>

        <h2 className="text-2xl font-black text-white">
          Confirmar <span className="text-yellow-500">Compra</span>
        </h2>

        <p className="text-gray-500 text-sm mt-2">
          Você deseja realmente adquirir este ativo?
        </p>
      </div>

      <div className="bg-[#1a1a1a] rounded-2xl p-5 space-y-4 mb-6">

        <div className="flex justify-between gap-3">
          <span className="text-gray-500">Plano selecionado</span>
          <strong className="text-white text-right">
            {selectedPlan.name}
          </strong>
        </div>

        <div className="flex justify-between gap-3">
          <span className="text-gray-500">Valor da compra</span>
          <strong className="text-yellow-500">
            R$ {Number(selectedPlan.price).toFixed(2)}
          </strong>
        </div>

        <div className="flex justify-between gap-3">
          <span className="text-gray-500">Saldo disponível</span>
          <strong className="text-white">
            R$ {Number(user?.balance || 0).toFixed(2)}
          </strong>
        </div>

        <div className="border-t border-[#333] pt-4">
          <p className="text-gray-400 text-xs leading-relaxed">
            Ao confirmar, você autoriza a compra deste ativo
            utilizando o saldo disponível na sua conta.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">

        <button
          onClick={confirmBuy}
          disabled={buying}
          className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-black py-4 rounded-xl transition-all"
        >
          {buying ? 'Processando compra...' : 'CONFIRMAR COMPRA'}
        </button>

        <button
          onClick={() => setSelectedPlan(null)}
          disabled={buying}
          className="w-full bg-[#222] hover:bg-[#333] text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50"
        >
          CANCELAR
        </button>

      </div>
    </div>
  </div>
)}<main className="pb-24 md:pb-0 md:pl-72">
        {page === 'dashboard' && <Dashboard />}
        {page === 'shop' && <Shop />}
        {page === 'my-investments' && <MyInvestments />}
        {page === 'wallet' && <WalletScreen />}
        {page === 'admin' && <AdminScreen />}
        {page === 'profile' && (
  <ProfileScreen user={user} session={session} />
)}
      </main>
    </div>
  );
}

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

  const completedStatuses = [
    'completed',
    'paid',
    'success',
    'processed'
  ];

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

      const [
        investmentsResult,
        transactionsResult,
        withdrawalsResult,
        depositsResult
      ] = await Promise.all([
        supabase
          .from('investments')
          .select('id, amount, status, created_at')
          .eq('user_id', userId),

        supabase
          .from('transactions')
          .select('id, type, amount, status, description, reference, created_at')
          .eq('user_id', userId),

        supabase
          .from('withdrawal_requests')
          .select('id, amount, status, created_at')
          .eq('user_id', userId),

        supabase
          .from('deposit_requests')
          .select('id, amount, status, created_at')
          .eq('user_id', userId)
      ]);

      if (cancelled) return;

      if (investmentsResult.error || transactionsResult.error) {
        console.error(
          'Erro ao carregar histórico:',
          investmentsResult.error || transactionsResult.error
        );
        setErrorMessage(
          'Não foi possível carregar todos os dados financeiros. Verifique as permissões do Supabase.'
        );
      }

      setInvestments(investmentsResult.data || []);
      setTransactions(transactionsResult.data || []);
      setWithdrawals(withdrawalsResult.data || []);
      setDeposits(depositsResult.data || []);

      setLoadingProfile(false);
    }

    loadProfileData();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Soma somente investimentos ativos.
  const totalInvested = investments
    .filter(item => item.status === 'active')
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  // Considera somente saques com status reconhecido como concluído.
  const completedWithdrawals = withdrawals.filter(item =>
    completedStatuses.includes(
      String(item.status || '').toLowerCase()
    )
  );

  const totalWithdrawn = completedWithdrawals.reduce(
    (total, item) => total + Number(item.amount || 0),
    0
  );

  // O histórico utiliza as solicitações e transações existentes.
  // Não adicionamos investments aqui para evitar duplicar compras
  // que já aparecem na tabela transactions.
  const history = [
    ...transactions.map(item => ({
      ...item,
      category: 'transaction',
      title: item.description || (
        item.type === 'purchase'
          ? 'Compra de investimento'
          : item.type === 'withdraw'
            ? 'Saque'
            : item.type === 'deposit'
              ? 'Depósito'
              : item.type
      )
    })),

    ...withdrawals.map(item => ({
      ...item,
      type: 'withdraw',
      category: 'withdrawal',
      title: 'Solicitação de saque'
    })),

    ...deposits.map(item => ({
      ...item,
      type: 'deposit',
      category: 'deposit',
      title: 'Solicitação de depósito'
    }))
  ].sort(
    (a, b) =>
      new Date(b.created_at).getTime() -
      new Date(a.created_at).getTime()
  );

  const filteredHistory = history.filter(item => {
    if (filter === 'all') return true;
    return item.type === filter;
  });

  const profileName =
    user?.full_name ||
    session?.user?.user_metadata?.full_name ||
    'Cliente';

  const profileEmail = session?.user?.email || user?.email || 'Não informado';

  const profilePhone =
    user?.phone ||
    session?.user?.user_metadata?.phone ||
    'Não informado';

  return (
    <div className="p-5 md:p-8 max-w-6xl mx-auto space-y-8 pb-32">

      <div>
        <h2 className="text-3xl font-black text-white">
          Meu <span className="text-yellow-500">Perfil</span>
        </h2>
        <p className="text-gray-500 mt-2">
          Consulte seus dados e seu histórico financeiro.
        </p>
      </div>

      {/* DADOS PESSOAIS */}
      <div className="bg-[#111] border border-[#222] rounded-3xl p-6 space-y-5">

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center">
            <Users className="w-8 h-8 text-yellow-500" />
          </div>

          <div>
            <h3 className="text-xl font-bold text-white">
              {profileName}
            </h3>
            <p className="text-gray-500 text-sm">
              Dados da sua conta
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          <div className="bg-[#1a1a1a] rounded-2xl p-4">
            <p className="text-gray-500 text-xs mb-2">NOME COMPLETO</p>
            <p className="text-white font-semibold break-words">
              {profileName}
            </p>
          </div>

          <div className="bg-[#1a1a1a] rounded-2xl p-4">
            <p className="text-gray-500 text-xs mb-2">E-MAIL</p>
            <p className="text-white font-semibold break-all">
              {profileEmail}
            </p>
          </div>

          <div className="bg-[#1a1a1a] rounded-2xl p-4">
            <p className="text-gray-500 text-xs mb-2">TELEFONE</p>
            <p className="text-white font-semibold">
              {profilePhone}
            </p>
          </div>

        </div>

        <div className="flex items-center gap-2 text-green-400 text-xs">
          <ShieldCheck className="w-4 h-4" />
          Informações somente para visualização
        </div>
      </div>

      {/* RESUMO FINANCEIRO */}
      <div>
        <h3 className="text-xl font-bold text-white mb-4">
          Resumo financeiro
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div className="bg-[#111] border border-[#222] rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <p className="text-gray-500 text-sm">Total investido ativo</p>
              <TrendingUp className="text-green-400" />
            </div>

            <h3 className="text-3xl font-black text-green-400 mt-3">
              {money(totalInvested)}
            </h3>

            <p className="text-gray-600 text-xs mt-2">
              Soma dos investimentos com status ativo.
            </p>
          </div>

          <div className="bg-[#111] border border-[#222] rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <p className="text-gray-500 text-sm">Total sacado concluído</p>
              <Wallet className="text-yellow-500" />
            </div>

            <h3 className="text-3xl font-black text-white mt-3">
              {money(totalWithdrawn)}
            </h3>

            <p className="text-gray-600 text-xs mt-2">
              Somente solicitações com status reconhecido como concluído.
            </p>
          </div>

        </div>
      </div>

      {/* HISTÓRICO */}
      <div className="bg-[#111] border border-[#222] rounded-3xl overflow-hidden">

        <div className="p-6 border-b border-[#222]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

            <div>
              <h3 className="text-xl font-bold text-white">
                Histórico financeiro
              </h3>
              <p className="text-gray-500 text-sm mt-1">
                Suas movimentações registradas no sistema.
              </p>
            </div>

            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="bg-[#1a1a1a] border border-[#333] text-white rounded-xl p-3 outline-none"
            >
              <option value="all">Todas as movimentações</option>
              <option value="purchase">Investimentos</option>
              <option value="deposit">Depósitos</option>
              <option value="withdraw">Saques</option>
            </select>

          </div>
        </div>

        {loadingProfile ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
          </div>
        ) : errorMessage ? (
          <div className="p-6 text-center text-yellow-500">
            {errorMessage}
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            Nenhuma movimentação encontrada.
          </div>
        ) : (

          <div className="divide-y divide-[#222]">

            {filteredHistory.map((item, index) => {
              const isWithdraw = item.type === 'withdraw';
              const isDeposit = item.type === 'deposit';
              const amount = Number(item.amount || 0);

              return (
                <div
                  key={`${item.category}-${item.id}`}
                  className="p-5 flex items-center justify-between gap-3 hover:bg-[#1a1a1a] transition-colors"
                >

                  <div className="flex items-center gap-3 min-w-0">

                    <div className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${
                      isWithdraw
                        ? 'bg-red-500/10 text-red-400'
                        : isDeposit
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-yellow-500/10 text-yellow-500'
                    }`}>
                      {isWithdraw ? (
                        <Wallet className="w-5 h-5" />
                      ) : isDeposit ? (
                        <PlusCircle className="w-5 h-5" />
                      ) : (
                        <TrendingUp className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-white font-bold truncate">
                        {item.title}
                      </p>
                      <p className="text-gray-500 text-xs mt-1">
                        {dateFormat(item.created_at)}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {statusLabel(item.status)}
                      </p>
                    </div>

                  </div>

                  <div className="text-right shrink-0">
                    <p className={`font-bold ${
                      isWithdraw
                        ? 'text-red-400'
                        : isDeposit
                          ? 'text-green-400'
                          : 'text-white'
                    }`}>
                      {isWithdraw ? '-' : isDeposit ? '+' : ''}
                      {money(amount)}
                    </p>
                  </div>

                </div>
              );
            })}

          </div>
        )}

      </div>

      <p className="text-gray-600 text-xs text-center">
        Os dados são carregados diretamente do seu cadastro no Skynet Energy.
      </p>

    </div>
  );
}