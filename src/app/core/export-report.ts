import { toJpeg, toPng } from 'html-to-image';

export type ExportFormat = 'pdf' | 'png' | 'jpeg';

const BACKGROUND = '#f8fafc';
/** Limite de hauteur d'un canvas, très en dessous du maximum des navigateurs. */
const MAX_CANVAS_PX = 16000;

/** Capture l'élément en image (les éléments marqués `data-no-export` sont omis). */
async function capture(el: HTMLElement, format: 'png' | 'jpeg'): Promise<string> {
  const pixelRatio = Math.max(0.5, Math.min(2, MAX_CANVAS_PX / el.scrollHeight));
  const options = {
    pixelRatio,
    backgroundColor: BACKGROUND,
    quality: 0.92,
    filter: (node: Node) => !(node instanceof HTMLElement && node.hasAttribute('data-no-export')),
  };
  return format === 'png' ? toPng(el, options) : toJpeg(el, options);
}

function download(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossible de lire l'image générée"));
    img.src = src;
  });
}

async function toPdf(el: HTMLElement, filename: string) {
  const { jsPDF } = await import('jspdf');
  const img = await loadImage(await capture(el, 'jpeg'));

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const printW = pageW - margin * 2;
  const printH = pageH - margin * 2;

  // Hauteur d'une page exprimée en pixels de l'image source.
  const slicePx = Math.floor((img.width * printH) / printW);
  for (let y = 0, page = 0; y < img.height; y += slicePx, page++) {
    const h = Math.min(slicePx, img.height - y);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, y, img.width, h, 0, 0, img.width, h);

    if (page > 0) pdf.addPage();
    pdf.setFillColor(248, 250, 252);
    pdf.rect(0, 0, pageW, pageH, 'F');
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, printW, (h * printW) / img.width);
  }
  pdf.save(filename);
}

export async function exportReport(el: HTMLElement, format: ExportFormat, basename: string) {
  if (format === 'pdf') return toPdf(el, `${basename}.pdf`);
  const ext = format === 'png' ? 'png' : 'jpg';
  download(await capture(el, format), `${basename}.${ext}`);
}
