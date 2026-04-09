# 1050 Lab 25 – Light Pollution Monitor

A web-based dashboard for mapping and visualising spectral light pollution data collected across London, Ontario. Built as part of a university field study using a custom ESP32-based sensor device.

---

## Project Overview

The sensor device records light intensity readings every 2 seconds across 10 spectral channels using an AS7341 spectral sensor, timestamped by a DS1302 RTC and saved to an SD card as CSV. This website ingests those CSV files, displays session data on an interactive map, and allows users to explore the spectral breakdown of each recording session. An AI-powered analysis is generated automatically when a session is uploaded.

---

## Repository Structure

```
/
├── index.html                      # Main map view — one pin per session
├── SessionDetail.html              # Timeline + spectral chart for a single session
├── SubmitReading.html              # Upload a CSV session to the repo
├── Aboutuspage.html                # Project overview, hardware details, sensor code
├── sessions.json                   # Index of all sessions (summary metadata)
├── readings/
│   ├── session_001.json            # Full reading data for session 1
│   ├── session_002.json            # Full reading data for session 2
│   └── ...                         # Additional sessions added over time
├── api/
│   └── analyse.js                  # Vercel serverless function — AI session analysis
├── config.js                       # GitHub API credentials (gitignored — never commit)
└── .gitignore
```

---

## Pages

### Homepage (`index.html`)
Displays a Leaflet map with one pin per recording session. Pin colour is a smooth gradient (blue → cyan → green → amber → red) relative to all sessions' average Clear channel values. Clicking a pin shows a summary popup with a link to the full session detail.

### Session Detail (`SessionDetail.html`)
Opened via `SessionDetail.html?session=session_001`. Shows:
- Session stats (total readings, duration, avg/peak/min Clear)
- A full-width timeline bar where each segment is one 2-second reading, coloured relative to that session's own min/max Clear
- Hovering a segment shows the time, Clear, and NIR values
- Clicking a segment opens a bar chart modal displaying all 10 spectral channels scaled relative to the highest value in that reading

### Submit Reading (`SubmitReading.html`)
Allows uploading a CSV file from the sensor device. The file is parsed in the browser, previewed with key stats, and an AI-generated analysis of the session is shown automatically. Once coordinates are entered, the session is committed directly to the `readings/` folder via the GitHub API and `sessions.json` is updated. Requires `config.js` to be configured locally (see Setup).

### Overview (`Aboutuspage.html`)
Documents the hardware setup, sensor firmware (v2), and CSV data format for reference.

---

## Data Format

Each CSV file produced by the sensor (firmware v2) has the following format:

```
Date,Time,F1,F2,F3,F4,F5,F6,F7,F8,NIR,Clear,Lux_Est
2024/03/15,07:30:00,120,145,160,210,198,175,143,98,88,450,17.632
2024/03/15,07:30:02,122,148,163,214,201,178,146,100,90,455,17.827
...
```

| Field | Format | Description |
|---|---|---|
| Date | `yyyy/mm/dd` | Calendar date |
| Time | `hh:mm:ss` | 24-hour time |
| F1–F8 | integer | Visible spectral band intensities (415 nm violet → 680 nm red) |
| NIR | integer | Near-infrared channel intensity |
| Clear | integer | Broadband clear channel — used for map colour-coding |
| Lux_Est | float | Estimated illuminance in lux, derived from Clear using `Clear / (GAIN × TINT) × LUX_FACTOR` |

One row is written every 2 seconds. Each power-on cycle creates a new file named by boot date (e.g. `0315.csv`).

> **Note:** The upload form accepts both 12-column (without `Lux_Est`) and 13-column (with `Lux_Est`) CSV files. The `Lux_Est` column is optional and will be shown as `N/A` in the preview if absent.

---

## Hardware

| Component | Part | Pins |
|---|---|---|
| Microcontroller | ESP32 | — |
| Spectral Sensor | AS7341 | SDA=33, SCL=32 |
| Real-Time Clock | DS1302 | DAT=26, CLK=25, RST=27 |
| Storage | SD Card Module | CS=5 |

**Gain setting:** Firmware v2 uses `AS7341_GAIN_16X` (saturation ~1600 lux), replacing the original `AS7341_GAIN_256X` which saturated at ~100 lux — too low for urban streetlight environments.

---

## AI Analysis

When a CSV is uploaded on the Submit page, the session summary is automatically sent to a Vercel serverless function (`api/analyse.js`) which calls the Anthropic API to generate a plain-English light pollution assessment covering:

1. Whether the session is likely to represent light pollution
2. The probable type of light pollution and artificial light source
3. Blue light content and its health/ecological implications
4. Overall brightness and spectral character

The AI analysis requires the site to be deployed on Vercel with the `ANTHROPIC_API_KEY` environment variable set (see Deployment).

---

## Setup

### Viewing the live site
The site is hosted on Vercel at: https://1050-light-website-ml-implementatio.vercel.app/

### Uploading a new session locally
1. Generate a fresh GitHub Personal Access Token with `repo` scope at **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. Create `config.js` in the root of your local repo (it is gitignored and must never be committed):

```js
const GITHUB_CONFIG = {
    owner:  'your_github_username',
    repo:   'your_repo_name',
    branch: 'main',
    token:  'your_personal_access_token_here'
};
```

3. Open `SubmitReading.html` as a local file in your browser (`file:///...`), not via the Vercel URL
4. Drop in the CSV from the SD card, enter the coordinates of the recording location, and click **Save Session**
5. The map will update within 30 seconds as it polls `sessions.json` on a 30-second interval

### Adding sessions manually
Add the session JSON file to `readings/`, append a matching entry to `sessions.json`, and push.

---

## Sessions Index (`sessions.json`)

Each entry in `sessions.json` has the following structure:

```json
{
  "id": "session_001",
  "file": "readings/session_001.json",
  "date": "2024/03/15",
  "timeStart": "07:30:00",
  "timeEnd": "07:30:58",
  "avgClear": 312,
  "peakClear": 480,
  "rowCount": 30,
  "coordinates": [42.9837, -81.2497]
}
```

The homepage only fetches `sessions.json` — individual session files are only loaded when a user opens the Session Detail page.

---

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript (no framework)
- **Map:** [Leaflet.js](https://leafletjs.com/) + OpenStreetMap tiles
- **AI Analysis:** Anthropic Claude (claude-haiku-4-5) via Vercel serverless function
- **Data storage:** GitHub repo (JSON files committed via GitHub Contents API)
- **Hosting:** Vercel
- **Fonts:** Space Mono, DM Sans (Google Fonts)

---

## Security Notes

- `config.js` contains a GitHub Personal Access Token and **must never be committed to the repository**. It is listed in `.gitignore`. If a token is accidentally exposed, revoke it immediately at GitHub → Settings → Developer settings → Personal access tokens.
- The `ANTHROPIC_API_KEY` lives only in Vercel's environment variables — it is never exposed to the browser. All AI calls go through the serverless function in `api/`.

---

## Team

- **Justin** — Website, data infrastructure, frontend development
- **Samarth** — AI integration, sensor hardware, sensor coder, prototype assembly
- **Pol** — CAD design, prototype assembly
- **Aroma** — Presentation coordinator
- **Taylor** — Presentation coordinator
- **Alfred** — Cad design
