export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { amount, payerName, payerDocument, transactionId, description } = req.body;

    const clientId = process.env.MISTIC_CASHIN_CLIENT_ID?.trim();
    const clientSecret = process.env.MISTIC_CASHIN_CLIENT_SECRET?.trim();

    if (!clientId || !clientSecret) {
      return res.status(200).json({
        error: 'Chaves MISTIC_CASHIN_CLIENT_ID ou MISTIC_CASHIN_CLIENT_SECRET não configuradas na Vercel.',
      });
    }

    const authBase64 = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

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

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      return res.status(200).json({
        error: `MisticPay Status ${response.status}: ${rawText.slice(0, 150)}`,
      });
    }

    if (!response.ok) {
      return res.status(200).json({
        error: `MisticPay (${data.code || response.status}): ${data.message || JSON.stringify(data)}`,
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(200).json({ error: `Erro interno: ${err.message}` });
  }
}
