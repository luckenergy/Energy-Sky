export const config = {
  runtime: 'edge',
  regions: ['gru1'], // Roda direto em São Paulo (Brasil)
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
  }

  try {
    const { amount, payerName, payerDocument, transactionId, description } = await req.json();

    const clientId = process.env.MISTIC_CASHIN_CLIENT_ID;
    const clientSecret = process.env.MISTIC_CASHIN_CLIENT_SECRET;

    const authBase64 = btoa(`${clientId}:${clientSecret}`);
    const response = await fetch('https://misticpay.com', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authBase64}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Number(amount),
        payerName: String(payerName),
        payerDocument: String(payerDocument).replace(/\D/g, ''),
        transactionId: transactionId || crypto.randomUUID(),
        description: description || 'Deposito Skynet Energy',
      }),
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 200 });
  }
}
