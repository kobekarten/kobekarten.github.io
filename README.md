
# Kobekarten Website

This repository contains the source code of the static website for the project "Kontroversen begleiten mit Argumentlandkarten" (Kobekarten).

This website is based on the [quarto-course-template](https://github.com/xylomorph/quarto-course-template). See that repository for additional technical details.

## Server-side Rendering

A GitHub Actions workflow is included for automatic deployment. Push changes to the repository and the workflow will deploy the updated website automatically.

## Local Rendering

To preview changes locally before deployment, you can render the site on your machine.

### Prerequisites

| Tool | Purpose | Install Command |
|------|---------|----------------|
| [Quarto](https://quarto.org) ≥ 1.5 | Static site generator | [quarto.org/docs/get-started](https://quarto.org/docs/get-started/) |
| TinyTeX | LaTeX distribution for PDF output | `quarto install tinytex` (see below) |
| Python ≥ 3.11 | Course generator CLI | system or [uv](https://docs.astral.sh/uv/) |
| `quarto-coursegen` | Stub generator | `uv tool install quarto-coursegen` |
| Node.js | Argdown pandoc filter | e.g., `nvm install node` |
| [Inkscape](https://inkscape.org) | SVG→PDF conversion | See system dependencies below |

### Setup Instructions

#### 1. Install TinyTeX (LaTeX Distribution)

TinyTeX is a lightweight, portable LaTeX distribution managed by Quarto. It automatically installs missing LaTeX packages on-demand when rendering documents.

```bash
quarto install tinytex
```

This installs TinyTeX and makes it available to Quarto. When you render documents that require LaTeX packages (like `svg`, `mdframed`, etc.), Quarto will automatically download and install them as needed. No manual package management required.

**Note:** The first PDF render may take longer as packages are installed. Subsequent renders will be faster.

#### 2. Install Node.js Dependencies

Install Argdown and related tools locally:

```bash
npm install
```

This installs the dependencies defined in `package.json`, including:
- `@argdown/cli` — Argdown processor
- `@argdown/pandoc-filter` — Pandoc filter for Argdown rendering
- `@argdown/image-export` — Argdown diagram export
- `decktape` — Slide PDF export

#### 3. Install System Dependencies

**Inkscape** is required for SVG→PDF conversion in the PDF rendering pipeline:

- **Ubuntu/Debian:** `sudo apt install inkscape`
- **macOS:** `brew install --cask inkscape`
- **Other systems:** [Download from inkscape.org](https://inkscape.org/release/)

#### 4. Install Quarto Extensions (Optional)

If the project uses FontAwesome icons (check `_quarto.yml`), install the extension:

```bash
quarto add quarto-ext/fontawesome
```

### Rendering the Site

To render the entire site:

```bash
quarto render
```

This generates the static website in the `docs/` directory.

To preview the site with live reload during development:

```bash
quarto preview
```

**First Render with TinyTeX:** The first time you render to PDF, TinyTeX will automatically install required LaTeX packages (e.g., `svg`, `mdframed`, `beamer`, etc.). This may take a few minutes. Subsequent renders will be much faster.

### Troubleshooting

**Missing LaTeX packages:** If you encounter LaTeX errors, TinyTeX should automatically install missing packages. If this fails, you can manually install packages using:

```bash
quarto run tlmgr install <package-name>
```

**Clear cache:** If you experience rendering issues, try clearing the Quarto cache:

```bash
quarto render --cache-refresh
```

