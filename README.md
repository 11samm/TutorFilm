# 🎬 TutorFilm

**AI-directed educational mini-movies for the classroom.** Describe a lesson (or upload a PDF), pick how your teacher appears and sounds, then walk through a guided pipeline—script → thumbnails → scene videos → background score → final mix—until you can **preview and download** a single polished MP4.

---

## ✨ What you get

| | |
|:---|:---|
| 📝 **Smart script** | Structured scenes with dialogue tuned to duration and reading level |
| 🎭 **Cast & voice** | Animated teacher (male / female / custom selfie) or narrated B-roll; **voice picks match** default male vs female avatars |
| 🖼️ **Keyframes** | Stylized thumbnails per scene for approval before animation |
| 🎥 **Scene clips** | Per-scene video with consistent character reference where applicable |
| 🎵 **Music bed** | Lyria-generated **instrumental** underscore, mixed under dialogue on export |
| 📤 **Final export** | Server-side concat + FFmpeg mux → one downloadable lesson video |

The workspace is a **40/60 split**: **Director’s Desk** (left) for choices and approvals, **AI canvas** (right) for progress, script, and gallery.

---

## 🧭 User flow (high level)

1. **Landing** — Target age, lesson concept, optional PDF, duration  
2. **Cast & voice** — Toggle animated teacher vs B-roll, choose avatar and voice → **Continue — write script**  
3. **Waiting** — Script generates; progress on the right  
4. **Approve script** — Edit scene order/dialogue if needed → confirm  
5. **Thumbnails** — Approve or redo → confirm  
6. **Animations** — Scene videos → confirm  
7. **Assembly & music** — Clips stitched, score composed, **final mix** → download when ready  

---

## 🛠️ Tech stack

- **Framework:** [Next.js](https://nextjs.org) 16 · [React](https://react.dev) 19 · TypeScript  
- **UI:** Tailwind CSS v4 · [shadcn/ui](https://ui.shadcn.com) patterns · [Framer Motion](https://www.framer.com/motion/) · [Lucide](https://lucide.dev) icons  
- **State:** [Zustand](https://zustand-demo.pmnd.rs/)  
- **Backend & media:** [Supabase](https://supabase.com) (DB + storage) · server-side **FFmpeg** (`ffmpeg-static`) for stitch/mux  
- **AI:** Google **Gemini** (script) · **Veo**-style video pipeline · **Lyria** (music via `@google/genai`) · thumbnail generation per `generate-thumbnail` route  

---

## 📁 Project layout (useful paths)

```
app/
  api/          # generate-script, generate-thumbnail, generate-video,
                # generate-music, stitch-scenes, stitch-video, …
  page.tsx      # Shell: setup → workspace
components/
  tutor-film/   # LeftPane, RightPane, SetupScreen, …
lib/
  store.ts      # Zustand project + pipeline actions
  voice-catalog.ts
supabase/
  migrations/   # SQL migrations
```

Deeper architecture notes live in [`PLANNING.md`](./PLANNING.md).

---

## ⚙️ Setup

### 1. Install

```bash
npm install
```

### 2. Environment

Copy the example file and fill in real values:

```bash
cp .env.example .env.local
```

| Variable | Purpose |
|:---------|:--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only (storage / admin updates) |
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` | Script + compatible Google AI calls (see code paths) |
| Thumbnail / video keys | As required by your `generate-thumbnail` & `generate-video` routes |
| `NEXT_PUBLIC_DEFAULT_*_ANGLES_URL` | Default male/female **character angle** reference images |
| `NEXT_PUBLIC_DEMO_VIDEO_URL` | Optional demo shortcut |

> 🔒 Never commit `.env.local` or service role keys.

> Reccomended Male Template : https://png.pngtree.com/png-vector/20240628/ourmid/pngtree-friendly-israeli-man-good-looking-man-show-the-full-body-pixar-png-image_12751167.png

> Reccomended Female Template : https://i.ibb.co/rC7Wfwd/Gemini-Generated-Image-frvn0lfrvn0lfrvn.png

### 3. Database

Apply migrations in `supabase/migrations/` to your Supabase project (SQL editor or CLI), matching your deployment.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build   # production build
npm start       # run production server
npm run lint    # eslint
```

---

## 📜 Scripts

| Command | Description |
|:--------|:------------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Lint the repo |

---

## 🙏 Credits

UI bootstrapped with [v0](https://v0.app); evolved into the TutorFilm product flow above.

---

<p align="center">
  <b>Teach once. Film it beautifully. 🎓✨</b>
</p>
