Deno.serve(async (req) => {
  
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const payload = await req.json();
    console.log("Webhook MisticPay recebido:", JSON.stringify(payload));

    const tx = payload?.data || payload;
    const status = String(tx?.transactionState || tx?.status || "").toUpperCase();
    const transactionId = String(tx?.transactionId || tx?.id || "");
    const amountPaid = Number(tx?.transactionAmount ? tx.transactionAmount / 100 : tx?.amount || 0);

    const isPaid = ["COMPLETO", "CONCLUIDO", "CONCLUÍDO", "PAID", "APPROVED", "PAGO"].includes(status);

    if (!isPaid || !transactionId) {
      return new Response(JSON.stringify({ received: true, ignored: true, status }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const dbHeaders = {
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    };

    // 1. Busca o depósito pendente pela coluna provider_reference
    const depRes = await fetch(
      `${supabaseUrl}/rest/v1/deposit_requests?provider_reference=eq.${encodeURIComponent(transactionId)}&select=*`,
      { headers: dbHeaders }
    );
    const deposits = await depRes.json();
    const deposit = deposits?.[0];

    if (!deposit) {
      console.error("Depósito não encontrado para provider_reference:", transactionId);
      return new Response(JSON.stringify({ error: "Depósito não encontrado" }), { status: 200 });
    }

    // 2. Evita creditar duas vezes
    if (deposit.status === "paid" || deposit.status === "approved") {
      return new Response(JSON.stringify({ received: true, alreadyProcessed: true }), { status: 200 });
    }

    const creditAmount = Number(deposit.amount || amountPaid);

    // 3. Marca o depósito como pago e grava paid_at
    await fetch(`${supabaseUrl}/rest/v1/deposit_requests?id=eq.${deposit.id}`, {
      method: "PATCH",
      headers: dbHeaders,
      body: JSON.stringify({
        status: "paid",
        paid_at: new Date().toISOString(),
      }),
    });

    // 4. Busca o saldo atual do usuário em profiles
    const profRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${deposit.user_id}&select=balance`,
      { headers: dbHeaders }
    );
    const profiles = await profRes.json();
    const currentBalance = Number(profiles?.[0]?.balance || 0);
    const newBalance = currentBalance + creditAmount;

    // 5. Atualiza o saldo (balance) em profiles
    await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${deposit.user_id}`, {
      method: "PATCH",
      headers: dbHeaders,
      body: JSON.stringify({ balance: newBalance }),
    });

    return new Response(JSON.stringify({ success: true, newBalance }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Erro no webhook:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 200 });
  }
});
