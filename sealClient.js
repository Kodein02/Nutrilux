import axios from 'axios';

const api = axios.create({
  baseURL: 'https://www.sealsubscriptions.com/api/v1',
  headers: { Authorization: `Bearer ${process.env.SEAL_API_TOKEN}` }
});

export async function getActiveSubsByEmail(email) {
  const res = await api.get('/subscriptions', {
    params: { customer_email: email, status: 'active' }
  });
  // normalize → tömbben add vissza a variant_id-kat
  const subs = res.data?.subscriptions || [];
  const variants = Array.isArray(subs) ? subs.flatMap(s => (s.variant_id ? [String(s.variant_id)] : [])) 
                                       : (subs.variant_id ? [String(subs.variant_id)] : []);
  return [...new Set(variants)];
}