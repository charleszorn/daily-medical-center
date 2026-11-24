# Daily Medical Center

Aplicativo/site de gerenciamento de medicamentos, sintomas e relatórios de saúde, com login/cadastro por usuário.

## Funcionalidades

- Cadastro de medicamentos por categoria/tratamento: cardíacos, ansiedade/depressão, emagrecimento, vitaminas, menstruação/cólica e outros.
- Dosagem completa: quantidade de medicamentos/comprimidos e dosagem (ex: 50mg).
- Horários de tomada e marcação de doses tomadas.
- Registro de sintomas/estado do paciente (dor de cabeça, tontura, desmaio, sangramento nasal, pressão alta/baixa, glicemia, náusea, enjoo, etc.) com intensidade.
- Histórico de monitoramento em calendário.
- Relatórios de saúde em PDF sob demanda.
- Login/cadastro de usuários (dados isolados por conta).
- Instalável como aplicativo (PWA) — funciona offline.

## Rodar localmente

```bash
cd "Projeto Padrão"
npx serve
```
Acesse o endereço mostrado (ex: http://localhost:3000). Também pode abrir `index.html` direto no navegador.

## Deploy na Vercel

1. Instale a CLI: `npm i -g vercel`
2. Na pasta do projeto: `vercel` (primeira vez) e depois `vercel --prod`.
3. Ou conecte o repositório no painel da Vercel (Import Project) — ela detecta o `vercel.json`.

Os dados dos usuários ficam no navegador (localStorage) por padrão.

## Sincronização na nuvem (opcional — Supabase)

Para usar em qualquer dispositivo com os mesmos dados, configure o Supabase:

1. Crie um projeto em https://supabase.com
2. Em `js/auth.js`, preencha:
   ```js
   const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
   const SUPABASE_ANON_KEY = 'SUA-ANON-KEY';
   ```
3. Crie as tabelas (medications, doses, symptoms) com RLS por usuário (user_id).
4. Faça redeploy.

Sem essas credenciais, o app funciona em modo local (cada navegador tem seus próprios dados).

## Estrutura

- `index.html` — aplicação principal
- `css/styles.css` — estilos
- `js/` — lógica (auth, storage, app, medications, symptoms, schedule, history, reports, auth-ui)
- `manifest.json` + `sw.js` + `assets/icon.svg` — PWA
- `vercel.json`, `package.json` — deploy

## Privacidade

No modo local, todos os dados ficam armazenados no dispositivo do usuário. Nenhuma informação é enviada a servidores.
