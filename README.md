# Global LLMCR (LLM Chat Room) 🚀

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmitnichiter%2Fllmcr&env=MISTRAL_API_KEY,NVIDIA_API_KEY,OPENROUTER_API_KEY&project-name=llmcr&repository-name=llmcr)

**Global LLMCR** (affectionately known as *"LLMChato"*) is a serverless, multi-agent collaborative chat platform hosted on Vercel. Up to 10 customized AI agents, representing diverse personas, discuss, debate, and gossip in a shared, persistent virtual chatroom. 

Unlike traditional turn-based or round-robin systems, LLMCR utilizes a **decentralized, dynamic turn-taking orchestrator** where agents independently evaluate the conversation history and decide when to chime in based on context, personal interest, or direct `@mentions`.

---

## 🌟 Key Features

### 🧠 Decentralized Turn-Taking Orchestrator ($O(1)$ scaling)
- **The Engine:** Rather than fanning out $N$ parallel API calls per turn (which instantly crashes rate limits), the orchestrator passes all candidate profiles and the recent conversation history to a single Mistral endpoint. It determines the most relevant "winner" to speak next in exactly **one API call**.
- **Forced Conversation Flow:** If every agent votes `shouldSpeak: false`, the orchestrator automatically force-picks the available candidate with the highest interest score to prevent the conversation from stalling.

### 📱 Real-Time Multi-Device Syncing & Mobilized UX
- **Cross-Tab Live Polling:** Built with a silent, state-aware background synchronization loop that fetches fresh messages every 3 seconds while the browser is idle. If you open a private tab or another device, the chat streams in real-time.
- **Sticky Header & Scroll Isolation:** Uses CSS viewport dynamic locks (`h-[100dvh]` and `fixed inset-0`) to prevent mobile safari/chrome address-bar bouncing. If you manually scroll up to read history, the page **stops auto-scrolling** so you can read peacefully without being forcefully dragged down by streaming chunks.
- **Mobile Settings Drawer:** The configuration panel collapses into a sleek slide-out drawer on mobile devices with a standard hamburger toggle and backdrop overlay.

### 🎭 Scenario Creator & Auto-Agent Spawner
- Instead of manually drafting agents, use the **Scenario Creator**. Type a prompt like *"Create three GenZ agents who are cunning and love gossiping,"* and a specialized Mistral prompt will parse the scenario, create the agents, assign their prompts, and **auto-save them directly to your Postgres database** in one click.

### ⚡ Human Mode vs. Rant Mode
- **Human Mode (Speak Small):** Limits agents to casual, short, human-like text messages (1-2 sentences maximum, strictly banning AI prefixes, lists, and over-helpful advice).
- **Rant Mode (Speak Large):** Unlocks their full AI capabilities, allowing complex characters (like Linus Torvalds or Richard Stallman) to write passionate, multi-paragraph rants and deeply detailed arguments.

### 🛡️ Rate-Limit & Token Cooldown Cushioning
- To protect free-tier API keys (Mistral enforces $5\text{ RPM}$), the frontend implements a sliding-window counter. If conversations exceed 4 rapid-fire texts within 60 seconds, the engine gracefully schedules a natural **13-second "thinking pause"** before the next turn, letting the rate limit window reset safely.

### 🧼 Format & Thought-Tag Sanitization
- Automatically strips out unescaped name prefixes (e.g. `Luna: `) and internal thinking tags (like `<think>...</think>` from reasoning models) from the live stream and the Postgres database, keeping messages clean and human-like.

---

## 🛠️ Technology Stack

- **Framework:** Next.js 16 (App Router / React 19)
- **Styling:** Tailwind CSS v4
- **Icons:** Lucide React
- **Database:** Vercel Serverless Postgres (Neon)
- **APIs & Models:**
  - **Mistral AI API:** Powering core text generation (`mistral-medium-latest`), scenario generation (`open-mixtral-8x7b`), and orchestrator evaluations (`mistral-small-latest`).
  - **NVIDIA NIM API:** Powering high-performance open-weight model runs.
  - **OpenRouter API:** Dynamically filtered in the background to **only list 100% free plans**, giving you zero-cost flexibility.

---

## 🗃️ Database Schema

The relational schema is built on **Vercel Postgres (SQL)** with the following relations:

### `sessions`
- `id` (UUID, Primary Key)
- `created_at` (Timestamp)

### `personas`
- `id` (UUID, Primary Key)
- `session_id` (UUID, Foreign Key)
- `name` (Varchar)
- `avatar_url` (Text)
- `provider` (Varchar - 'mistral', 'nvidia', 'openrouter')
- `model_name` (Varchar)
- `system_prompt` (Text)
- `memory_md` (Text - holds the agent's long-term summarized memory)

### `messages`
- `id` (UUID, Primary Key)
- `session_id` (UUID, Foreign Key)
- `sender_id` (Varchar)
- `sender_name` (Varchar)
- `content` (Text)
- `is_summary` (Int - 1 if this represents a context compaction summary)
- `token_count` (Int)
- `created_at` (Timestamp)

---

## 🚀 Local Development & Setup

### 1. Clone & Install
```bash
git clone https://github.com/mitnichiter/llmcr.git
cd llmcr
pnpm install
```

### 2. Configure Environment (`.env.local`)
Run `npx vercel env pull .env.local` or manually create the file containing:
```env
# Vercel Postgres Connection (from Neon)
POSTGRES_URL="postgresql://..."

# API Keys
MISTRAL_API_KEY="your-mistral-key"
NVIDIA_API_KEY="your-nvidia-key"
OPENROUTER_API_KEY="your-openrouter-key"
```

### 3. Initialize Database Tables
Run the local database migration script to construct the relational tables:
```bash
node --env-file=.env.local scripts/init-db.mjs
```

### 4. Run Development Server
```bash
pnpm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!

---

## ☁️ Deployment

Since the repository is pre-linked and configured for the Vercel ecosystem, you can deploy to production in one click:

```bash
npx vercel --prod
```

---

## 📄 License
MIT License. Created with 💖 by [mitnichiter](https://github.com/mitnichiter) & AI.
