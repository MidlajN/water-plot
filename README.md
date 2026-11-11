# Plotter Studio

Plotter Studio is a web app for a pen plotter. You draw on a page (shapes, freehand
lines, illustrations and single-line text), and the app turns the page into G-code and
sends it to the plotter. It then shows the plot's progress and the machine's live
position, and lets you pause, resume, abort or jog the pen.

The plotter is a FluidNC motion board connected by USB to a Raspberry Pi. The Pi runs
a small **gateway** service that streams G-code to the board. Plotter Studio talks to
that gateway over your local network.

An **Auto mode** draws a clock face and a quote every minute and plots it automatically.

```
 Browser (desktop or phone)
     │  HTTP + Server-Sent Events (same origin, no CORS)
     ▼
 Plotter Studio (Next.js server)  ◄──── worker process (Auto mode scheduler)
     │  REST  http://<pi>:8080/api/*
     │  WebSocket  ws://<pi>:8080/ws
     ▼
 Pi gateway  ──USB serial, 115200 baud──►  FluidNC (ESP32)  ──►  steppers and pen
```

Only the Next.js server and the worker talk to the Pi. Browsers talk only to Plotter
Studio, so phones and laptops never need to reach the Pi directly.

---

## Requirements

- **Node.js 22 or newer.** The server uses Node's built-in `WebSocket` client to talk to
  the gateway, which first shipped in Node 22. Development used Node 24.
- **pnpm 11.** The version is pinned in `package.json`; `corepack enable` installs it.
- **A C/C++ toolchain**, only if no prebuilt `better-sqlite3` binary exists for your
  platform. On macOS that's the Xcode command line tools; on Debian or Raspberry Pi OS,
  install the `build-essential` and `python3` packages.
- **The plotter:** a Raspberry Pi running the gateway, with the FluidNC board on its
  USB port. For development without hardware, use the mock gateway
  (see [Developing without a plotter](#developing-without-a-plotter)).

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

   `pnpm-workspace.yaml` already allows the native build step for `better-sqlite3`.

2. Create your environment file and set the gateway address (see
   [Configuration](#configuration)):

   ```bash
   cp .env.example .env
   ```

3. Create the database, a SQLite file at `data/plotter.db`. The migration tool needs the
   folder to exist first:

   ```bash
   mkdir -p data
   ```

   ```bash
   pnpm db:migrate
   ```

4. Start the app:

   ```bash
   pnpm dev
   ```

   Open http://localhost:3000. To use it from a phone on the same network, open the
   "Network" address that `next dev` prints, e.g. `http://192.168.1.20:3000`.

5. For Auto mode, start the worker in a second terminal and leave it running:

   ```bash
   pnpm worker
   ```

   The worker runs the scheduler: once a minute, while Auto mode is on, it makes a
   plot and sends it to the plotter. Run only one worker at a time.

## Configuration

Settings live in `.env`. The worker reads only `.env`; Next.js reads `.env` and
`.env.local`, so keep the gateway settings in `.env` where both see them.

| Variable | Default | What it does |
| --- | --- | --- |
| `GATEWAY_URL` | none | Base URL of the Pi gateway, e.g. `http://plotter-pi.local:8080` or `http://192.168.1.50:8080`. REST calls go to `<url>/api/*` and telemetry to `<url>/ws`. If it isn't set, the app shows the plotter as offline. |
| `DATABASE_PATH` | `data/plotter.db` | SQLite database file, relative to the project folder. |
| `PLOTTER_QUADRANT` | svg-to-gcode default | Which quadrant of the machine's coordinate system drawings are placed in (1–4). |
| `PLOTTER_X_OFFSET` | `0` | Shifts drawings along X, in mm. |
| `PLOTTER_Y_OFFSET` | `0` | Shifts drawings along Y, in mm. |
| `PLOTTER_PARK_X`, `PLOTTER_PARK_Y` | `0`, `0` | Where the pen goes after every plot, in mm, in the same coordinates as the drawing. The pen lifts to travel height first. |
| `PLOTTER_PARK` | on | `false` leaves the pen over the last stroke instead of parking. |
| `PLOTTER_MIRROR` | off | `true` flips every plot left–right across the 690 mm page, for drawing on the back of glass that is read from the other side. It covers Plot, Auto plots and uploaded `.gcode` files. Download G-code stays unmirrored, so a downloaded file is mirrored once when it's plotted. The park position isn't mirrored. |
| `PLOTTER_BRIDGE_MM` | `1` | Pen-path optimiser: gaps up to this many mm are drawn with the pen down instead of lifting. `0` adds no ink at all. |
| `PLOTTER_OPTIMIZE` | on | `false` turns the pen-path optimiser off and keeps svg-to-gcode's own stroke order. |
| `AI_PROVIDER` | `gemini` | Which AI service AI Creative Studio uses: `gemini` or `groq`. Only the chosen provider's settings are needed. |
| `GEMINI_API_KEY` | none | Google Gemini API key, from Google AI Studio. Server-side only. Needed when `AI_PROVIDER=gemini`. |
| `GEMINI_MODEL` | `gemini-3.8-flash,gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite` | Gemini model, or a comma-separated list tried in order: when one is busy (503), out of requests (429), not served (404) or slow (no answer in 45 s) the next answers. The default list is stable free-tier Flash and Flash-Lite models with separate quotas, about 20 requests a day each on the Free Tier. Not usable: Pro and Argon (no free quota), `gemini-3.5-flash` (shares 3.6's quota) and preview models (not served by the SDK's stable API). |
| `GROQ_API_KEY` | none | Groq API key (`gsk_…`). Server-side only. Needed only when `AI_PROVIDER=groq`. |
| `GROQ_BASE_URL` | none | Groq's OpenAI-compatible endpoint, `https://api.groq.com/openai/v1`. Only for `AI_PROVIDER=groq`. |
| `GROQ_MODEL` | none | Groq model for designs (only for `AI_PROVIDER=groq`). It needs strict structured output, and Groq's built-in `browser_search` tool if web search is on. `openai/gpt-oss-120b` (or `openai/gpt-oss-20b`) supports both. |
| `AI_MAX_OUTPUT_TOKENS` | none | Token limit for a design response, thinking included. Gemini 3 Flash can spend 4,000–7,000 tokens thinking before it draws, so use `16000`. |
| `AI_ENABLE_WEB_SEARCH` | `false` | `true` lets prompts that need real-world or current facts run a web research step first. Keep it `false` on the Gemini Free Tier, which doesn't include Google Search. |
| `POLLINATIONS_API_KEY` | none | Turns on the FLUX image engine. A secret `sk_` key from Pollinations; server-side only. |
| `POLLINATIONS_IMAGE_MODEL` | `flux` | Pollinations image model. |
| `OPENAI_API_KEY` | none | Turns on the OpenAI image engine. Server-side only. Billed per token. |
| `OPENAI_IMAGE_MODEL` | `gpt-image-2.6-flare` | OpenAI image model (a gpt-image model; DALL·E is retired). |
| `OPENAI_IMAGE_QUALITY` | `low` | `low`, `medium`, `high`, `xhigh`, `max` or `auto`. Higher costs more. |
| `OPENAI_IMAGE_COMPLEXITY` | `low` | `low`, `medium` or `high` (simpler pictures trace better), or `none` to leave it out. |
| `AI_SVG_WIDTH_MM`, `AI_SVG_HEIGHT_MM` | none | Working area generated designs are fitted to, in mm (`690` × `290`). |

`next dev` reloads `.env` when it changes. The worker doesn't, so restart `pnpm worker`
after editing `.env`.

---

## Connecting to the plotter

### 1. Bring up the Pi gateway

On the Raspberry Pi:

1. Connect the FluidNC board by USB. It usually appears as `/dev/ttyUSB0`.
2. Start the gateway service. It must listen on port 8080 and hold the serial port
   exclusively. Close any other serial monitor or sender first.
3. Give the Pi a fixed address on your network (a DHCP reservation on the router is
   easiest), so `GATEWAY_URL` keeps working after a reboot.

The gateway isn't part of this repository. It follows the gateway spec
(`NEXTJS_GATEWAY_STREAMING_PLAN.md`); the parts Plotter Studio relies on are listed in
[What the gateway must provide](#what-the-gateway-must-provide).

### 2. Check that the computer running Plotter Studio can reach it

From the machine that runs `pnpm dev` (or `pnpm start`) and the worker:

```bash
curl http://plotter-pi.local:8080/api/status
```

You should get JSON like `{"state":"Idle","mpos":[0,0,-0.5],"job":null}`.

If the name doesn't resolve, use the Pi's IP address instead. `.local` names rely on
mDNS, which some networks and operating systems block.

### 3. Point the app at the gateway

In `.env`:

```bash
GATEWAY_URL=http://plotter-pi.local:8080
```

Then restart the worker if it's running. Check the connection through the app:

```bash
curl http://localhost:3000/api/plotter/status
```

`"connected":true` means the app can reach the gateway. The app also shows the
connection:
- **Desktop:** the chip at the top of the sidebar reads **Connected**, and the Machine
  section shows the live X/Y/Z position.
- **Phone:** the line under the Send button reads **Idle** with a green dot.

When the gateway drops, the app reconnects on its own. It retries with an increasing
delay, up to 10 seconds between attempts.

### 4. Make a first test

1. **Jog.** In the desktop sidebar, choose a 1 mm step and press each arrow once. The
   readout should change by 1 mm per press, and the pen should move the way the arrow
   points. Z up and Z down move the pen; Z jogs always run at no more than F1000.
2. **Check placement.** Draw a small rectangle near one corner of the page and plot it.
   If it lands somewhere other than expected, or the machine refuses moves outside its
   travel, set `PLOTTER_QUADRANT`, `PLOTTER_X_OFFSET` and `PLOTTER_Y_OFFSET` to match
   your machine's origin. Restart the worker, then plot again. Check this before plotting
   anything large. With `PLOTTER_MIRROR=true`, a rectangle near the page's left edge
   plots near the right edge.
3. **Check the pen heights.** While the rectangle plots, check that the pen touches the
   paper when drawing and clears it when travelling (see [Pen safety](#pen-safety)).

### Pen safety

All G-code from the app passes through the same safety step,
`applyPenSafety` in `src/features/plotter/profile.ts`. That includes Plot, Download
G-code, Auto plots and uploaded `.gcode` files. The step:

- puts the pen at **Z −4.5 mm to draw** and **Z −0.5 mm to travel**;
- turns every Z move into a `G1` move at **no more than F1000** (a `G0` rapid move would
  ignore any feed limit), and restores the drawing feed afterwards;
- replaces `M400`, which FluidNC doesn't support, with `G4 P0.05`;
- removes comments and blank lines.

The gateway enforces the Z feed limit as well. To change the heights or the drawing
speed, edit `PLOTTER_PROFILE` in `src/features/plotter/profile.ts`.

### Pen path

G-code made from a drawing (Plot, Download G-code, Auto plots, AI designs) is reordered
before the safety step by `src/features/export/pathOptimizer.ts`, which works on the
converted strokes in mm. Strokes can be drawn in either direction, closed shapes can start
at any point, and the order starts from the park position (nearest neighbour, then 2-opt),
so the pen spends less time travelling. Gaps up to `PLOTTER_BRIDGE_MM` (default 1 mm) are
drawn with the pen down instead of lifting. Every drawn line is kept. Uploaded `.gcode`
files are left in their own order.

### What the gateway must provide

**REST** (JSON bodies, port 8080):

| Method and path | Body | Response |
| --- | --- | --- |
| `POST /api/jobs/upload` | `{ "name": string, "gcode": string }` | `{ "job_id", "lines_count", "status" }` |
| `POST /api/jobs/start` | `{ "job_id": string }` | `{ "status": "streaming" }` |
| `POST /api/control/hold` | `{}` | `{ "status": "held" }`, sends `!` |
| `POST /api/control/resume` | `{}` | `{ "status": "running" }`, sends `~` |
| `POST /api/control/abort` | `{}` | `{ "status": "aborted" }`, sends Ctrl-X |
| `POST /api/control/jog` | `{ "x"?, "y"?, "z"?, "feed" }` | `{ "status": "jogging" }`, sends `$J=G91 G21 …` |
| `POST /api/control/unlock` | `{}` | `{ "status": "unlocked" }`, sends `$X` |
| `POST /api/control/home` | `{}` | `{ "status": "homing" }`, starts `$H` (telemetry shows `Home` while it runs) |
| `GET /api/status` | none | `{ "state", "mpos": [x, y, z], "job" }` |

Errors should come back with an HTTP error status and a JSON `{ "error": "…" }`. A reply
of `{ "success": false, "message": "…" }` counts as an error too, whatever its status. The
app shows that message to the user.

**WebSocket** `ws://<pi>:8080/ws`: JSON messages shaped `{ "type": …, "data": … }`.

- `telemetry`, every 200 ms: `{ state, mpos, feed, buffer_free }`. The app treats 3
  seconds without any message as a lost connection and reconnects.
- `job_progress`, on each acknowledged line: `{ job_id, current_line, total_lines, percent, active_command, elapsed_seconds, estimated_remaining_seconds }`.
- `job_complete`: `{ job_id, status, duration_seconds }`. `"success"` counts as done;
  any other status (for example `"aborted"` or `"failed"`) counts as not done.

The spec leaves two details open, so confirm them with whoever builds the gateway:
- the `job_complete` status sent for aborts and errors;
- the exact shape of `job` in `/api/status`. The app reads `job_id`, `status`,
  `current_line` and `total_lines` when they're present, and treats statuses `queued`,
  `streaming`, `running` and `held` as busy.

### Developing without a plotter

`scripts/mock-gateway.mjs` implements the gateway's REST and WebSocket interface without
hardware. It simulates streaming, moves the reported position, and supports hold,
resume, abort and jog.

```bash
pnpm gateway:mock
```

With `GATEWAY_URL=http://localhost:8080` in `.env`, the app behaves as if a plotter were
connected. Options:

```bash
LINES_PER_SECOND=200 PORT=8081 pnpm gateway:mock
```

The mock also checks each uploaded job against the pen safety rules and prints any line
that breaks them, which is a handy check of the app's G-code.

---

## Using the app

### Desktop

The sidebar on the left holds the controls. The viewer on the right shows the page, or
the Auto mode preview.

- **Appearance.** Light and dark follow your system setting. The button next to the
  connection status (and *Appearance* in the phone's ⋯ menu) picks Light, Dark or Match
  system for this browser. The paper stays paper in both: plots and exports are
  unchanged.

- **Mode tabs.** Choosing **Auto** turns the scheduler on; choosing **Edit** or **AI**
  turns it off. The app opens in Auto when the scheduler is already on.
- **Plot.**
  - *Plot this page* sends the drawing to the plotter.
  - *Plot a G-code file…* sends a file from your computer.
  - *Download SVG* and *Download G-code* save the page instead.
- **Current plot.** Progress, lines done, time left, Pause/Resume and Abort. Abort asks
  for a second click.
- **Machine.** Live position and feed, and a jog pad with step sizes of 0.1, 1 and 10 mm.
  Jogging is off while a plot runs. **Home** runs the homing cycle (`$H`); **Unlock**
  clears an alarm (`$X`). Both work during an alarm, when jogging doesn't. The phone
  has them under the joystick.
- **Activity.** Recent events since the page opened.
- **Auto mode.** The time zone used for the clock, and the recent plots with their
  status. Click one to preview it; *Plot again* sends it to the plotter.

The tool rail on the canvas has Select, Pen, Elements (shapes and illustrations) and
Text. Text uses single-line plotter fonts; the Script font joins each word into one
stroke, so the pen lifts less often.

### Phone

The page takes the top half of the screen. The card at the bottom has the tools,
elements, text input, mode tabs, and a **Send** button that plots the page. The ⋯ menu
has export, undo/redo, delete and the appearance choice. While a plot
runs, the card shows its progress and Pause/Abort. The joystick moves the selected
object; double-tap it to send the object to one of 9 spots on the page.

### Design system

The interface is built from one set of tokens and components:

- **Tokens** live in `src/app/globals.css`: semantic colours (surfaces, text, lines,
  accent, status) for light and dark, the type scale, radii, shadows and easing.
- **Components** live in `src/components/ui/`: button, segmented control, chip,
  fields, section and card, status pill, progress, menu, tooltip, popover and the
  paper-on-desk motif.
- **Preview:** in development, `/design` shows every token and component in both themes.
- **Agent skills:** the design skills in `.claude/skills/` are reference markdown only;
  no hooks or scripts are installed. They are Impeccable, Apple HIG (`hig-*`), and Emil
  Kowalski's design-engineering and animation skills (`emil-design-eng`, `animate`,
  `review-animations`, `improve-animations`, `gestures`, `apple-design` and more; MIT).

### Auto mode

With Auto selected and `pnpm worker` running, each minute the worker:

1. draws the clock and a random quote (in the Script font) to `data/plots/job-<id>.svg`;
2. converts it to G-code with the pen safety rules;
3. uploads it to the gateway and starts it, unless the plotter is busy or unreachable.
   In that case the job is marked **Skipped**, since a clock plot is out of date a
   minute later;
4. marks the job **Plotted** or **Failed** when the gateway reports the job finished.

Only the newest 100 Auto jobs are kept. After each minute the worker deletes older
jobs and their SVG files, so the database and `data/plots` stay small. Plots you send
yourself from Edit mode aren't recorded here. If the worker stops between creating a
job and sending it, the job is marked **Skipped** the next time the worker starts.

---

## AI Creative Studio

AI mode turns a short description ("a minimal line-art flower", "a two-line poem about
the sea") into a plotter-ready design using Google Gemini's free-tier Flash models
(`gemini-3.8-flash` first, falling back through other free Flash models when one is
busy or out of requests). Set `AI_PROVIDER=groq` to use Groq instead; everything below works the same
with either.

- **Server-side only.** `POST /api/ai/design` calls the provider; the key never reaches
  the browser. Gemini requests are sent with `store: false`, so Google doesn't keep
  them in its interaction history.
- **Structured output.** The model must answer in a JSON Schema (title, category, text
  lines, illustration SVG and boxes in mm). The answer is checked again with Zod.
  Groq models without strict mode fall back to JSON mode, with the same checks.
- **Plotter-safe SVG.** Every illustration is parsed and rebuilt from an allowlist:
  `path`, `line`, `polyline`, `polygon`, `circle`, `ellipse`, `rect` and `g`, with
  numeric geometry only. Scripts, links, images, CSS and foreign content are
  rejected. The drawing is fitted inside the working area with a 10 mm margin, as
  black strokes with no fill. Poems and quotes come back as text lines, which the app
  letters with its own single-line fonts.
- **Web search.** Only prompts that need real-world or current facts ("inspired by
  the Eiffel Tower", "an accurate map of…") run a research step first: Google Search
  grounding with Gemini, or the built-in `browser_search` tool with Groq. The research
  runs as its own call, and its notes and sources feed the design call. Ordinary
  creative prompts never search. If search is on but the model doesn't support it,
  the API returns an error. Google Search grounding has its own quota, and the Gemini
  Free Tier has none: then the design runs without research (no sources) and the
  server logs a warning.

### Image engines: FLUX and OpenAI

Besides the language model's own SVG ("Vector AI"), AI Studio can draw with an image
model and trace the picture into pen strokes. Each engine appears in the composer's
engine picker once its key is set; with no image keys the picker stays hidden.

- **FLUX** through Pollinations (`POLLINATIONS_API_KEY`, a secret `sk_` key;
  Pollinations refuses `pk_` keys for API calls). Spends Pollen credits.
- **OpenAI** gpt-image (`OPENAI_API_KEY`, default model `gpt-image-2.6-flare`). Billed
  per token, so keep `OPENAI_IMAGE_QUALITY=low` unless you need more. DALL·E 3 was
  retired from the API in May 2026 and can't be used.
- **Line art only.** Picking an image engine selects Line art; poems and combinations
  stay with Vector AI. Regenerate makes a new picture; Refine draws the idea again with
  the change added to the prompt. There's no silent fallback to Vector AI.
- **How it's traced.** The idea goes into a fixed line-art prompt (a minimalist ink
  drawing, isolated on white). It only describes what to draw: image models tend to
  draw whatever a prompt names, even after "no". The 1024 px image is traced along the
  middle of each line, so every drawn line becomes one pen stroke rather than an outline
  around both edges: a threshold set a little towards paper from Otsu's (so fine lines
  like whiskers survive), speck and pinhole clean-up, Zhang–Suen
  thinning, a skeleton graph with short spurs pruned and lines joined straight through
  junctions, then smoothing, Douglas–Peucker simplification and Bézier curves. Small
  separate marks (windows, pupils) are kept, and dots become tiny circles. The result goes through the same SVG
  sanitizer as every other design, simplified harder if it would be too large.
- **Keys stay on the server**, sent only in `Authorization` headers.
  `GET /api/ai/engines` tells the browser which engines exist, never their settings.

## App API

The browser uses these routes. You can also call them from scripts.

| Route | What it does |
| --- | --- |
| `GET /api/plotter/status` | `{ connected, state, mpos, job }`, or `{ connected: false, error }` |
| `GET /api/plotter/events` | Server-Sent Events: `snapshot`, then `telemetry`, `job_progress`, `job_complete` and `link` (`{ connected }`) |
| `POST /api/plotter/jobs?start=1&name=…` | Plots an SVG (`Content-Type: image/svg+xml`) or G-code (`text/plain`). Returns 409 if the plotter is busy. |
| `POST /api/plotter/jobs/start` | `{ jobId }`: starts an uploaded job |
| `POST /api/plotter/control/hold`, `/resume`, `/abort`, `/unlock`, `/home` | Machine control (`/unlock` sends `$X`, `/home` starts `$H`) |
| `POST /api/plotter/control/jog` | `{ x?, y?, z?, feed }` in mm. Any jog that moves Z is held to F1000. |
| `GET /api/auto` and `PUT /api/auto` | Auto mode settings: `{ enabled, timezone }` |
| `GET /api/auto/jobs?limit=20` | Recent Auto mode plots |
| `GET /api/auto/jobs/:id/svg` | A plot's SVG |
| `GET /api/ai/engines` | `{ engines: [{ id, label }] }`: Vector AI plus each image engine with a key set |
| `POST /api/export/svg`, `POST /api/export/gcode` | Returns the posted SVG unchanged, or converted to G-code |
| `POST /api/ai/design` | AI Creative Studio. `{ mode: "generate" \| "refine", prompt, category?, engine?, refinement?, previous? }` (`engine`: `vector` default, `flux` or `openai`) returns a validated design (sanitized 690 × 290 mm SVG and/or text lines for the single-line fonts), a clarification question, or an error |

Example: plot an SVG file from the command line.

```bash
curl -X POST -H 'Content-Type: image/svg+xml' --data-binary @drawing.svg \
  'http://localhost:3000/api/plotter/jobs?start=1&name=drawing'
```

---

## Running it permanently

### On the Raspberry Pi (recommended)

Plotter Studio and the gateway can share one Pi. The app reaches the gateway over
`127.0.0.1`, so the plotter link no longer depends on Wi-Fi; only phones and laptops
use the network.

```
Phone/laptop ──Wi-Fi──▶ Pi :3000  Plotter Studio (web app + Auto worker)
                                     │ 127.0.0.1:8080
                                     ▼
                                   gateway ──USB──▶ plotter
```

**You need:** a Pi 4 or 5 with 2 GB of RAM or more, 64-bit Raspberry Pi OS, Node.js 22
or newer on the Pi, and internet access for AI mode.

**1. Build the bundle.** On your computer (or on the Pi itself, which is slower):

```bash
pnpm build:pi
```

This makes `dist/plotter-studio-pi/`, about 60 MB: the Next.js standalone server, the
bundled Auto worker, the database migrations, the systemd services and `install.sh`.
No `node_modules` install is needed on the Pi. The database driver's 64-bit Linux
binary is included; on 32-bit Raspberry Pi OS the installer builds it on the Pi
(this needs `sudo apt install build-essential python3`).

**2. Copy it to the Pi** (replace `pi@plotter-pi.local` with your user and host):

```bash
rsync -a --delete dist/plotter-studio-pi/ pi@plotter-pi.local:plotter-studio-pi/
```

**3. Install it** on the Pi:

```bash
cd ~/plotter-studio-pi && sudo ./install.sh
```

The installer copies the app to `/opt/plotter-studio` and adds two services that start
on boot and restart after a crash:

- `plotter-studio-web`, the web app on port 3000. It applies database migrations
  before each start.
- `plotter-studio-worker`, the Auto mode worker.

The first install creates `/opt/plotter-studio/.env` from the example and stops so you
can fill it in. Set at least these:

```bash
GATEWAY_URL=http://127.0.0.1:8080
GEMINI_API_KEY=…
```

Then start the services:

```bash
sudo systemctl start plotter-studio-web plotter-studio-worker
```

Open `http://<pi-name>.local:3000` from a phone or laptop.

**Updating:** build and copy a new bundle, then run `sudo ./install.sh` again. The
installer keeps `.env` and the `data/` folder (plot history, Auto settings and
generated plots).

**Options:** `sudo APP_DIR=/srv/plotter ./install.sh` installs somewhere else, and
`sudo PLOTTER_USER=name ./install.sh` picks the user the services run as. By default
that is the user who ran `sudo`.

**Logs and control:**

```bash
journalctl -u plotter-studio-web -u plotter-studio-worker -f
```

```bash
sudo systemctl restart plotter-studio-web plotter-studio-worker
```

**Lock down the gateway.** The app sends commands to the gateway without credentials,
so anything that can reach port 8080 can move the plotter. When both run on one Pi,
make the gateway listen on `127.0.0.1` only. Browsers then reach the plotter only
through Plotter Studio, which checks what it sends. The gateway runs as its own
service, set up with the gateway's own instructions; Plotter Studio reconnects on its
own if the gateway starts later or restarts.

**Back up** `/opt/plotter-studio/data/plotter.db` now and then. SD cards wear out.

### On another computer

Build and start the app:

```bash
pnpm build
```

```bash
pnpm start
```

`pnpm start` prints a warning suggesting `node .next/standalone/server.js`, because the
build also makes the standalone server for the Pi. It works as before and can be
ignored.

Run `pnpm worker` alongside it, under a process manager such as systemd or pm2, so it
restarts after a crash or reboot. Run both from the project folder: the database and
`data/plots` paths are relative to it.

## Troubleshooting

- **"Plotter offline" in the app.** Run `curl $GATEWAY_URL/api/status` from the machine
  running the app. If that fails, the problem is the network or the gateway, not the
  app. Check the Pi's address, that the gateway is running, and that nothing else holds
  the serial port.
- **"Plotter not configured: set GATEWAY_URL."** Add `GATEWAY_URL` to `.env`.
- **"The plotter is busy."** A job is running or the machine isn't Idle (for example
  On hold or Alarm). Wait for it to finish, or resume or abort it.
- **Auto plots are all "Skipped".** The worker couldn't reach the gateway, or the
  plotter was busy at that minute. The job's error text says which. Check that
  `GATEWAY_URL` is in `.env` (not only `.env.local`), and restart the worker after
  changing it.
- **The drawing lands in the wrong place.** Set `PLOTTER_QUADRANT` and the offsets
  (see [Make a first test](#4-make-a-first-test)).
- **`pnpm db:migrate` exits without a clear error.** With SQLite, each statement in a
  migration must be separated by a `--> statement-breakpoint` line. If a hand-edited
  migration puts two statements in one chunk, drizzle-kit fails silently.
- **`better-sqlite3` fails to install.** Install the C/C++ toolchain listed in
  [Requirements](#requirements), then run `pnpm install` again.
- **"Another next dev server is already running."** Use the address it prints, or stop
  the process it names.

## Project layout

```
src/app/api/            API routes (plotter proxy, export, auto, illustrations)
src/features/plotter/   Gateway client and connection, pen safety profile, live state
src/features/desktop/   Desktop sidebar
src/features/mobile/    Phone layout (bottom card, joystick, text input)
src/features/workspace/ Canvas editor and single-line text
src/features/auto/      Auto mode settings and job history
src/features/ai/        AI Studio: providers, image engines (images/), centerline tracer (trace/), SVG sanitizer
src/lib/db/             SQLite schema and connection (Drizzle)
worker/                 Auto mode scheduler and plot sender
scripts/                Mock gateway, font build tools, Pi bundle build, migrations
deploy/pi/              systemd services and install.sh for the Raspberry Pi
drizzle/                Database migrations
```

## Fonts

The single-line fonts in `src/features/workspace/text/fonts/data/` are generated from
the Hershey fonts. To rebuild them:

```bash
npm pack hersheytext && tar xzf hersheytext-*.tgz
```

```bash
node scripts/build-single-line-fonts.mjs package/svg_fonts HersheySans1 HersheySansMed HersheySerifMed HersheyScript1
```

See `src/features/workspace/text/fonts/LICENSE.md` for the Hershey font license.
