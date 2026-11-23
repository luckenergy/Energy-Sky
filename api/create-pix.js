export default async function handler(req, res) {
  // Libera CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { amount, payerName, payerDocument, transactionId, description } = req.body;

    const clientId = process.env.MISTIC_CASHIN_CLIENT_ID?.trim();
    const clientSecret = process.env.MISTIC_CASHIN_CLIENT_SECRET?.trim();

    if (!clientId || !clientSecret) {
      return res.status(200).json({
        error: "Chaves MISTIC_CASHIN_CLIENT_ID ou MISTIC_CASHIN_CLIENT_SECRET não configuradas na Vercel.",
      });
    }

    const authBase64 = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const sub = "api";
    const dominio = "misticpay.com";
    const caminho = "/api/transactions/create";
    const endpoint = "https://" + sub + "." + dominio + caminho;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authBase64}`,
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
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return res.status(200).json({
        error: `MisticPay Status ${response.status}: ${rawText.slice(0, 150)}`,
      });
    }

    if (!response.ok) {
      return res.status(200).json({
        error: `MisticPay (${parsed.code || response.status}): ${parsed.message || JSON.stringify(parsed)}`,
      });
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
      return res.status(200).json({
        error: `Chaves recebidas sem QR Code: ${JSON.stringify(Object.keys(tx || {}))}`,
      });
    }

    return res.status(200).json({
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
    return res.status(200).json({ error: `Erro interno na Vercel: ${error.message}` });
  }
}
