
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, idempotency-key, x-idempotency-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const API_URL = "https://api.misticpay.com/api";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Método não permitido." }, 405);
  }

  let withdrawalId: string | null = null;

  try {
    // 1. Configurações
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const clientId = Deno.env.get("MISTIC_CASHOUT_CLIENT_ID")?.trim();
    const clientSecret = Deno.env.get("MISTIC_CASHOUT_CLIENT_SECRET")?.trim();

    if (!supabaseUrl || !serviceKey || !clientId || !clientSecret) {
      return jsonResponse({
        success: false,
        error: "Configurações do Supabase ou MisticPay incompletas.",
      }, 500);
    }

    // 2. Autenticação do usuário pelo JWT
    const authorization = req.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse({ success: false, error: "Autenticação obrigatória." }, 401);
    }

    const token = authorization.slice(7);

    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!authResponse.ok) {
      return jsonResponse({ success: false, error: "Sessão inválida." }, 401);
    }

    const authenticatedUser = await authResponse.json();
    const userId = authenticatedUser.id;

    // 3. Receber dados
    const body = await req.json();

    const amount = Number(body.amount);
    const pixKey = String(body.pixKey ?? "").trim();
    const pixKeyType = String(body.pixKeyType || "CPF").toUpperCase();

    const allowedTypes = [
      "CPF", "CNPJ", "EMAIL", "TELEFONE", "CHAVE_ALEATORIA",
    ];

    if (
      !Number.isFinite(amount) ||
      amount < 1 ||
      Math.round(amount * 100) !== amount * 100 ||
      !pixKey ||
      !allowedTypes.includes(pixKeyType)
    ) {
      return jsonResponse({ success: false, error: "Dados de saque inválidos." }, 400);
    }

    // 4. Idempotência: mesma chave para a mesma solicitação
const idempotencyKey = String(
  body?.idempotencyKey || ""
).trim();

console.log("IDEMPOTENCY RECEBIDA:", idempotencyKey);

if (!idempotencyKey || idempotencyKey.length > 255) {
  return jsonResponse({
    success: false,
    error: "Chave de idempotência ausente ou inválida.",
    debug: {
      bodyRecebido: body,
      idempotencyKey: body?.idempotencyKey,
    },
  }, 400);
}

    const dbHeaders = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    };

    // 5. Reserva atômica do saldo no banco
    // Requer a função SQL reserve_pix_withdrawal já criada.
    const reserveResponse = await fetch(
      `${supabaseUrl}/rest/v1/rpc/reserve_pix_withdrawal`,
      {
        method: "POST",
        headers: dbHeaders,
        body: JSON.stringify({
          p_user_id: userId,
          p_amount: amount,
          p_idempotency_key: idempotencyKey,
          p_pix_key_type: pixKeyType,
        }),
      },
    );

    const reservation = await reserveResponse.json();

    if (!reserveResponse.ok) {
      console.error("Erro ao reservar saque:", reservation);

      return jsonResponse({
        success: false,
        error: reservation.message || "Não foi possível reservar o saldo.",
      }, 400);
    }

    withdrawalId = reservation.withdrawal_id;

    if (!withdrawalId) {
      return jsonResponse({
        success: false,
        error: "Reserva de saque não retornou identificador.",
      }, 500);
    }

    if (
      reservation.status === "completed" ||
      reservation.status === "failed"
    ) {
      return jsonResponse({
        success: false,
        error: "Esta solicitação já foi finalizada.",
        status: reservation.status,
      }, 409);
    }

    // 6. Enviar para MisticPay
    const authBase64 = btoa(`${clientId}:${clientSecret}`);

    const response = await fetch(
      `${API_URL}/transactions/withdraw`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authBase64}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          amount,
          pixKey,
          pixKeyType,
          description: "Saque Skynet Energy",
        }),
        signal: AbortSignal.timeout(20000),
      },
    );

    const rawText = await response.text();

    let result;

    try {
      result = JSON.parse(rawText);
    } catch {
      return jsonResponse({
        success: false,
        error: "Resposta inválida da MisticPay. Verifique o status antes de repetir.",
        status: "processing",
        withdrawalId,
      }, 502);
    }

    // 7. Tratar erros do provedor
    if (!response.ok) {
      console.error("MisticPay:", {
        status: response.status,
        code: result.code,
        requestId: result.requestId,
      });

      // Somente recusas definitivas permitem estorno automático.
      // 429 e 5xx precisam preservar a reserva.
      if (response.status !== 429 && response.status < 500) {
        const refundResponse = await fetch(
          `${supabaseUrl}/rest/v1/rpc/refund_pix_withdrawal`,
          {
            method: "POST",
            headers: dbHeaders,
            body: JSON.stringify({
              p_withdrawal_id: withdrawalId,
              p_reason: result.code || "MisticPay recusou o saque",
            }),
          },
        );

        if (!refundResponse.ok) {
          return jsonResponse({
            success: false,
            error: "Saque recusado. O estorno precisa ser verificado.",
            withdrawalId,
          }, 500);
        }
      }

      return jsonResponse({
        success: false,
        error: result.message || "Erro ao processar saque.",
        code: result.code || null,
        requestId: result.requestId || null,
        withdrawalId,
      }, response.status === 429 ? 429 :
        response.status < 500 ? 400 : 502);
    }

    // 8. Saque aceito
    const providerTransactionId = result?.data?.transactionId;

    if (providerTransactionId == null) {
      return jsonResponse({
        success: false,
        error: "Saque recebido sem identificador. Consulte o provedor.",
        status: "processing",
        withdrawalId,
      }, 502);
    }

    // 9. Atualizar registro como pendente
    const updateResponse = await fetch(
      `${supabaseUrl}/rest/v1/withdrawal_requests?id=eq.${encodeURIComponent(withdrawalId)}`,
      {
        method: "PATCH",
        headers: {
          ...dbHeaders,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          provider_transaction_id: String(providerTransactionId),
          status: "pending",
          updated_at: new Date().toISOString(),
        }),
      },
    );

    if (!updateResponse.ok) {
      console.error("Falha ao atualizar registro:", await updateResponse.text());

      return jsonResponse({
        success: true,
        status: "processing",
        withdrawalId,
        transactionId: providerTransactionId,
        message: "Saque enviado. Atualização do registro pendente de verificação.",
      }, 200);
    }

    return jsonResponse({
      success: true,
      status: "pending",
      message: "Saque enviado para processamento.",
      withdrawalId,
      transactionId: providerTransactionId,
      data: result,
    });

  } catch (error) {
    console.error("Erro no saque:", error);

    return jsonResponse({
      success: false,
      error: "Erro ao processar saque. Consulte o status antes de repetir.",
      withdrawalId,
    }, 500);
  }
});
