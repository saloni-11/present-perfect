# PresentPerfect

A web app that analyzes video and audio recordings of presentations and gives scored, written feedback on delivery.

---

## What it does

Upload a video (`.mp4`) or audio recording (`.mp3`, `.wav`) of yourself presenting. The app processes the file and returns scores out of 100 and written coaching feedback across six dimensions:

- **Facial expression** — whether your emotion during each spoken segment matches what you're saying
- **Gaze** — where you're looking throughout the recording (left, right, center, up, down, and combinations)
- **Stage movement** — how you use horizontal space in the frame
- **Shoulder posture** — whether your shoulders stay level
- **Hand gestures** — whether your hands are active or idle
- **Speech** — word choice, structure, pacing, and filler word use

For video uploads, all six signals are extracted and scored. For audio-only uploads, the app transcribes the recording, scores speech quality, rewrites the script to remove filler words and improve structure, and generates a text-to-speech version of the improved script using AWS Polly.

---

## The problem it addresses

Most people improving their presentation skills either practice alone with no feedback, or pay for a speaking coach. This app gives automated, signal-based feedback specific enough to be actionable — it tells you which seconds you looked away, when your shoulders dropped, and whether your speaking pace was appropriate for audience comprehension.

---

## Contributors

**Kavi Sathyamurthy** — facial emotion detection model (trained and tuned YOLOv8 and YOLOv11 on AffectNet across multiple runs, hyperparameter search documented in `hyperparameters.json`); Flask backend and video processing pipeline (frame sampling queue, multi-threaded batch processing, Socket.IO real-time progress updates); OpenAI GPT-4.1 integration for structured feedback generation

**Saloni Samant** — posture and pose tracking module (MediaPipe Pose: shoulder tilt detection, horizontal stage movement tracking, hand gesture detection — see detail below); AffectNet dataset sourcing and preparation for the emotion model; integration testing across the full pipeline; environment setup and `requirements.txt`

**Jonathan Sjamsudin** — gaze tracking module (MediaPipe FaceMesh landmark extraction + OpenCV `solvePnP` head pose estimation → yaw/pitch → gaze direction classification); stage movement tracking prototype; facial recognition experimentation (YOLOv8 and YOLOv11 notebooks)

**Aditya Maniar** — audio enhancement pipeline (`enhanced_audio_processor.py`: speech transcription, GPT-4o-mini quality analysis and transcript rewriting, AWS Polly text-to-speech generation)

### Saloni's contributions in detail

The posture and pose tracking module uses MediaPipe Pose to extract body landmarks from each sampled video frame. Three separate signals are computed, all consolidated in the `movement_batch()` function in `webapi/app.py`:

**1. Shoulder tilt detection**
Calculates the angle between the left and right shoulder landmarks in the image plane using `atan2`. Frames where this angle exceeds 7° are classified as "Shoulders Tilted"; below that threshold they are "Shoulders Straight." This feeds the shoulder posture score. Prototype: `Salmons workspace/posture_test1.py`.

**2. Hand gesture detection**
Measures the Euclidean distance between each wrist landmark and the midpoint of both hip landmarks. If either hand is more than 22% of the normalised frame width away from the hip midpoint, the frame is marked "Gesturing"; otherwise "Idle Hands." This feeds the hands/gesture score.

**3. Horizontal stage movement** *(shared with Jonathan's movement tracker prototype)*
Tracks the midpoint of both shoulders across the frame width, normalised to [0, 1], then binned into a 1–10 position scale (1 = far left, 10 = far right). The LLM uses this per-second timeline to assess whether the presenter holds position, drifts to one side, or actively uses stage space.

Together these three signals account for three of the six scored output dimensions (shoulder, hands, movement). The shoulder tilt and gesture detection originated in `posture_test1.py`; the production integration is the `movement_batch()` function in `webapi/app.py`.

**AffectNet dataset sourcing**
The emotion detection model was trained on AffectNet, a large-scale facial expression dataset covering 8 classes: Anger, Contempt, Disgust, Fear, Happy, Neutral, Sad, Surprise. Sourcing and preparing this dataset for the YOLO training format was part of this contribution. Dataset configuration is in `Kavi's Workspace/data.yaml`; training artifacts and performance curves are in `models/`.

---

## Tech stack

**Backend**
| | |
|---|---|
| Runtime | Python 3.10+ |
| Server | Flask, Flask-SocketIO (eventlet) |
| Video processing | OpenCV |
| Body tracking | MediaPipe (Pose, FaceMesh, FaceDetection) |
| Emotion detection | Ultralytics YOLO (custom-trained on AffectNet) |
| Speech transcription | OpenAI Whisper (turbo model) |
| Feedback generation | OpenAI GPT-4.1 (Azure OpenAI also supported) |
| Audio synthesis | AWS Polly |
| Config | python-dotenv |
| Output schema | pydantic |

**Frontend**
| | |
|---|---|
| Framework | React 19 (Create React App) |
| Real-time updates | Socket.IO client |
| Charts | recharts (radar, line, pie) |
| File upload | react-dropzone |
| HTTP | axios |
| Report export | html2canvas |

---

## How it works

1. User drops a file onto the upload page. The frontend sends it to the Flask backend via HTTP POST and connects via Socket.IO for live progress updates.

2. **Video path (`/api/analyze`)**
   - Whisper starts transcribing in a background thread immediately while frame analysis runs concurrently.
   - A producer thread reads frames and samples every 8th frame into a bounded queue.
   - Consumer threads pull batches from the queue and run three detectors in parallel per batch (via `ThreadPoolExecutor`):
     - *Emotion*: MediaPipe FaceDetection crops the face region → custom YOLO model classifies among 8 AffectNet emotion classes
     - *Gaze*: MediaPipe FaceMesh extracts 6 face landmarks → OpenCV `solvePnP` estimates head pose → yaw and pitch angles mapped to a direction label (straight, left, right, up, down, and diagonals)
     - *Posture / movement / gesture*: MediaPipe Pose extracts body landmarks → shoulder angle (tilt), shoulder midpoint X position (movement), wrist-to-hip distance (gesture)
   - Socket.IO emits progress events roughly once per second during processing.
   - After all frames are processed, per-second signals are aggregated to their dominant value for that second.
   - The Whisper transcript is retrieved (was running concurrently).
   - GPT-4.1 receives the full per-second analytics timeline and the timestamped transcript, and returns a structured `PresentationFeedback` object: six integer scores (1–100) and a text explanation for each.

3. **Audio path (`/api/analyze-audio`)**
   - Whisper transcribes the recording.
   - Speech metrics are extracted (speaking rate in WPM, filler word ratio, pause analysis).
   - GPT-4o-mini analyzes the transcript for clarity, pace, confidence, and engagement.
   - GPT-4o-mini rewrites the transcript: removes filler words, fixes sentence structure, adds transitions.
   - AWS Polly synthesizes the rewritten script to an MP3 file.
   - The frontend receives scores, both transcripts, and a playable URL for the enhanced audio.

4. The frontend navigates to the report page, which displays: scores as a radar chart, per-second gaze direction as a directional heatmap grid, shoulder and gesture breakdowns as pie charts, movement across time as a line chart, emotion mapped per transcript segment, and the full written feedback. The report can be exported as a PNG.

---

## How to run locally

### Prerequisites

- Python 3.10+
- Node.js 18+
- A CUDA-capable GPU is strongly recommended. The app falls back to CPU automatically, but video processing is significantly slower without GPU acceleration.
- An OpenAI API key — required for feedback generation
- AWS credentials with Polly access — required only for audio mode

### Backend setup

```bash
cd webapi
pip install -r requirements.txt
pip install boto3  # required for audio mode; not yet in requirements.txt
```

Create `webapi/.env`:

```env
# Required
OPENAI_API_KEY=your_openai_key_here

# Path to trained emotion detection model weights
# Without this, the app falls back to a generic yolov8n.pt (auto-downloaded by Ultralytics)
# which does not classify facial expressions — emotion scores will not work correctly.
MODEL_PATH=path/to/affectnet_model.pt

# Optional: use Azure OpenAI instead of OpenAI
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
```

Backend runs on `http://localhost:4000`.

> **Note on model weights:** The trained `.pt` files are not included in this repository. The `models/` directory contains training metrics, performance curves, and confusion matrices from each training run, but not the weights themselves. Contact the contributors to request the model files.

### Frontend setup

```bash
cd webapp
npm install
npm start
```

Frontend runs on `http://localhost:3000`. The backend URL (`http://localhost:4000`) is hardcoded in `webapp/src/pages/UploadPage.js` — update this if you deploy the backend elsewhere.

---

## Screenshots

_To be added._

---

## License

MIT License. See [LICENSE](LICENSE).
