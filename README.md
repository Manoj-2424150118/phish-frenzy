# 🎣 Phish Frenzy — The Multiplayer Quiz Arena

A **free, real-time multiplayer quiz game** built for the **Handshake × OpenAI “Create a Multiplayer Game”** mission (AI Skills Studio). No logins, no credentials, no installs — open the link and play.

## ▶ Play it

**Live:** https://phish-frenzy.onrender.com (free tier: first load after idle can take ~50s to wake)

**Step 1:** type any name. **Step 2:** choose who you play against —

- **🤖 Solo vs Bots** — instant game against two built-in bots.
- **👥 Play with Friends** — *Create a room* to get a **room code**, share it, and everyone who enters that same code plays together live. Or *Join* with a code a friend shared.

## 🔑 Room-code lifecycle (by design)

A code is the key to one room and **stays valid while the group is playing** — it never expires mid-game or while a game is unfinished. Only after the game **finishes and every player has left** is the code deleted and retired. Anyone holding the code can join that room, so share it only with your group.

## How a game plays

1. Exactly **10 questions** per game, drawn fresh from the bank (or from your custom quiz)
2. Every question has **4 options**; everyone answers simultaneously
3. The instant *you* answer, you get your verdict — **✅ Correct / ❌ Not quite** — with points and a short clarification. The live leaderboard updates in real time as answers land
4. Scoring: 100 pts + speed bonus (up to +100) + streak bonus (+25 at 3-in-a-row)
5. Podium at the end, then play again in the same room

## 🔒 Answer security

Correct answers **never leave the server** before you answer — they can't be viewed by inspecting the page or its traffic. Each question instead carries a **SHA-256 commitment hash** of the locked answer; at round end the salt is revealed so anyone can verify the answer was fixed in advance and never changed mid-round.

## 📚 Build a quiz from YOUR notes

Paste notes or upload a **PDF / TXT / MD** file — the server extracts the text, analyses it (definitions + key-term cloze questions) and builds a brand-new 4-option quiz (up to 20 questions) for your room. Your group joins with the room code and tests itself on *your* material: class revision, team training, interview prep.

## The default bank

30 hand-written scam-awareness MCQs from real fraud patterns — KYC-block SMS, task-job WhatsApp scams, AI voice-clone family emergencies, QR refund traps, digital-arrest calls, plus the security fundamentals (2FA, passphrases, UPI PIN rules) — each with a plain-language clarification.

## Tech

- **Node.js + Express + Socket.io** — one small service, in-memory rooms (no database, no accounts)
- **pdfjs-dist** for PDF text extraction; rule-based quiz generation (no paid AI APIs — ₹0 to run)
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
