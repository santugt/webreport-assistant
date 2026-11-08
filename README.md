# webreport-assistant

> **AI-powered code generator for OpenText WebReports** — describe what you need in plain English, get production-ready WebReport tag code instantly.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.x-61DAFB.svg)](https://react.dev/)
[![Deployments](https://img.shields.io/badge/Production%20Deployments-2-brightgreen.svg)](#deployments)

---

## The Problem

**OpenText WebReport development is painful.**

WebReports are the primary automation, orchestration, and reporting layer inside OpenText Content Server (Extended ECM) — used by thousands of large enterprises globally. But developing them requires mastering a complex, proprietary tag syntax (Data Tags, Control Tags, Sub-WebReports, LLURLs, OScript integrations) that:

- Has no modern AI-native tooling
- Has sparse, hard-to-navigate official documentation
- Takes months to learn from scratch
- Costs organizations thousands of dollars in certified OpenText consultant time for routine tasks

There are **zero open-source AI-assisted tools** for WebReport code generation anywhere on GitHub, npm, or PyPI.

---

## The Solution

**webreport-assistant** lets any developer — regardless of their OpenText experience level — describe a report in plain English and receive correct, ready-to-use WebReport tag code.

```
Prompt:  "Show me all documents modified in the last 30 days, 
          grouped by the user who modified them, 
          with a link to open each document."

Output:  [WebReport tag block with correct Data Tags, 
          Control Tags, and LLURL syntax generated instantly]
```

---

## Features

| Feature | Description |
|---------|-------------|
| 🤖 **AI Code Generation** | Generates WebReport Data Tags, Control Tags, Sub-WebReport calls, SQL data sources, and REST integrations from natural language prompts |
| 🔐 **Google Authentication** | Secure Google OAuth login — only authorised team members can access the generator |
| 🎫 **Token Gating** | Usage limits and access control per user — prevents API cost overruns in team environments |
| 📋 **Audit Logging** | Full audit trail of every prompt submitted and code generated — essential for enterprise compliance environments |
| 🛡️ **Maintenance Mode** | Admin-controlled maintenance mode with bypass capability for uninterrupted admin access during updates |
| 🌐 **Web-based** | No local installation needed — runs in the browser, accessible to your entire team |

---

## Who Is This For?

- **OpenText Content Server / Extended ECM developers** who write WebReports regularly and want to accelerate routine code generation
- **New team members** onboarding into an OpenText environment with limited WebReport experience  
- **IT teams at enterprises** using OpenText who want to reduce dependency on expensive certified consultants for standard report generation tasks
- **OpenText administrators** who occasionally need WebReport code but are not full-time developers

---

## Supported WebReport Patterns

- ✅ Data source queries (SQL, Object queries)
- ✅ Data Tag generation (`[LL_REPTAG_ ... /]`)
- ✅ Control Tags (loops, conditionals, branching)
- ✅ LLURL-based navigation links
- ✅ Sub-WebReport invocations
- ✅ REST API call integration within WebReports
- 🔄 Alpaca Forms integration *(in progress)*
- 🔄 OScript integration scaffolding *(in progress)*

---

## Tech Stack

- **Frontend:** React 18 + TypeScript
- **Auth:** Google OAuth 2.0
- **AI Backend:** LLM API integration for WebReport-specific code generation
- **Deployment:** Production-deployed (2 live environments)

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Google OAuth client ID (for authentication)
- An LLM API key

### Installation

```bash
git clone https://github.com/santugt/webreport-assistant.git
cd webreport-assistant
npm install
```

### Configuration

Create a `.env` file in the root:

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_API_KEY=your_llm_api_key
VITE_APP_ENV=development
```

### Run Locally

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Deployments

This project is actively deployed in production across two environments:

| Environment | Status |
|-------------|--------|
| Production — webreport-assistant | 🟢 Live |
| Production — webreport-coder | 🟢 Live |

---

## Why This Matters for the OpenText Ecosystem

OpenText Content Server is deployed at **100,000+ enterprise customers globally** (per OpenText's official figures). WebReport is a standard component of every Content Server installation.

Despite this scale, the developer tooling ecosystem for WebReports has remained stagnant — no code generators, no AI assistants, no modern IDE plugins with WebReport-specific intelligence. Developers continue to rely on a combination of memorised tag syntax, forum posts, and expensive consultant time.

**webreport-assistant** is the first open-source attempt to bring AI-assisted development to this ecosystem. Because OpenText developers work primarily inside corporate firewalls and closed enterprise networks, public GitHub activity metrics underrepresent actual usage — but the problem this tool solves is real and widespread.

---

## Contributing

Contributions are welcome — especially from developers working in OpenText environments who can contribute:

- Additional WebReport tag pattern examples
- Edge case prompts and their correct outputs  
- Documentation improvements
- Bug reports from real WebReport generation scenarios

Please open an issue or submit a pull request.

---

## Roadmap

- [ ] Expanded tag library covering advanced WebReport patterns
- [ ] Prompt history and saved templates per user
- [ ] Direct export to Content Server via REST API
- [ ] Few-shot example library for community contribution
- [ ] VS Code extension for inline WebReport generation

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Acknowledgements

Built to solve a real pain felt by OpenText WebReport developers worldwide. If you work with OpenText Content Server and find this useful, please ⭐ star the repo — it helps others in the ecosystem discover it.

