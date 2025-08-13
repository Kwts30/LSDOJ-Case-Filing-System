# DOJ Auto-Fillup System (Pure Frontend Edition)

A lightweight, fully client-side (no backend required) auto-fill generator for DOJ-style documents used in FiveM roleplay servers. Generates high-resolution PNG images directly in the browser.

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Demo/Screenshots](#demoscreenshots)
- [Folder Structure](#folder-structure)
- [Getting Started](#getting-started)
   - [Quick Use](#quick-use)
- [Usage](#usage)
- [Technologies Used](#technologies-used)
- [Contributing](#contributing)
- [Support](#support)
- [License](#license)

---

## Project Overview

This edition of the tool is 100% static: open `index.html` and start generating documents. All rendering and image exporting happen locally using an HTML5 `<canvas>`. No data leaves your machine.

**Use Case:** Rapid creation of official-themed documents (Birth Certificate, Marriage Certificate, Business Permit) for RP scenarios.

---

## Features

- Live preview while typing
- High-resolution (2480x3508) PNG export
- Three document types: Birth, Marriage, Business Permit
- Works offline / no server required
- Clean filename generation (sanitized)
- Fallback handling for missing business permit template
- Simple, single-folder deployment (GitHub Pages friendly)

---

## Demo/Screenshots

## Birth Certificate
> ![image](https://github.com/user-attachments/assets/fda8dfb3-0d6f-4d66-8326-7869b23d0d1e)

## Marriage Certificate
> ![image](https://github.com/user-attachments/assets/0052e79c-397b-41be-9832-8b27baa2274b)



---

## Folder Structure

Root contains:
- `index.html` – main UI
- `style.css` – styling
- `script.js` – canvas rendering & download logic
- `assets/` – certificate background images
- `README.md` – this file
 

---

## Getting Started

### Quick Use

1. Clone or download the repository.
2. Open `index.html` in any modern browser (Chrome, Firefox, Edge, Safari).
3. Fill out a form (Birth / Marriage / Business).
4. Watch the live preview update.
5. Press Submit to download a PNG.

Optional: Use a lightweight static server (improves image caching):

```bash
# Python 3 (if installed)
python -m http.server 8080

# Node (if installed)
npx serve .
```
Then open http://localhost:8080

---

## Usage

1. Open `index.html`.
2. Choose a document type via the sidebar.
3. Enter data; the preview updates automatically.
4. Submit the form to trigger a download of the rendered PNG.
5. Repeat or switch document types as needed.

---

## Technologies Used

- HTML5 + CSS3 + Vanilla JavaScript
- Canvas 2D API
- (Removed) Python / FastAPI / Discord.py (no longer required in this edition)

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

- Open an issue for bugs or feature requests.
- Ideas welcome for: PDF export, localStorage persistence, custom template upload.

---

## License

This project is for hobby and personal use. You are free to use, modify, and share it — but please credit the original author (KWTS) and do not use it commercially without permission.

---

### Changelog (Frontend Edition)
- Removed all backend Python/Discord code (app.py, bot_utils.py)
- Simplified README for static deployment
- Ensured download-only workflow
