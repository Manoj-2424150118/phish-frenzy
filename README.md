# 🎣 Phish Frenzy — Spot the Scam, Beat Your Friends

A **real-time multiplayer party game** built for the **Handshake × OpenAI “Create a Multiplayer Game”** mission (AI Skills Studio).

A message flashes up — an SMS, a WhatsApp, an email, a phone call. Is it a **scam** or **legit**? Everyone answers at once, fastest correct tap wins bonus points, streaks catch fire 🔥, and every round ends with the real-world red flag explained — so players leave sharper than they arrived.

## ▶ Play it

**Live demo:** https://phish-frenzy.onrender.com — open it, create a room, share the 4-letter code. Friends join from any phone or laptop. **No logins. No installs.** (Free tier: first load after idle can take ~50 seconds to wake.)

Solo? Tick **“Add 2 demo bots”** and you still get the full multiplayer feel.

## How it plays

1. **Create or join** a room with a 4-letter code
2. **10 rounds** — a scenario appears for everyone at the same instant (Socket.io sync)
3. Tap **🚨 SCAM** or **✅ LEGIT** — 100 pts + speed bonus (up to +100) + streak bonus (+25 at 3-in-a-row)
4. **Reveal** — the answer plus the red flag that gives it away (UPI PINs are never for *receiving* money; “digital arrest” isn’t real; check the sender domain letter by letter…)
5. **Podium** — final leaderboard, then play again in the same room, any night

## The bank

24 hand-written scenarios drawn from real fraud patterns — KYC-block SMS, task-job WhatsApp scams, AI voice-clone family emergencies, QR-refund refund traps, digital-arrest calls — mixed with genuinely legitimate alerts, so “everything is a scam” is a losing strategy.

## Tech

- **Node.js + Express + Socket.io** — one small service, in-memory rooms (no database, no accounts)
- Vanilla HTML/CSS/JS frontend — mobile-first, zero build step
- `render.yaml` Blueprint for one-click free-tier deployment

## Run locally

```bash
npm install
npm start        # http://localhost:3000
npm test         # two-client smoke test: create/join/answer/reveal/scoring
```

## Submission (Handshake AI Skills Studio)

- **Title:** Phish Frenzy — Spot the Scam, Beat Your Friends
- **Mission:** Create a Multiplayer Game
- **Deadline:** Entries close **30 Oct 2026, 11:59 PM PT** per the official rules (mission page says Oct 31)

Built by **Manoj Kumar Sharma** — cybersecurity & software professional, AI Fellow at Handshake AI. The game doubles as scam-awareness training, companion to the *Scam Decoded* awareness project.
