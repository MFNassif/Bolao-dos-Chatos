# Bolão da Copa do Mundo ⚽

PWA de bolão da Copa do Mundo: cadastro com usuário e senha (sem e-mail), palpites com bloqueio 1h antes do jogo, ranking que atualiza em tempo real durante os jogos.

---

## O que você precisa instalar

**Nada além do Git.**

Você não precisa de Node.js, npm, nem Firebase CLI na sua máquina. O GitHub Actions instala tudo e faz o build e o deploy automaticamente a cada vez que você envia código.

| Ferramenta | Para quê | Link |
|------------|----------|------|
| **Git** | Enviar o código para o GitHub | https://git-scm.com |
| **Navegador (Chrome)** | Configurar Firebase + GitHub | já tem |

---

## Sumário

1. [Criar projeto no Firebase](#1-criar-projeto-no-firebase)
2. [Ativar Authentication](#2-ativar-authentication)
3. [Configurar Firestore](#3-configurar-firestore)
4. [Configurar a API de futebol](#4-configurar-a-api-de-futebol)
5. [Criar repositório no GitHub](#5-criar-repositório-no-github)
6. [Subir o projeto para o GitHub](#6-subir-o-projeto-para-o-github)
7. [Gerar a Service Account do Firebase](#7-gerar-a-service-account-do-firebase)
8. [Cadastrar Secrets no GitHub](#8-cadastrar-secrets-no-github)
9. [Primeiro deploy automático](#9-primeiro-deploy-automático)
10. [Tornar um usuário admin](#10-tornar-um-usuário-admin)
11. [Disparar o primeiro sync de jogos](#11-disparar-o-primeiro-sync-de-jogos)
12. [Como atualizar o app depois](#12-como-atualizar-o-app-depois)
13. [Como funciona o tempo real](#13-como-funciona-o-tempo-real)
14. [Estrutura do Firestore](#14-estrutura-do-firestore)
15. [Trocar de API esportiva](#15-trocar-de-api-esportiva)
16. [Custos — por que é tudo grátis](#16-custos--por-que-é-tudo-grátis)
17. [Estrutura de pastas](#17-estrutura-de-pastas)

---

## 1. Criar projeto no Firebase

O Firebase é o banco de dados, autenticação e hospedagem do app. Tudo no plano grátis.

1. Abra https://console.firebase.google.com
2. Clique em **Criar um projeto**
3. Dê um nome (ex: `bolao-copa`) e conclua o assistente
4. **Mantenha o plano Spark (Grátis)** — não precisa adicionar cartão
5. No menu lateral clique em **⚙ Project settings → Geral**
6. Em **Seus apps**, clique no ícone **`</>`** (Web)
7. Dê um apelido ao app (ex: `bolao-web`) e clique em **Registrar app**
8. Copie o bloco `firebaseConfig` que aparece — você vai usar esses valores no passo 8

---

## 2. Ativar Authentication

1. Console Firebase → **Build → Authentication → Get started**
2. Aba **Sign-in method** → clique em **E-mail/senha** → ative e salve

> O app converte internamente o `username` em `username@bolao.local` para usar no Firebase Auth. O usuário nunca vê isso — só vê "usuário" e "senha".

---

## 3. Configurar Firestore

1. Console Firebase → **Build → Firestore Database → Criar banco de dados**
2. Escolha o modo **Produção**
3. Escolha a região `southamerica-east1` (São Paulo) e conclua

As **regras de segurança** e os **índices** são publicados automaticamente pelo GitHub Actions (passo 9) — você não precisa configurar nada manualmente.

---

## 4. Configurar a API de futebol

A API busca os jogos e placares da Copa do Mundo. O plano gratuito é suficiente.

1. Crie conta em https://dashboard.api-football.com/register
2. Confirme o e-mail e acesse o painel
3. Copie sua **API Key** — você vai usá-la no passo 8

Configurações padrão (já definidas nos workflows):
- Competição: Copa do Mundo de seleções (`ID = 1`)
- Temporada: `2026`

---

## 5. Criar repositório no GitHub

1. Abra https://github.com/new
2. Dê um nome ao repositório (ex: `bolao-copa`)
3. Deixe **público** (necessário para o plano grátis ilimitado de GitHub Actions)
4. **Não** marque "Add a README file"
5. Clique em **Create repository**
6. Copie a URL do repositório (ex: `https://github.com/seu-usuario/bolao-copa.git`)

---

## 6. Subir o projeto para o GitHub

Abra um terminal na pasta do projeto e rode:

```bash
git init
git add .
git commit -m "primeiro commit"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/SEU-REPO.git
git push -u origin main
```

> Os workflows do GitHub Actions já estão prontos na pasta `.github/workflows/`. Após o push, eles aparecem automaticamente na aba **Actions** do seu repositório.
> Eles vão **falhar** neste primeiro momento porque os Secrets ainda não foram configurados — isso é normal. Configure-os no próximo passo.

---

## 7. Gerar a Service Account do Firebase

A Service Account é uma credencial que permite ao GitHub Actions escrever no seu Firebase (publicar o site, salvar jogos, recalcular pontuação).

1. Console Firebase → **⚙ Project settings → Service accounts**
2. Clique em **Generate new private key** → confirme → um arquivo `.json` será baixado
3. Abra um terminal e converta para base64:

   **Linux / Mac:**
   ```bash
   base64 -i arquivo-baixado.json | tr -d '\n'
   ```

   **Windows (PowerShell):**
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("arquivo-baixado.json"))
   ```

4. Copie toda a string base64 gerada
5. **Apague o arquivo `.json`** do seu computador (ele é uma senha, não deve ficar salvo)

---

## 8. Cadastrar Secrets no GitHub

Secrets são variáveis secretas que o GitHub injeta nos workflows sem expor no código.

No seu repositório: **Settings → Secrets and variables → Actions → New repository secret**

Crie um secret para cada linha abaixo:

| Nome do secret | Valor |
|----------------|-------|
| `FIREBASE_SERVICE_ACCOUNT_B64` | a string base64 do passo 7 |
| `FOOTBALL_API_KEY` | sua chave da API-Football (passo 4) |
| `VITE_FIREBASE_API_KEY` | `apiKey` do firebaseConfig (passo 1) |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` do firebaseConfig |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` do firebaseConfig |
| `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` do firebaseConfig |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` do firebaseConfig |
| `VITE_FIREBASE_APP_ID` | `appId` do firebaseConfig |

> Clique em **New repository secret**, preencha o nome exatamente como na tabela, cole o valor e clique em **Add secret**. Repita para cada linha.

---

## 9. Primeiro deploy automático

Com os Secrets cadastrados, force o primeiro deploy:

1. GitHub → aba **Actions**
2. Na barra lateral, clique em **Build & Deploy**
3. Clique em **Run workflow → Run workflow**
4. Aguarde (leva ~2 minutos)
5. Verde ✅ = sucesso

No final do log do workflow você verá a URL pública do app (ex: `https://bolao-copa.web.app`).

> Daqui pra frente: toda vez que você fizer `git push`, o deploy acontece automaticamente.

---

## 10. Tornar um usuário admin

A primeira promoção precisa ser feita no console (não há outro admin para te promover):

1. Abra o app e crie uma conta normalmente
2. Console Firebase → **Firestore Database** → coleção `users`
3. Clique no documento com o seu uid
4. Clique no campo `role` → altere de `"user"` para `"admin"` → salve
5. Recarregue o app — a aba **Admin** vai aparecer

A partir daí, você pode promover outros usuários direto pela tela Admin do app.

---

## 11. Disparar o primeiro sync de jogos

A tela de Jogos começa vazia até o primeiro sync. Faça manualmente:

1. GitHub → aba **Actions**
2. Na barra lateral, clique em **Sync Games**
3. Clique em **Run workflow → Run workflow**
4. Aguarde ~30 segundos
5. Reabra o app — os jogos já aparecem

Daqui pra frente o sync roda automaticamente todo dia às 06:00 UTC.

---

## 12. Como atualizar o app depois

Para qualquer mudança (corrigir texto, ajustar design, alterar regra de pontuação):

```bash
# edite os arquivos que quiser
git add .
git commit -m "descreva a mudança"
git push
```

O GitHub Actions faz o resto: instala dependências, builda e publica no Firebase Hosting automaticamente. Você não precisa de Node.js nem de nenhuma ferramenta extra.

---

## 13. Como funciona o tempo real

O app atualiza placares e ranking automaticamente porque usa dois mecanismos juntos:

**1. GitHub Actions atualiza o Firestore a cada 5 minutos (durante jogos)**

```
API esportiva → GitHub Actions (a cada 5 min) → Firestore
```

O workflow **Update Results** roda a cada 5 minutos, mas **só chama a API esportiva** se detectar jogo `live` ou prestes a começar no Firestore. Fora dos horários de jogos: zero chamadas à API.

**2. O app no celular recebe as mudanças em milissegundos**

```
Firestore → app de todos os usuários (onSnapshot, instantâneo)
```

O frontend usa `onSnapshot` do Firestore: assim que o servidor escreve um novo placar, todos os celulares com o app aberto recebem a atualização em menos de 1 segundo.

**O que o usuário vê:**

- Placar oficial muda no card do jogo (automático)
- Badge **AO VIVO** pulsa na aba Ranking
- Palpites com "+5 CRAVOU" ou "+1" piscando
- Ranking se reorganiza sozinho

**Latência total:** até ~5 minutos entre o gol real e a atualização no app (tempo do cron + tempo da API). Para um bolão de amigos, isso é suficiente.

**Exemplo de placar ao vivo:**

- BRA 1×0 ARG `live` — quem palpitou 1×0 aparece com **+5** no ranking
- Gol! BRA 1×1 ARG — ranking reorganiza: quem palpitou 1×1 sobe pra **+5**, quem tinha 1×0 cai pra **0**
- Apito final: pontos congelam naquele valor

---

## 14. Estrutura do Firestore

### `users/{uid}`
```json
{
  "uid": "abc123",
  "username": "joao_silva",
  "displayName": "João Silva",
  "role": "user",
  "totalPoints": 18,
  "exactScores": 2,
  "correctResults": 8,
  "predictionsCount": 12,
  "createdAt": "<timestamp>"
}
```

### `usernames/{username}`
Reserva única de nome de usuário.
```json
{ "uid": "abc123", "createdAt": "<timestamp>" }
```

### `games/{gameId}`
```json
{
  "externalId": "12345",
  "homeTeam": "Brasil", "awayTeam": "Argentina",
  "homeTeamCode": "BRA", "awayTeamCode": "ARG",
  "homeTeamFlag": "https://.../bra.png",
  "awayTeamFlag": "https://.../arg.png",
  "startTime": "<timestamp UTC>",
  "stage": "Group Stage", "group": "C",
  "status": "scheduled",
  "homeScore": null, "awayScore": null, "winner": null,
  "lastUpdatedAt": "<timestamp>"
}
```

### `predictions/{gameId_userId}`
```json
{
  "userId": "abc123",
  "username": "joao_silva",
  "displayName": "João Silva",
  "gameId": "ext_12345",
  "homePrediction": 2, "awayPrediction": 1,
  "points": 5,
  "exactScoreHit": true, "resultHit": true,
  "isFinalized": false,
  "createdAt": "<timestamp>",
  "updatedAt": "<timestamp>",
  "lockedAt": "<timestamp>"
}
```

> `points` reflete o estado atual. Enquanto `live`, varia conforme o placar muda. Quando `finished`, `isFinalized` vira `true` e os pontos congelam.

### `syncLogs/{logId}`
Histórico de cada sincronização. Visível na aba Admin → Logs.

### Regras de pontuação

| Resultado oficial | Palpite | Pontos |
|-------------------|---------|--------|
| BRA 2×1 ARG | BRA 2×1 ARG | **5** (exato) |
| BRA 2×1 ARG | BRA 1×0 ARG | **1** (acertou vencedor) |
| BRA 2×1 ARG | BRA 1×1 ARG | **0** |
| FRA 0×0 ALE | FRA 0×0 ALE | **5** (exato) |
| FRA 0×0 ALE | FRA 1×1 ALE | **1** (acertou empate) |
| FRA 0×0 ALE | FRA 2×1 ALE | **0** |

---

## 15. Trocar de API esportiva

Toda a integração com a API fica em **um único arquivo**: `scripts/lib/footballApi.js`.

Para trocar de provedor:

1. Atualize o GitHub Secret `FOOTBALL_API_KEY` e, se mudou, `FOOTBALL_API_BASE_URL` em Variables
2. Em `scripts/lib/footballApi.js`, reescreva `fetchFixtures()` e `mapFixtureToGame()` para o novo formato
3. Faça `git push` — o próximo sync já usa o novo provedor

O frontend não muda nada — lê apenas do Firestore.

---

## 16. Custos — por que é tudo grátis

| Serviço | Plano | Limite grátis | Uso do bolão |
|---------|-------|---------------|--------------|
| Firebase Auth | Spark | 50 mil usuários/mês | dezenas |
| Firestore | Spark | 50k leituras, 20k escritas/dia, 1 GB | folgado |
| Firebase Hosting | Spark | 10 GB transferência/mês | folgado |
| GitHub Actions | Free (repo público) | minutos ilimitados | folgado |
| API-Football | Free | 100 chamadas/dia | ~72 em dia de Copa |

**Como cabe nas 100 chamadas/dia da API:**
O workflow roda a cada 5 min (288 vezes/dia), mas **só chama a API** quando detecta jogo `live` ou prestes a começar. Em dia sem jogo: 0 chamadas. Dia de Copa com 6h de jogos ao vivo: ~72 chamadas. ✅

---

## 17. Estrutura de pastas

```
bolao-copa/
├── index.html
├── package.json          ← dependências (só o GitHub Actions precisa disso)
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── .gitignore
├── README.md
├── public/
│   ├── favicon.svg
│   ├── robots.txt
│   └── icons/
│       ├── icon-192.png
│       ├── icon-512.png
│       └── icon-512-maskable.png
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   ├── routes/
│   │   ├── AuthContext.js
│   │   ├── ProtectedRoute.jsx
│   │   └── AdminRoute.jsx
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   ├── Games.jsx
│   │   ├── Predictions.jsx
│   │   ├── Ranking.jsx
│   │   └── Admin.jsx
│   ├── components/
│   │   ├── Layout.jsx
│   │   ├── BottomNav.jsx
│   │   ├── GameCard.jsx
│   │   ├── TeamBadge.jsx
│   │   ├── PredictionForm.jsx
│   │   ├── RankingTable.jsx
│   │   └── Loading.jsx
│   ├── services/
│   │   ├── firebase.js
│   │   ├── authService.js
│   │   ├── gameService.js
│   │   ├── predictionService.js
│   │   ├── rankingService.js
│   │   └── adminService.js
│   └── utils/
│       ├── scoring.js
│       ├── dates.js
│       └── locks.js
├── scripts/              ← rodam no GitHub Actions, nunca na sua máquina
│   ├── package.json
│   ├── syncGames.js
│   ├── updateResults.js
│   ├── recalculate.js
│   └── lib/
│       ├── firebase.js
│       ├── footballApi.js
│       ├── scoring.js
│       ├── scoringEngine.js
│       ├── syncGames.js
│       └── updateResults.js
└── .github/
    └── workflows/
        ├── deploy-hosting.yml     ← build + deploy automático no push
        ├── deploy-rules.yml       ← publica regras do Firestore automático
        ├── sync-games.yml         ← sync diário às 06:00 UTC
        ├── update-results.yml     ← atualiza placares a cada 5 min
        └── recalculate-scores.yml ← recálculo manual
```

---

## PWA — instalar no celular

1. Abra a URL do app no Chrome do Android
2. Menu **⋮ → Adicionar à tela inicial**
3. O app abre em tela cheia, com ícone próprio

No iPhone (Safari): **Compartilhar → Adicionar à tela inicial**

---

Boa sorte no bolão! 🏆
