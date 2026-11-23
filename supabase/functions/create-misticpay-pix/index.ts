
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido" }, 405);
  }

  try {
    const {
      amount,
      payerName,
      payerDocument,
      transactionId,
      description,
    } = await req.json();

    const clientId = Deno.env.get("MISTIC_CASHIN_CLIENT_ID")?.trim();
    const clientSecret = Deno.env.get("MISTIC_CASHIN_CLIENT_SECRET")?.trim();

    if (!clientId || !clientSecret) {
      return jsonResponse({
        success: false,
        error: "Credenciais MisticPay não configuradas no Supabase.",
      }, 500);
    }

    const numericAmount = Number(amount);
    const document = String(payerDocument || "").replace(/\D/g, "");

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      !payerName ||
      !document
    ) {
      return jsonResponse({
        success: false,
        error: "Dados da cobrança inválidos.",
      }, 400);
    }

    const authBase64 = btoa(`${clientId}:${clientSecret}`);

    const endpoint =
      "https://api.misticpay.com/api/transactions/create";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authBase64}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: numericAmount,
        payerName: String(payerName),
        payerDocument: document,
        transactionId: transactionId || crypto.randomUUID(),
        description: description || "Deposito Skynet Energy",
      }),
    });

const rawText = await response.text();

console.log("MisticPay HTTP Status:", response.status);
console.log("MisticPay Response:", rawText.slice(0, 2000));

let parsed;

try {
  parsed = JSON.parse(rawText);
} catch {
  return jsonResponse({
    success: false,
    error: "A MisticPay retornou uma resposta que não é JSON.",
    httpStatus: response.status,
    responsePreview: rawText.slice(0, 500),
  }, 502);
}

if (!response.ok) {
  return jsonResponse({
    success: false,
    error: parsed?.message || "Erro na API MisticPay.",
    code: parsed?.code || null,
    httpStatus: response.status,
  }, 502);
}

    const tx = parsed?.data || parsed?.transaction || parsed;

    const copyPaste =
      tx?.copyPaste ||
      tx?.copy_paste ||
      tx?.pixCopiaECola ||
      tx?.pix_copy_paste ||
      tx?.emv ||
      tx?.qrcode ||
      tx?.qrCode ||
      null;

    const qrCodeBase64 =
      tx?.qrCodeBase64 ||
      tx?.qr_code_base64 ||
      tx?.qrcodeBase64 ||
      tx?.base64 ||
      tx?.qrcodeUrl ||
      null;

    const txId =
      tx?.transactionId ||
      tx?.transaction_id ||
      tx?.id ||
      tx?.reference ||
      null;

    if (!copyPaste && !qrCodeBase64) {
      return jsonResponse({
        success: false,
        error: "MisticPay não retornou o QR Code.",
      }, 502);
    }

    return jsonResponse({
      success: true,
      transactionId: txId,
      copyPaste,
      qrCodeBase64,
      data: {
        ...tx,
        transactionId: txId,
        copyPaste,
        qrCodeBase64,
      },
    });

  } catch (error) {
    console.error("Erro create-misticpay-pix:", error);

    return jsonResponse({
      success: false,
      error: "Erro interno ao criar PIX.",
    }, 500);
  }
});
