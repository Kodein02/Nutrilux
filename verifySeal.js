import crypto from 'crypto';

export function verifySealSignature(req) {
  const signature = req.headers['x-seal-signature']; // ha küldi
  if (!signature) return true; // ha nincs, engedd át
  const payload = JSON.stringify(req.body);
  const hmac = crypto.createHmac('sha256', process.env.SEAL_API_SECRET)
                     .update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
}
