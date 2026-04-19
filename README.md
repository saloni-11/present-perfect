# PresentPerfect

A web app that analyzes video and audio recordings of presentations and gives scored, written feedback on delivery.

**People's Choice Award — UTS Tech Festival AI Showcase 2025**

---

## What it does

Upload a video (`.mp4`) or audio recording (`.mp3`, `.wav`) of yourself presenting. The app processes the file and returns **scores out of 100** and written coaching feedback across six dimensions:

| Dimension | What it measures |
|---|---|
| Facial expression | Whether your emotion matches what you're saying, per segment |
| Gaze | Where you're looking throughout (left, right, center, up, down) |
| Stage movement | How you use horizontal space in the frame |
| Shoulder posture | Whether your shoulders stay level |
| Hand gestures | Whether your hands are active or idle |
| Speech | Word choice, structure, pacing, filler word use |

**Audio-only uploads** get a subset: the app transcribes the recording, scores speech quality, rewrites the script to remove filler words and improve structure, and generates a text-to-speech version via AWS Polly.

---

## The problem it addresses

Most people improving their presentation skills either practice alone with no feedback, or pay for a speaking coach. This app gives automated, signal-based feedback specific enough to be actionable — it tells you *which seconds* you looked away, *when* your shoulders dropped, and whether your speaking pace was appropriate for audience comprehension.

---

## Tech stack

**Backend:** Python 3.10+, Flask, Flask-SocketIO (eventlet), OpenCV, MediaPipe (Pose, FaceMesh, FaceDetection), Ultralytics YOLO (custom-trained on AffectNet), OpenAI Whisper, GPT-4.1, AWS Polly, pydantic, python-dotenv

**Frontend:** React 19, Socket.IO client, recharts (radar/line/pie charts), react-dropzone, axios, html2canvas (report export)

---

## Architecture

```
┌─────────────┐     HTTP POST      ┌──────────────────────────────────┐
│   React UI  │ ─────────────────► │         Flask Backend            │
│             │ ◄── Socket.IO ──── │                                  │
│  - Upload   │    (progress %)    │  ┌────────────────────────────┐  │
│  - Report   │                    │  │   Whisper (background)     │  │
│  - Charts   │                    │  │   transcribes concurrently │  │
└─────────────┘                    │  └────────────────────────────┘  │
                                   │                                  │
                                   │  Producer thread → frame queue   │
                                   │       ↓                          │
                                   │  Consumer threads (batched):     │
                                   │   ┌─────────┬─────────┬───────┐  │
                                   │   │ Emotion │  Gaze   │ Pose  │  │
                                   │   │ (YOLO)  │(Mesh+   │(Media │  │
                                   │   │         │solvePnP)│ Pipe) │  │
                                   │   └─────────┴─────────┴───────┘  │
                                   │       ↓                          │
                                   │  Per-second aggregation          │
                                   │       ↓                          │
                                   │  GPT-4.1 → structured feedback   │
                                   └──────────────────────────────────┘
```

### Video path (`/api/analyze`)

1. Whisper starts transcribing in a background thread while frame analysis runs concurrently.
2. A producer thread reads frames and samples every 8th frame into a bounded queue.
3. Consumer threads pull batches and run **three detectors in parallel** per batch via `ThreadPoolExecutor`:
   - **Emotion** — MediaPipe FaceDetection crops the face → custom YOLO model classifies among 8 AffectNet emotion classes
   - **Gaze** — MediaPipe FaceMesh extracts 6 face landmarks → OpenCV `solvePnP` estimates head pose → yaw/pitch mapped to direction label
   - **Posture / movement / gesture** — MediaPipe Pose extracts body landmarks → shoulder angle, shoulder midpoint position, wrist-to-hip distance
4. Socket.IO emits progress events ~once per second.
5. Per-second signals are aggregated to their dominant value.
6. GPT-4.1 receives the full analytics timeline + timestamped transcript → returns a `PresentationFeedback` object with six integer scores and text explanations.

### Audio path (`/api/analyze-audio`)

1. Whisper transcribes the recording.
2. Speech metrics extracted (WPM, filler word ratio, pause analysis).
3. GPT-4o-mini analyzes for clarity, pace, confidence, engagement.
4. GPT-4o-mini rewrites the transcript (removes fillers, fixes structure, adds transitions).
5. AWS Polly synthesizes the rewritten script to MP3.
6. Frontend receives scores, both transcripts, and a playable URL.

### Report output

The frontend displays: scores as a radar chart, per-second gaze as a directional heatmap grid, shoulder and gesture breakdowns as pie charts, movement across time as a line chart, emotion mapped per transcript segment, and full written feedback. Exportable as PNG.

---

## How to run locally

### Prerequisites

- Python 3.10+
- Node.js 18+
- **GPU strongly recommended** — CUDA-capable for video processing. Falls back to CPU but significantly slower.
- OpenAI API key (required for feedback generation)
- AWS credentials with Polly access (required only for audio mode)

### Backend

```bash
cd webapi
pip install -r requirements.txt
```

Create `webapi/.env`:

```env
# Required
OPENAI_API_KEY=your_openai_key_here

# Path to trained emotion detection model weights
# Without this, the app falls back to a generic yolov8n.pt (auto-downloaded)
# which does NOT classify facial expressions — emotion scores won't work.
MODEL_PATH=path/to/affectnet_model.pt

# Optional: Azure OpenAI instead of OpenAI
USE_AZURE_OPENAI=false
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=

# Required for audio mode (AWS Polly TTS)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
```

```bash
python app.py
# Backend runs on http://localhost:4000
```

### Frontend

```bash
cd webapp
npm install
npm start
# Frontend runs on http://localhost:3000
```

> **Note:** The backend URL (`http://localhost:4000`) is hardcoded in `webapp/src/pages/UploadPage.js` — update if deploying elsewhere.

### Model weights

The trained `.pt` files are **not included** in this repository. The `models/` directory contains training metrics, performance curves, and confusion matrices, but not the weights. Contact the contributors to request the model files.

---

## Contributors

**Kavi Sathyamurthy** — Facial emotion detection model (trained/tuned YOLOv8 and YOLOv11 on AffectNet, hyperparameter search in `hyperparameters.json`). Flask backend and video processing pipeline (frame sampling queue, multi-threaded batch processing, Socket.IO progress). OpenAI GPT-4.1 integration for structured feedback generation.

**Saloni Samant** — Posture and pose tracking module (MediaPipe Pose: shoulder tilt, stage movement, hand gesture detection). AffectNet dataset sourcing and preparation. Integration testing across the full pipeline. Environment setup and `requirements.txt`. See detail below.

**Jonathan Sjamsudin** — Gaze tracking module (MediaPipe FaceMesh + OpenCV `solvePnP` head pose estimation → gaze direction classification). Stage movement tracking prototype. Facial recognition experimentation (YOLOv8/YOLOv11 notebooks).

**Aditya Maniar** — Audio enhancement pipeline (`enhanced_audio_processor.py`: speech transcription, GPT-4o-mini quality analysis and transcript rewriting, AWS Polly TTS).

---

<details>
<summary><strong>Saloni's contributions — detail</strong></summary>

<br>

The posture and pose tracking module uses MediaPipe Pose to extract body landmarks from each sampled video frame. Three separate signals are computed, all in the `movement_batch()` function in `webapi/app.py`:

**Shoulder tilt detection** — Calculates the angle between left and right shoulder landmarks using `atan2`. Frames where the angle exceeds 7° → "Shoulders Tilted"; below that → "Shoulders Straight." Prototype: `prototypes/posture_test1.py`.

**Hand gesture detection** — Measures the Euclidean distance between each wrist landmark and the midpoint of both hip landmarks. If either hand is >22% of the normalised frame width from the hip midpoint → "Gesturing"; otherwise → "Idle Hands."

**Horizontal stage movement** *(shared with Jonathan's prototype)* — Tracks the shoulder midpoint across the frame width, normalised to [0, 1], then binned into a 1–10 position scale. The LLM uses this per-second timeline to assess stage usage.

Together these three signals account for **three of the six scored output dimensions** (shoulder, hands, movement).

**AffectNet dataset sourcing** — The emotion model was trained on AffectNet (8 classes: Anger, Contempt, Disgust, Fear, Happy, Neutral, Sad, Surprise). Sourcing and preparing this dataset for the YOLO training format was part of this contribution. Dataset config: `models/data.yaml`; training artifacts in `models/`.

</details>

---

## Screenshots

_To be added._

---

## License

MIT License. See [LICENSE](LICENSE).