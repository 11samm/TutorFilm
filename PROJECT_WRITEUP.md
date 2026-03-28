# TutorFilm — Project write-up

A concise narrative you can drop into a submission deck, Devpost, or README supplement.

---

### Inspiration

We wanted to shrink the gap between **“I have a lesson in my head”** and **“my students can watch it”**—without a film crew, recording booth, or video editor. Teachers already juggle enough; if an **AI director** could break a topic into tight scenes, keep a consistent on-screen teacher, and hand back a single file, that felt worth building. The spark was: *educational TV, but personal and fast enough for a real classroom timeline.*

---

### What the application does

**TutorFilm** is a web app that turns a lesson concept (and optionally a PDF) into a **short educational video**. The teacher sets **age band** and **duration**, then chooses **cast**: animated teacher (default male/female or custom selfie) or **narrated B-roll** only. They pick a **voice** (matched to avatar gender when using defaults), start **script generation**, and move through a **guided pipeline**:

1. **Script approval** — scenes with dialogue and visuals  
2. **Thumbnails** — approve or redo keyframes  
3. **Scene videos** — per-scene animation with dialogue  
4. **Assembly & music** — clips stitched, **instrumental** background score added, **final mux** for one downloadable **MP4**  

The UI is a **Director’s Desk** (left) and **AI canvas** (right): choices and checkpoints on one side, progress and gallery on the other.

---

### How it was built

| Layer | Choices |
|:------|:--------|
| **Frontend** | Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn-style components, Zustand for global project state, Framer Motion for transitions |
| **Backend** | Next.js **API routes** for each expensive step: script, thumbnails, video, scene stitch, music, final stitch/mux |
| **Data & files** | **Supabase** for persistence and storage; server routes update projects and scenes |
| **AI** | **Gemini**-family models for structured script JSON; image generation for thumbnails/angles; **Veo**-style APIs for scene video; **Lyria** for music via Google’s GenAI SDK |
| **Media** | **FFmpeg** on the server (`ffmpeg-static`) to concatenate scene clips and mix a ducked music bed under dialogue |

The client drives a **stage machine** (setup → script approval → thumbnails → videos → final) so the teacher always knows what to do next.

---

### Challenges we ran into

- **Pipeline state** — Script, images, video, music, and final mux can finish in different orders. We had to avoid “checkpoints” that looked done before work actually finished (e.g. music vs. stitch) and keep the UI honest.  
- **Music vs. narration** — Generative music sometimes wanted **vocals or gibberish**; we tightened prompts, used **audio-only** responses where possible, and emphasized **instrumental bed** language so the score stays under the voiceover.  
- **Consistency** — Keeping a **recognizable teacher** across scenes meant threading **character reference** URLs and prompts carefully through thumbnail and video steps.  
- **Server-side media** — Running **FFmpeg** in API routes meant handling temp files, failures, and uploads reliably—not just “happy path” demos.  
- **Rate limits & cost** — Video generation is **per scene**; we sequenced work and designed the UI so teachers see **progressive** results instead of one long blind wait.

---

### How our project isn’t like other applications

- **Purpose-built for teaching** — Not a generic chat UI or slideshow exporter; the whole flow is **scene-based**, **age-aware**, and ends in a **single lesson video** with a clear approval path.  
- **Director metaphor** — You’re not “prompt engineering” in a void; you’re **green-lighting** script → images → motion → mix, like a tiny studio.  
- **Cast and voice as first-class** — Avatar mode (including **B-roll-only**) and **gender-aware voice** options are part of setup, not an afterthought.  
- **Full stack, not a mock** — Real storage, real stitch/mux, and a path from **concept** to **downloadable file**, not just a preview player with placeholder assets.

---

### What we are proud of

- An **end-to-end story** a teacher can actually follow: land → cast → script → approve → ship.  
- **Clarity under complexity** — Many async jobs, but one **rail** and one **desk** so it doesn’t feel like a research demo.  
- **Sweating the mix** — Taking the time to **duck music under dialogue** so the final watch feels intentional, not “two MP3s slammed together.”  
- **Honest UX** — Explicit **Continue** before script generation and **waiting** states so nobody wonders whether the app is doing anything.

---

### What we learned

- **Orchestration beats one big prompt** — Reliable video comes from **small contracts** between steps (JSON script, URLs, durations), not one mega-generation.  
- **Product state is part of the feature** — `stage` + `status` + per-scene rows are as important as any model choice.  
- **Media belongs on the server** — FFmpeg in the browser wasn’t the answer; **short-lived server jobs + storage URLs** scaled better mentally and operationally.  
- **Defaults matter** — Default avatars, angle sheets, and voice catalogs save teachers from blank-slate paralysis.

---

### Next steps for our project

- **Richer “teacher” presence** — Deeper character continuity, optional **VTuber-style** or live-adjacent modes (see longer-term ideas in `PLANNING.md`).  
- **Smarter iteration** — Regenerate **one scene** without redoing the whole lesson; A/B compare two reads of the same line.  
- **Classroom fit** — Export formats (captions, slower pacing presets), **accessibility**, and maybe **LMS-friendly** embeds.  
- **Trust & safety** — Clearer handling of uploads, kid-facing content policies, and **cost transparency** per lesson.  
- **Polish** — Faster perceived latency (caching, optimistic UI), and **mobile-friendly** review on a tablet.

---

*This document is meant to evolve with the product—trim or expand sections for judges, investors, or open-source readers.*
