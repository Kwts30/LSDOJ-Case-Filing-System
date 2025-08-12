# DOJ Auto-Fillup System

An all-in-one web-based document management and auto-fillup system for DOJ paperwork, designed for FiveM servers (such as Ruthless). This project was created by KWTS for hobby and personal use, but is open to collaboration and improvement!

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Demo/Screenshots](#demoscreenshots)
- [Folder Structure](#folder-structure)
- [Getting Started](#getting-started)
  - [Frontend Setup](#frontend-setup)
  - [Backend Setup (Optional: Discord Integration)](#backend-setup-optional-discord-integration)
- [Usage](#usage)
- [Technologies Used](#technologies-used)
- [Contributing](#contributing)
- [Support](#support)
- [License](#license)

---

## Project Overview

The DOJ Auto-Fillup System is a browser-based tool for managing and editing DOJ documents with live preview, supporting image-based document templates and optional Discord integration for automated notifications and submissions.

**Main Use Case:**  
Admins and users on a FiveM DOJ RP server can quickly generate, edit, and share official-looking documents, either as standalone images or with Discord bot integration.

---

## Features

- Live image-based document editing (visual drag-and-drop fields)
- Upload custom document template images
- Export completed documents as images or PDFs
- (Optional) Discord bot integration for automated document sharing/notifications
- Simple, modern web UI (HTML, CSS, JavaScript)
- Lightweight Python FastAPI backend (only needed for Discord integration)
- Easy, folder-based organization of templates and generated files

---

## Demo/Screenshots

## Birth Certificate
> ![image](https://github.com/user-attachments/assets/fda8dfb3-0d6f-4d66-8326-7869b23d0d1e)

## Marriage Certificate
> ![image](https://github.com/user-attachments/assets/0052e79c-397b-41be-9832-8b27baa2274b)



---

## Folder Structure

- `frontend/` — Website UI (HTML, CSS, JS)
- `backend/` — Python backend for Discord integration (not needed for image-only editing)
- `templates/` — Old document templates (PDF/DOCX) — can be deleted if not needed
- `generated/` — Old generated PDFs — can be deleted
- `data/` — Old counters and respondents — can be deleted

### Minimal Install (Image-Only)
Keep:
- `frontend/`
- `backend/` (only if you want Discord integration)

Safe to Delete:
- `templates/`
- `generated/`
- `data/`
- `requirements.txt` (if not using backend)
- `ngrok.exe` (if not using backend)

---

## Getting Started

### Frontend Setup

1. Open `frontend/index.html` in your browser  
   _Or_ use a local server (like the "Live Server" extension in VSCode) for best results.

### Backend Setup (Optional: Discord Integration)

1. Make sure Python is installed.
2. Install dependencies:
   ```bash
   pip install fastapi uvicorn discord.py
   ```
3. Open a terminal and navigate to the backend folder:
   ```bash
   cd backend
   ```
4. Start the FastAPI server:
   ```bash
   uvicorn app:fastapi_app --reload
   ```
   - `app` is the filename (`app.py`)
   - `fastapi_app` is the FastAPI instance in the file
   - `--reload` enables auto-reload on code changes

5. Configure your Discord bot token and settings in the backend as needed.

---

## Usage

1. Open `frontend/index.html` in your browser.
2. Upload your document template image.
3. Drag-and-drop to edit fields live on the canvas.
4. Export or save the completed document.
5. (Optional) If the backend is running, use the Discord integration features for auto-sharing documents.

---

## Technologies Used

- HTML, CSS, JavaScript (Frontend UI)
- Python 3.x (Backend)
- FastAPI (Backend web server)
- Discord.py (Discord bot integration)
- [Other dependencies as needed]

---

## Contributing

Contributions are welcome!  
Please open an issue or pull request for suggestions, bugfixes, or new features.

1. Fork this repository
2. Create a feature branch: `git checkout -b my-feature`
3. Commit your changes: `git commit -am 'Add new feature'`
4. Push to the branch: `git push origin my-feature`
5. Open a pull request

---

## Support

- For questions or support, open an issue in this repository.
- You can also contact me (KWTS) via GitHub or Discord if you need help setting up.

---

## License

This project is for hobby and personal use.  
You are free to use, modify, and share it — but please credit the original author (KWTS) and do not use it commercially without permission.
