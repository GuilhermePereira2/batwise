# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/1399b0e1-7020-4ec5-98a4-afd1146b5d14

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/1399b0e1-7020-4ec5-98a4-afd1146b5d14) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Navigate to the frontend app.
cd frontend

# Step 4: Install the necessary dependencies.
npm i

# Step 5: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Repo structure

- frontend/ (Vite + React app)
- backend/ (API, business logic, database handler)
- database/ (scripts de setup e testes de database)

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/1399b0e1-7020-4ec5-98a4-afd1146b5d14) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Setup Rápido - Escolhe o Cenário

```bash
# Executa o script interativo que configura tudo automaticamente:
./setup-env.sh
```

O script vai te pedir para escolher um dos 4 cenários:

| Cenário | Frontend | Backend | Database | Quando usar |
|---------|----------|---------|----------|------------|
| **1 - Tudo Local** | Local (dev) | Local | Local | Desenvolvimento offline completo |
| **2 - Backend Local + DB Online** | Local (dev) | Local | AWS | Testar lógica localmente com dados reais |
| **3 - Frontend Local + Backend/DB Online** | Local (dev) | AWS | AWS | Testar UI contra backend em produção |
| **4 - Deploy (Produção)** | Vercel | AWS/Railway | AWS | Fazer deploy em produção |

### Detalhes de cada cenário

#### Cenário 1: Tudo Local
```bash
# Setup automático pelo script
./setup-env.sh  # Escolhe opção 1

# O script vai criar a tabela DynamoDB automaticamente

# Depois executa (em 3 terminais diferentes):
docker run -p 8000:8000 amazon/dynamodb-local  # Terminal 1 - Database
cd backend && python main.py                     # Terminal 2 - API
cd frontend && npm run dev                       # Terminal 3 - UI
```

#### Cenário 2: Backend Local + Database Online
```bash
# Setup automático pelo script
./setup-env.sh  # Escolhe opção 2

# Edita o .env e adiciona credenciais AWS:
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...

# Depois executa (em 2 terminais):
cd backend && python main.py                     # Terminal 1
cd frontend && npm run dev                       # Terminal 2
```

#### Cenário 3: Frontend Local + Backend/Database Online
```bash
# Setup automático pelo script
./setup-env.sh  # Escolhe opção 3

# Edita o .env e coloca a URL do backend online:
# VITE_API_URL=https://your-backend-url.com

# Depois executa (1 terminal):
cd frontend && npm run dev                       # Terminal 1
```

#### Cenário 4: Deploy em Produção
```bash
# Sem .env local. Push para GitHub e:
git push origin preview

# Vercel faz deploy automático do frontend
# AWS Lambda/Railway faz deploy automático do backend
# DynamoDB gerido pelo AWS
```

---



