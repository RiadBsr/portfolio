# Storyboard — Camera Path Narrative

The portfolio is a single continuous camera journey through 3D space. The camera follows a **Blender-authored path** (exported as GLB) that the user traverses by scrolling. Every camera position, rotation, pause, and acceleration is modeled in Blender — giving precise cinematic control over the experience.

Scrolling moves the camera **backward** along the path (retreating from the head into the void), revealing scenes, titles, and narrative beats as the journey unfolds.

---

## Design Principles

1. **Narrative first.** This is not a project carousel. Each scene is a chapter in a story. Transitions, titles, and pacing matter as much as the 3D content.
2. **Camera path is the script.** The Blender curve dictates everything — position, rotation, speed feel. Code never overrides the path; it only samples it.
3. **Scroll budget is finite.** scrollT goes from 0 → 1. Every scene, title card, pause, and transition must fit within this budget. The scroll-to-frame map allocates scroll "real estate" deliberately.
4. **Pauses are powerful.** The camera can stop moving while scrolling continues — this drives text reveals, object animations, and dramatic beats without the world rushing past.
5. **Incremental delivery.** The path is extended scene-by-scene in Blender. Existing sections never change when new ones are added.

---

## Scroll Budget Overview

| scrollT Range | Frames | Camera Behavior | Content |
|---|---|---|---|
| 0.000 – 0.040 | 0 – 48 | Pull straight back from face | S-0: Head extreme close-up + annotations |
| 0.040 – 0.070 | 48 – 60 | **Pause** (camera holds position) | Title card: "RIAD BOUSSOURA" + subtitle |
| 0.070 – 0.100 | 60 – 90 | Slow drift back, slight turn | Intro text: what this portfolio is about |
| 0.100 – 0.140 | 90 – 132 | Accelerate into transition | Void transition — particles, head shrinks away |
| 0.140 – 0.200 | 132 – 168 | Arrive at S-1, decelerate | S-1: GoPro enters — hemispheres visible |
| 0.200 – 0.380 | 168 – 192 | **Near-pause** (very slow creep) | S-1: GoPro dwell — open, close, stitch animations |
| 0.380 – 0.420 | 192 – 228 | Accelerate away from GoPro | S-1 exit + transition |
| 0.420 – 0.460 | 228 – 240 | **Pause** | Chapter title: next scene intro text |
| 0.460 – 0.520 | 240 – 300 | Arrive at S-2 | S-2: Sorbonne enters |
| 0.520 – 0.580 | 300 – 324 | **Near-pause** | S-2: Sorbonne dwell |
| 0.580 – 0.620 | 324 – 360 | Transition | S-2 exit → S-3 approach |
| 0.620 – 0.700 | 360 – 420 | Arrive + dwell | S-3: BargMe / Hackathon |
| 0.700 – 0.780 | 420 – 480 | Arrive + dwell | S-4: Samsung |
| 0.780 – 0.860 | 480 – 540 | Arrive + dwell | S-5: Origin |
| 0.860 – 0.930 | 540 – 600 | Arrive + dwell | S-6: Art Gallery |
| 0.930 – 1.000 | 600 – 660 | Return toward head | S-7: Conversion — CTAs, final beat |

> **Note:** Frame numbers are approximate starting points. Exact values are authored in Blender and defined in `SCROLL_FRAME_MAP` in code. Adjust as scenes are built.

---

## Scene-by-Scene Narrative

### ACT 0 — THE FACE (scrollT 0.000 – 0.100)

**Camera:** Starts pressed against the face (extreme close-up, one eye fills viewport). Pulls **straight back** along the Z-axis — no spiral, no rotation. This is a slow, deliberate reveal.

**Frame 0–48 (scrollT 0.000–0.040): The Reveal**
- Camera is so close you can see individual wireframe triangles
- Annotations fade in with hologram effect: "TOPOLOGY", "DIGITAL SCULPT", "SKELETAL RIG"
- The wireframe overlay and flat shading establish the aesthetic: technical, precise, digital
- As the camera retreats, the full face becomes visible for the first time

**Frame 48–60 (scrollT 0.040–0.070): The Title**
- **Camera PAUSES.** Scrolling continues but the camera holds position
- Large text fades in on screen: **"RIAD BOUSSOURA"** — Bebas Neue, massive, positioned to the right of the head in 3D space (or as an HTML overlay)
- Below it: "R&D Engineer — Computer Vision & AI" in DM Sans
- Annotations have faded out by now
- The head continues to track the cursor/gyro — it's alive, watching
- This is the first impression moment. The visitor knows whose portfolio this is.

**Frame 60–90 (scrollT 0.070–0.100): The Context**
- Camera begins drifting back again, slowly, with a slight lateral turn
- Smaller text appears: a one-line mission statement or tagline
  - e.g., "Building at the intersection of 3D, vision, and deep learning"
  - or "From sculpting polygons to training neural networks"
- Text fades out as camera accelerates
- Particles become visible in the void around the head

**Frame 90–132 (scrollT 0.100–0.140): The Departure**
- Camera accelerates away from the head
- The head shrinks into the distance — a small wireframe figure in a field of particles
- This is a moment of awe: the scale shift from intimate close-up to vast empty space
- Silence. No text. Just the journey.

---

### ACT 1 — THE WORK (scrollT 0.140 – 0.860)

Each project scene follows a rhythm:
1. **Approach** — Camera moves toward the scene. A chapter title or context text may appear.
2. **Arrival** — Objects fade/scale in. Camera decelerates.
3. **Dwell** — Camera nearly stops. Scroll drives scene-specific animations (object transforms, text reveals, interactive moments).
4. **Departure** — Camera accelerates away. Objects recede and eventually dispose.

---

#### S-1: GoPro — Dual Fisheye Stitching (scrollT 0.140 – 0.420)

**Narrative beat:** "My first real deep learning project. I taught a neural network to see in 360°."

**Approach (0.140–0.200):**
- Camera arrives at the GoPro scene position
- The GoPro camera body fades in, centered
- Two hemispheres (FRNT/BACK) visible, separated, showing raw fisheye captures
- Chapter context text (optional): "360° STITCHING" as a subtle label

**Dwell (0.200–0.380):**
- Camera nearly paused — scroll drives the stitching animation:
  - Hemispheres open → close around the GoPro body
  - Stitch ring sweeps along the equator
  - BACK texture transitions from misaligned to aligned
- Text panel visible: headline, description, links
- This is the longest dwell — the animation has multiple stages and tells a complete story

**Departure (0.380–0.420):**
- Camera pulls away
- GoPro scene recedes, eventually disposes at ~0.55

---

#### S-2: Sorbonne — Research & Scholarship (scrollT 0.420 – 0.620)

**Narrative beat:** "Scholarship recipient at Sorbonne. Where I went from curious to rigorous."

**Title pause (0.420–0.460):**
- Camera pauses briefly
- Chapter title appears: "RESEARCH" or "SORBONNE" in large text
- Sets the tone for the academic scene

**Approach + Dwell (0.460–0.580):**
- Paper planes unfold, neural architecture diagram assembles
- Scholarship medallion rotates
- Academic aesthetic: cleaner, more structured than the GoPro's raw engineering

**Departure (0.580–0.620):**
- Camera moves on

---

#### S-3: BargMe — Startup Leadership (scrollT 0.620 – 0.660)

**Narrative beat:** "CTO at 22. Built a product, led a team, learned fast."

- Smartphone with barcode scanner UI
- Scanning beam animation
- Quick scene — the narrative emphasis is on leadership, not tech details

---

#### S-4: Hackathon — Google DevFest 1st Prize (scrollT 0.660 – 0.700)

**Narrative beat:** "Won first place. Fall detection for elderly care. 48 hours, zero sleep."

- Wireframe skeleton assembles, performs fall animation
- Trophy fragment burst on enter
- Robot vacuum rolls in
- High energy scene — fast assembly, dramatic entrance

---

#### S-5: Samsung — ADAS & Drowsiness Detection (scrollT 0.700 – 0.780)

**Narrative beat:** "Samsung Innovation Campus. Real-time drowsiness detection at the edge."

- Low-poly car drives in
- Face landmarks + EAR vectors on windshield
- Jetson Nano board floating nearby
- Technical but accessible — the car gives immediate context

---

#### S-6: Origin — The Beginning (scrollT 0.780 – 0.860)

**Narrative beat:** "It started with a PC and Blender. Still does."

- Gaming PC tower with glowing screen
- Orbiting Blender primitives (torus, icosahedron, cone)
- Emotional scene — warm glow, nostalgic
- This is the "why" moment: everything connects back to this origin

---

#### S-7: Art Gallery (scrollT 0.860 – 0.930)

**Narrative beat:** "I still make things for the joy of making them."

- Framed artworks arranged in an arc
- Hover to enlarge, click to navigate to /art
- Museum atmosphere with soft spotlights
- Palette cleanser before the final beat

---

### ACT 3 — THE RETURN (scrollT 0.930 – 1.000)

**Camera:** Begins turning back toward the head. The journey comes full circle.

**S-8: Conversion (scrollT 0.930–1.000):**
- Previous scenes visible as distant miniatures along the traversed path
- Camera drifts back toward the head (visible in the distance, still blinking, still watching)
- CTA tiles float into view:
  - **[CHAT WITH RIAD]** — primary, triggers chat mode
  - **[DOWNLOAD CV]** — links to PDF
  - **[VIEW GALLERY]** — links to /art
  - **[LINKEDIN / GITHUB]** — icon links
- Final text: "Paris. Available now."
- The head is the last thing you see, just as it was the first

---

## Text Overlay System

Text appears at specific scroll positions as HTML overlays (not 3D text). Each text element has:

| Property | Description |
|---|---|
| `scrollStart` | scrollT when fade-in begins |
| `scrollEnd` | scrollT when fade-out completes |
| `position` | Screen position (CSS) or 3D world position (drei Html) |
| `style` | Font family, size, color, animation |

**Large titles** (scene names, "RIAD BOUSSOURA"):
- Bebas Neue, 8-12vw, `--white` color, 80% opacity
- Fade in over 0.01 scrollT, hold, fade out over 0.01 scrollT
- Positioned in 3D space so they have parallax with the camera

**Body text** (descriptions, taglines):
- DM Sans, 1.2-1.6rem, `--accent` color, 60% opacity
- Appear 0.005 scrollT after their title
- Shorter hold duration

**Labels** (scene markers, annotations):
- Space Mono, 9px, `--wire` color
- Technical aesthetic, always uppercase

---

## Speed Control Philosophy

The scroll-to-frame map is the core creative tool. It controls pacing:

- **Fast camera + little scroll** = rushing through transitions (the "whoosh" between scenes)
- **Slow camera + lots of scroll** = dwelling on content (the user explores at their pace)
- **Zero camera + scroll** = pure animation driver (text reveals, object transforms)

Think of it like film editing:
- Wide establishing shots (fast camera, sweeping movement)
- Close-up dialogue scenes (camera holds, content plays out)
- Smash cuts (sudden acceleration between scenes)

The Blender curve controls the spatial path. The `SCROLL_FRAME_MAP` in code controls the temporal pacing. Together they create the full cinematic experience.

---

## Auto-Drift Behavior

On first load, after 3.5s of inactivity:
- Camera begins drifting backward at 0.5% scrollT/second
- This reveals the title card naturally without requiring scroll
- First user interaction takes over permanently
- The drift should feel like the camera is "breathing" — not mechanical

---

## Mobile Adaptations

- Touch events get 2x scroll multiplier (compensates for shorter swipe distances)
- Gyroscope replaces cursor for head tracking
- Large titles may need smaller font sizes (clamp with CSS)
- Some text overlays may be repositioned for portrait orientation
- Camera FOV increases on portrait screens for breathing room
