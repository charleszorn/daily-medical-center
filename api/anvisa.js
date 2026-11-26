// Vercel Serverless Function: Integração Oficial com o Gov.br / ANVISA API
// Permite buscar medicamentos e bulas oficiais da base da Anvisa.

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAnvisaToken() {
  const now = Date.now();
  if (cachedToken && tokenExpiresAt > now + 60000) {
    return cachedToken;
  }

  const clientId = process.env.ANVISA_CLIENT_ID || '12218158655';
  const clientSecret = process.env.ANVISA_CLIENT_SECRET || 'tiagJyFvimaq9TZHuW40ijxp9lKHZRG0';

  const tokenUrl = 'https://acesso.prd.apps.anvisa.gov.br/auth/realms/externo/protocol/openid-connect/token';
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'openid'
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: params.toString()
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Falha ao autenticar na Anvisa (${response.status}): ${errText}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  // expira em segundos (geralmente 1800s / 30min)
  tokenExpiresAt = now + (data.expires_in || 1800) * 1000;
  return cachedToken;
}

// Formata número de registro Anvisa (geralmente 9 dígitos: 1.XXXX.XXXX ou 13 dígitos)
function formatAnvisaRegister(reg) {
  if (!reg) return '';
  const clean = String(reg).replace(/\D/g, '');
  if (clean.length === 9) {
    return `${clean.slice(0, 1)}.${clean.slice(1, 5)}.${clean.slice(5)}`;
  }
  if (clean.length === 13) {
    return `${clean.slice(0, 1)}.${clean.slice(1, 5)}.${clean.slice(5, 9)}.${clean.slice(9)}`;
  }
  return clean;
}

export default async function handler(req, res) {
  // Configura cabeçalhos CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { q, id, page = 1, count = 10 } = req.query || {};

    const token = await getAnvisaToken();
    const gatewayBase = 'https://api-gateway.prd.apps.anvisa.gov.br/consultas-externas-api';

    // 1. Consulta por ID específico do produto (detalhes da bula)
    if (id) {
      const cleanId = String(id).replace(/\D/g, '');
      const detailUrl = `${gatewayBase}/api/v1/consulta/bulario/${cleanId}`;
      const detailRes = await fetch(detailUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!detailRes.ok) {
        return res.status(detailRes.status).json({
          ok: false,
          error: `Erro ao buscar detalhes na Anvisa (${detailRes.status})`
        });
      }

      const detailData = await detailRes.json();
      return res.status(200).json({
        ok: true,
        data: detailData
      });
    }

    // 2. Busca por termo ou registro (autocomplete)
    const searchTerm = (q || '').trim();
    if (!searchTerm) {
      return res.status(200).json({
        ok: true,
        results: [],
        total: 0
      });
    }

    const bularioUrl = `${gatewayBase}/api/v1/consulta/bulario`;
    const searchBody = {
      page: Math.max(1, parseInt(page, 10) || 1),
      count: Math.min(20, Math.max(1, parseInt(count, 10) || 10)),
      filter: {
        nomeProduto: searchTerm
      }
    };

    const searchRes = await fetch(bularioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(searchBody)
    });

    if (!searchRes.ok) {
      const errText = await searchRes.text();
      return res.status(searchRes.status).json({
        ok: false,
        error: `Erro na consulta da Anvisa (${searchRes.status}): ${errText}`
      });
    }

    const data = await searchRes.json();
    const rawList = Array.isArray(data.content) ? data.content : [];

    // Normaliza os resultados para consumo no frontend
    const results = rawList.map(item => {
      const numProcesso = item.numProcesso || '';
      const regFormatado = formatAnvisaRegister(item.numeroRegistro);

      return {
        idProduto: item.idProduto,
        nomeProduto: item.nomeProduto || '',
        numeroRegistro: item.numeroRegistro || '',
        numeroRegistroFormatado: regFormatado,
        razaoSocial: item.razaoSocial || '',
        cnpj: item.cnpj || '',
        expediente: item.expediente || '',
        numProcesso: numProcesso,
        temBulaPaciente: Boolean(item.idBulaPacienteProtegido),
        temBulaProfissional: Boolean(item.idBulaProfissionalProtegido),
        idBulaPaciente: item.idBulaPacienteProtegido || null,
        idBulaProfissional: item.idBulaProfissionalProtegido || null,
        // Link oficial da página de detalhes no portal da Anvisa
        anvisaUrl: numProcesso ? `https://consultas.anvisa.gov.br/#/bulario/detalhe/${numProcesso}` : 'https://consultas.anvisa.gov.br/#/bulario/',
        dataAtualizacao: item.dataAtualizacao ? new Date(item.dataAtualizacao).toISOString() : null
      };
    });

    return res.status(200).json({
      ok: true,
      query: searchTerm,
      page: data.number != null ? data.number + 1 : 1,
      totalPages: data.totalPages || 1,
      total: data.totalElements || results.length,
      results
    });

  } catch (error) {
    console.error('[API Anvisa Error]:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Erro interno no servidor ao consultar Anvisa'
    });
  }
}
