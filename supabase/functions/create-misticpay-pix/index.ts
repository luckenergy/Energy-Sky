
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  try {
    // 1. Verifica autenticação
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Faça login para continuar." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "Sessão inválida." }, 401);
    }

    // 2. Lê o valor solicitado
    const body = await req.json();
    const amount = Number(body.amount);

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001
    ) {
      return jsonResponse({ error: "Valor inválido." }, 400);
    }

    // 3. Cliente administrativo: somente no servidor
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // 4. Busca nome e CPF da conta autenticada
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, full_name, cpf")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("Perfil do cliente não encontrado.");
    }

    const payerName = String(profile.full_name || "").trim();
    const payerDocument = String(profile.cpf || "").replace(/\D/g, "");

    if (!payerName || payerDocument.length !== 11) {
      throw new Error("Cadastre seu nome completo e CPF corretamente.");
    }

    // 5. Credenciais MisticPay
    const pk = Deno.env.get("MISTIC_CASHIN_CLIENT_ID");
    const sk = Deno.env.get("MISTIC_CASHIN_CLIENT_SECRET");

    if (!pk || !sk) {
      throw new Error("Credenciais MisticPay não configuradas.");
    }

    const localTransactionId = crypto.randomUUID();

    // 6. Registra o depósito antes de chamar a MisticPay
    const { error: insertError } = await admin
      .from("deposit_requests")
      .insert({
        id: localTransactionId,
        user_id: user.id,
        amount,
        provider_reference: localTransactionId,
        status: "pending",
      });

    if (insertError) {
      throw new Error("Não foi possível registrar o depósito.");
    }

    // 7. Cria a cobrança PIX
    const authBase64 = btoa(`${pk}:${sk}`);

    let response: Response;

    try {
      response = await fetch(
        "https://api.misticpay.com/api/transactions/create",
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${authBase64}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount,
            payerName,
            payerDocument,
            transactionId: localTransactionId,
            description: "Depósito Skynet Energy",
          }),
        }
      );
    } catch {
      // Não marca como falha: a API pode ter recebido a cobrança.
      throw new Error(
        "Não foi possível confirmar a resposta da MisticPay. Verifique a transação antes de tentar novamente."
      );
    }

    const gatewayData = await response.json().catch(() => null);

    if (!response.ok) {
      await admin
        .from("deposit_requests")
        .update({ status: "failed" })
        .eq("id", localTransactionId)
        .eq("user_id", user.id);

      console.error("MisticPay recusou a cobrança. HTTP:", response.status);

      return jsonResponse(
        { error: "A MisticPay não conseguiu gerar o PIX." },
        502
      );
    }

    const transaction = gatewayData?.data;
    const providerTransactionId = transaction?.transactionId;

    if (!providerTransactionId) {
      throw new Error(
        "Cobrança recebida, mas sem identificador de confirmação. Não tente gerar outra antes de verificar."
      );
    }

    // 8. Guarda o identificador da MisticPay para o webhook
    const { error: updateError } = await admin
      .from("deposit_requests")
      .update({
        provider_reference: String(providerTransactionId),
      })
      .eq("id", localTransactionId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Erro ao salvar referência da cobrança.");
      throw new Error(
        "PIX criado, mas houve erro ao registrar a referência. Procure o suporte antes de tentar novamente."
      );
    }

    // 9. Devolve somente os dados necessários para o checkout
    return jsonResponse({
      success: true,
      depositRequestId: localTransactionId,
      transactionId: providerTransactionId,
      status: transaction.transactionState,
      qrCodeBase64: transaction.qrCodeBase64,
      qrcodeUrl: transaction.qrcodeUrl,
      copyPaste: transaction.copyPaste,
      amount,
    });

  } catch (error) {
    console.error("Erro na função PIX:", error.message);

    return jsonResponse(
      { error: error.message || "Erro interno ao gerar PIX." },
      400
    );
  }
});
