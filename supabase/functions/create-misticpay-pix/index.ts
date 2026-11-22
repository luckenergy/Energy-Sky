
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  try {
    const body = await req.json();

    const {
      amount,
      payerName,
      payerDocument,
      transactionId,
      description,
    } = body;

    const numericAmount = Number(amount);
    const cleanDocument = String(payerDocument || "").replace(/\D/g, "");

    if (!Number.isFinite(numericAmount) || numericAmount < 1) {
      return jsonResponse({ error: "Valor de depósito inválido." }, 400);
    }

    if (!payerName || !String(payerName).trim()) {
      return jsonResponse({ error: "Nome do pagador obrigatório." }, 400);
    }

    if (cleanDocument.length !== 11) {
      return jsonResponse({ error: "CPF inválido." }, 400);
    }

    const clientId = Deno.env
      .get("MISTIC_CASHIN_CLIENT_ID")?.trim();

    const clientSecret = Deno.env
      .get("MISTIC_CASHIN_CLIENT_SECRET")?.trim();

    if (!clientId || !clientSecret) {
      return jsonResponse({
        error: "Credenciais MisticPay não configuradas.",
      }, 500);
    }

    const authBase64 = btoa(`${clientId}:${clientSecret}`);

    const response = await fetch(
      "https://api.misticpay.com/api/transactions/create",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authBase64}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: numericAmount,
          payerName: String(payerName).trim(),
          payerDocument: cleanDocument,
          transactionId: transactionId || crypto.randomUUID(),
          description: description || "Deposito Skynet Energy",
        }),
      }
    );

    const rawText = await response.text();

    let data;

    try {
      data = JSON.parse(rawText);
    } catch {
      console.error("Resposta inválida da MisticPay:", response.status);

      return jsonResponse({
        error: "A MisticPay retornou uma resposta inválida.",
      }, 502);
    }

    if (!response.ok) {
      console.error("Erro MisticPay:", response.status, data);

      return jsonResponse({
        error: data.message || "Não foi possível gerar o PIX.",
      }, 502);
    }

    return jsonResponse(data, 200);

  } catch (error) {
    console.error("Erro interno:", error);

    return jsonResponse({
      error: "Erro interno ao processar depósito.",
    }, 500);
  }
});
