const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { amount, payerName, payerDocument, transactionId, description } = body;

    const clientId = Deno.env.get("MISTIC_CASHIN_CLIENT_ID")?.trim();
    const clientSecret = Deno.env.get("MISTIC_CASHIN_CLIENT_SECRET")?.trim();

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({
          error: "Chaves MISTIC_CASHIN_CLIENT_ID ou MISTIC_CASHIN_CLIENT_SECRET ausentes nos Secrets.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authBase64 = btoa(`${clientId}:${clientSecret}`);

    const response = await fetch("https://api.misticpay.com/api/transactions/create", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authBase64}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Number(amount),
        payerName: String(payerName),
        payerDocument: String(payerDocument).replace(/\D/g, ""),
        transactionId: transactionId || crypto.randomUUID(),
        description: description || "Deposito Skynet Energy",
      }),
    });

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      return new Response(
        JSON.stringify({
          error: `MisticPay Status ${response.status}: ${rawText.slice(0, 150)}`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: `MisticPay (${data.code || response.status}): ${data.message || JSON.stringify(data)}`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: `Erro interno: ${error.message}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
