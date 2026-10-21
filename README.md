#shaadibanao  — Monorepo

> **A Premium Matrimonial Platform**  
> *Where trust meets togetherness. Serious about marriage. Safe by design.*

---

## 1. Project Overview & Architecture

BandhanSetu is architected as a high-security, privacy-first matrimonial platform inspired by the operational rigor of Shaadi.com, Jeevansathi, and BharatMatrimony. It strictly adheres to the product blueprint (`docs/BandhanSetu_Blueprint_Screens_v0.2.pdf`).

### Monorepo Structure
```text
bandhansetu/
├── apps/
│   └── mobile/                 # React Native + Expo + TypeScript (Android/iOS)
│       ├── src/
│       │   ├── components/     # Design System (Button, Input, BackendStatusBadge)
│       │   ├── constants/      # Theme tokens mapped from @bandhansetu/shared
│       │   ├── screens/        # Splash (S-00), Welcome (S-00b), Login (S-00c/S-02), Dashboard (S-08)
│       │   └── services/       # Centralized API Client & Health Service
│       ├── App.tsx             # Root Navigation Flow & Status Bar
│       ├── app.json            # Expo Application Manifest
│       └── package.json        # Workspace: @bandhansetu/mobile
│
├── server/                     # Node.js + Express + TypeScript + Mongoose
│   ├── src/
│   │   ├── config/             # Environment, Database, and Security configuration
│   │   ├── middleware/         # Centralized error handling & Zod request validation
│   │   ├── routes/             # API v1 routes (/api/v1/health)
│   │   ├── app.ts              # Express application factory
│   │   └── index.ts            # Server entrypoint with graceful shutdown
│   ├── tests/                  # Automated integration tests (Jest + Supertest)
│   └── package.json            # Workspace: server
│
├── packages/
│   └── shared/                 # Shared TypeScript contracts and domain models
│       ├── src/
│       │   ├── theme/          # Royal Maroon, Soft Gold, Ivory design tokens
│       │   ├── constants/      # Domain enums (ProfileCreatedFor, PhotoPrivacy, etc.)
│       │   ├── schemas/        # Zod validation schemas (Auth, Profile)
│       │   └── types/          # API response and domain interfaces
│       └── package.json        # Workspace: @bandhansetu/shared
│
├── docs/                       # Product blueprint (BandhanSetu_Blueprint_Screens_v0.2.pdf)
├── .env.example                # Centralized environment variable template
├── package.json                # npm workspaces root configuration
└── README.md                   # Setup guide and documentation
```

---

## 2. Brand Design Tokens (Blueprint v0.2)

| Color Name | Hex Code | Purpose |
| :--- | :--- | :--- |
| **Royal Maroon** | `#7A1F3D` | Primary brand identity, primary CTA buttons, links |
| **Soft Gold** | `#C9A24B` | Premium accent, highlights, upgrade moments |
| **Ivory** | `#FBF6EE` | Screen background, warm cards, surface foundation |
| **Charcoal** | `#2B2B2B` | Primary high-contrast body typography |
| **Deep Teal** | `#2F6F6B` | Secondary badges, trust indicators, contextual tips |
| **Verified Green** | `#2E7D32` | Verification badges (Photo Checked, ID Badge), success |
| **Alert Red** | `#B3261E` | Validation errors, destructive actions (Block, Report) |
| **Warm Grey** | `#E8E2D8` | Borders, subtle dividers, skeleton placeholders |

---

## 3. Prerequisites

The following developer tools are installed and verified:
- **Node.js**: `v22.22.2` (LTS) or higher
- **npm**: `10.9.7` or higher
- **Git**: `2.53+`
- **Java JDK**: `Java 21 LTS` (for Android builds)
- **Android SDK & platform-tools**: `adb` available in `PATH`

---

## 4. Setup & Running Instructions (Windows PowerShell)

Run all commands from the repository root directory (`d:\bandansteuapp`):

### Step 1: Install Dependencies
```powershell
npm install
```

### Step 2: Build the Shared Package
```powershell
npm run build --workspace=@bandhansetu/shared
```

### Step 3: Configure Environment Variables
Copy the template `.env.example` to `.env`:
```powershell
Copy-Item .env.example .env
```
*(Default settings allow the server and health endpoints to run in offline/disconnected database mode without requiring local MongoDB).*

### Step 4: Run Automated Tests
Execute backend integration tests verifying the health check, root route, and 404 handler:
```powershell
npm test
```

### Step 5: Start the Backend Server (Express + TypeScript)
In your first PowerShell terminal, run:
```powershell
npm run server:dev
```
The server will start on port `5000`:
```text
===============================================
  BandhanSetu Server running on port 5000
  Environment: development
  Health Check: http://localhost:5000/api/v1/health
===============================================
```

### Step 6: Test the Backend API (via PowerShell)
Open a new PowerShell terminal and test the health endpoint:
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/health" | ConvertTo-Json -Depth 4
```
**Expected Response:**
```json
{
  "success": true,
  "message": "BandhanSetu API is healthy and operational",
  "data": {
    "status": "ok",
    "service": "BandhanSetu API",
    "version": "1.0.0",
    "timestamp": "2026-10-11T...",
    "database": {
      "status": "unconfigured"
    },
    "environment": "development"
  },
  "meta": {
    "timestamp": "2026-10-11T..."
  }
}
```

### Step 7: Start the Mobile Application (Expo)
In another PowerShell terminal:
```powershell
npm run mobile:start
```
- Press `a` in the Expo terminal to open on a connected Android Emulator or device via `adb`.
- Press `w` to open in the web browser.

---

## 5. Mobile Networking: Android Emulator vs. Physical Device

The centralized API client in [apps/mobile/src/services/apiClient.ts](file:///d:/bandansteuapp/apps/mobile/src/services/apiClient.ts) reads `EXPO_PUBLIC_API_URL` and implements platform-aware networking:

1. **Android Emulator**:
   - The Android Emulator runs in a virtual network. Connecting to `localhost` connects to the virtual emulator itself, **not** your development PC.
   - The default URL is set to `http://10.0.2.2:5000/api/v1` which points directly to the host machine.
2. **Physical Android Device (Over Wi-Fi)**:
   - Find your host workstation's IPv4 address:
     ```powershell
     (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Wi-Fi*').IPAddress
     ```
   - Set `EXPO_PUBLIC_API_URL` in your `.env` to:
     ```text
     EXPO_PUBLIC_API_URL=http://<YOUR_WORKSTATION_IP>:5000/api/v1
     ```
   - Ensure Windows Defender Firewall allows inbound TCP traffic on port 5000 for your private network.

3. **In-App Health Diagnostic Badge**:
   - The mobile application includes a persistent status badge in the header.
   - Tap the badge at any time to inspect the active API base URL, round-trip latency, connection status, and full JSON health payload.

---

## 6. Milestone 1 Verification Status

- [x] **Monorepo Structure**: Root workspaces configured (`apps/*`, `server`, `packages/*`).
- [x] **Shared Package (`@bandhansetu/shared`)**: Brand tokens, Zod schemas, domain constants, and TypeScript types compiled to `dist/`.
- [x] **Backend Server (`server`)**: Express with Helmet, CORS, centralized error handling, and `GET /api/v1/health` with offline database resilience.
- [x] **Automated Tests**: Jest + Supertest test suite passing (3/3 tests passed).
- [x] **Mobile App (`apps/mobile`)**: Initialized with Expo + TypeScript, Brand Design System, centralized API client, S-00 Splash screen, S-00b Welcome screen, S-00c/S-02 Login screen, S-08 Dashboard preview, and diagnostic status badge.
