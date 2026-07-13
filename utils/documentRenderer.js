const { execFile } = require('child_process');
const { promisify } = require('util');
const fsSync = require('fs');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');

const execFileAsync = promisify(execFile);
let pdfjsPromise;

async function getPdfJs() {
  if (!pdfjsPromise) {
    const { DOMMatrix, ImageData, Path2D } = require('@napi-rs/canvas');
    globalThis.DOMMatrix ||= DOMMatrix;
    globalThis.ImageData ||= ImageData;
    globalThis.Path2D ||= Path2D;
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  }

  return pdfjsPromise;
}

function findMicrosoftWordPath() {
  const programRoots = [
    process.env.ProgramW6432,
    process.env.ProgramFiles,
    process.env['ProgramFiles(x86)']
  ].filter(Boolean);

  const candidates = [
    process.env.WINWORD_PATH,
    ...programRoots.map(root => path.join(root, 'Microsoft Office', 'root', 'Office16', 'WINWORD.EXE'))
  ].filter(Boolean);

  return candidates.find(candidate => fsSync.existsSync(candidate)) || null;
}

function getRendererConfiguration() {
  const sofficePath = process.env.SOFFICE_PATH;
  const commonSettings = {
    dpi: parseInt(process.env.DOCUMENT_RENDER_DPI || '150', 10),
    timeoutMs: parseInt(process.env.DOCUMENT_RENDER_TIMEOUT_MS || '120000', 10)
  };

  if (sofficePath && fsSync.existsSync(sofficePath)) {
    return {
      available: true,
      engine: 'libreoffice',
      sofficePath,
      ...commonSettings
    };
  }

  const winwordPath = process.platform === 'win32' ? findMicrosoftWordPath() : null;
  if (winwordPath) {
    return {
      available: true,
      engine: 'microsoft-word',
      winwordPath,
      ...commonSettings
    };
  }

  return {
    available: false,
    reason: 'Install LibreOffice and set SOFFICE_PATH, or install Microsoft Word on Windows.'
  };
}

async function convertWithLibreOffice(inputPath, tempDir, config) {
  await execFileAsync(
    config.sofficePath,
    ['--headless', '--convert-to', 'pdf:writer_pdf_Export', '--outdir', tempDir, inputPath],
    { windowsHide: true, timeout: config.timeoutMs }
  );
}

async function convertWithMicrosoftWord(inputPath, pdfPath, config) {
  const command = [
    "$ErrorActionPreference = 'Stop'",
    '$word = $null',
    '$document = $null',
    'try {',
    '  $word = New-Object -ComObject Word.Application',
    '  $word.Visible = $false',
    '  $word.DisplayAlerts = 0',
    '  $document = $word.Documents.Open($env:DOJ_RENDER_INPUT, $false, $true)',
    '  $document.ExportAsFixedFormat($env:DOJ_RENDER_OUTPUT, 17)',
    '} finally {',
    '  if ($document -ne $null) { $document.Close(0); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($document) }',
    '  if ($word -ne $null) { $word.Quit(); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($word) }',
    '  [GC]::Collect()',
    '  [GC]::WaitForPendingFinalizers()',
    '}'
  ].join('; ');

  await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command],
    {
      windowsHide: true,
      timeout: config.timeoutMs,
      env: { ...process.env, DOJ_RENDER_INPUT: inputPath, DOJ_RENDER_OUTPUT: pdfPath }
    }
  );
}

async function renderPdfPages(pdfBuffer, dpi) {
  const { createCanvas } = require('@napi-rs/canvas');
  const pdfjs = await getPdfJs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(pdfBuffer), disableWorker: true }).promise;
  const pages = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: dpi / 72 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext('2d');
      await page.render({ canvasContext: context, viewport }).promise;
      pages.push({
        page_number: pageNumber,
        png_base64: canvas.toBuffer('image/png').toString('base64')
      });
      page.cleanup();
    }
  } finally {
    await pdf.destroy();
  }

  return pages;
}

async function renderDocxToPdfAndPng(docxBuffer) {
  const config = getRendererConfiguration();
  if (!config.available) return { rendered: false, reason: config.reason, pdfBase64: null, pages: [] };

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'doj-render-'));
  const inputPath = path.join(tempDir, 'filing.docx');
  const pdfPath = path.join(tempDir, 'filing.pdf');

  try {
    await fs.writeFile(inputPath, docxBuffer);
    if (config.engine === 'libreoffice') {
      await convertWithLibreOffice(inputPath, tempDir, config);
    } else {
      await convertWithMicrosoftWord(inputPath, pdfPath, config);
    }
    const pdfBuffer = await fs.readFile(pdfPath);
    const pages = await renderPdfPages(pdfBuffer, config.dpi);

    return { rendered: true, reason: null, pdfBase64: pdfBuffer.toString('base64'), pages };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

module.exports = {
  findMicrosoftWordPath,
  getRendererConfiguration,
  renderDocxToPdfAndPng
};
