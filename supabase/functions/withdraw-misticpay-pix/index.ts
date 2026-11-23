const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId, amount, pixKey, pixKeyType } = await req.json();
    const withdrawAmount = Number(amount);

    if (!userId || !withdrawAmount || withdrawAmount <= 0 || !pixKey) {
      return new Response(
        JSON.stringify({ error: "Dados de saque inválidos." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientId = Deno.env.get("MISTIC_CASHOUT_CLIENT_ID")?.trim();
    const clientSecret = Deno.env.get("MISTIC_CASHOUT_CLIENT_SECRET")?.trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const dbHeaders = {
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    };

    // 1. Verifica o saldo real do usuário no banco
    const profRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=balance`,
      { headers: dbHeaders }
    );
    const profiles = await profRes.json();
    const currentBalance = Number(profiles?.[0]?.balance || 0);

    if (currentBalance < withdrawAmount) {
      return new Response(
        JSON.stringify({ error: "Saldo insuficiente na carteira." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Desconta o saldo antes de chamar a API (evita saque duplo simultâneo)
    const newBalance = currentBalance - withdrawAmount;
    await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
      method: "PATCH",
      headers: dbHeaders,
      body: JSON.stringify({ balance: newBalance }),
    });

// 3. Dispara o saque pela Edge Function do Supabase

const idempotencyKey = crypto.randomUUID();

const { data, error } = await supabase.functions.invoke(
  "withdraw-misticpay-pix",
  {
    body: {
      amount: withdrawAmount,
      pixKey: String(pixKey).trim(),
      pixKeyType: pixKeyType || "CPF",
      idempotencyKey,
    },
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
  }
);

if (error) {
  throw new Error(error.message || "Erro ao solicitar saque.");
}

if (!data?.success) {
  throw new Error(data?.error || "Não foi possível realizar o saque.");
}

console.log("Saque solicitado:", data);
    const data = await response.json();

    // 4. Se a MisticPay recusar o saque, devolve o saldo ao usuário
    if (!response.ok) {
      await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
        method: "PATCH",
        headers: dbHeaders,
        body: JSON.stringify({ balance: currentBalance }),
      });

      return new Response(
        JSON.stringify({ error: `Erro MisticPay: ${data?.message || JSON.stringify(data)}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Registra o saque concluído na tabela withdrawal_requests
    await fetch(`${supabaseUrl}/rest/v1/withdrawal_requests`, {
      method: "POST",
      headers: dbHeaders,
      body: JSON.stringify({
        user_id: userId,
        amount: withdrawAmount,
        destination_reference: String(data?.data?.transactionId || pixKey),
        status: "completed",
      }),
    });

    return new Response(JSON.stringify({ success: true, newBalance, data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Erro interno no saque: ${err.message}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
