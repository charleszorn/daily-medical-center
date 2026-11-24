// Vercel serverless function: ping Supabase to keep the free-tier project awake.
// Called daily by the cron in vercel.json, and can be triggered manually via GET /api/keepalive.
export default async function handler(req, res) {
  const url = (process.env.SUPABASE_URL || 'https://uhvomwfpzdejnukadhnr.supabase.co').replace(/\/$/, '');
  const key = process.env.SUPABASE_ANON_KEY || 'sb_publishable_23Sevy_7uPjmq85TxaeWPw_wBZQDCX0';
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const endpoints = [
    `${url}/auth/v1/health`,
    `${url}/rest/v1/`,
    `${url}/`
  ];
  const results = [];
  for (const ep of endpoints) {
    try {
      const r = await fetch(ep, { method: 'GET', headers });
      results.push({ endpoint: ep, status: r.status, ok: r.ok || r.status < 500 });
    } catch (e) {
      results.push({ endpoint: ep, ok: false, error: String(e) });
    }
  }
  const allOk = results.every(r => r.ok);
  res.status(allOk ? 200 : 207).json({ ok: allOk, timestamp: new Date().toISOString(), results });
}