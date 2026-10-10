/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Whiteboard, WhiteboardObject, WhiteboardPage } from '../types/whiteboard';

export interface ExportOptions {
  resolution?: 1 | 2 | 3; // 1x standard, 2x HD retina, 3x ultra
  transparentBackground?: boolean;
  includeGrid?: boolean;
  autoCrop?: boolean;
}

/**
 * Calculates the bounding box enclosing all objects on the page
 */
function calculateContentBounds(objects: WhiteboardObject[]) {
  if (objects.length === 0) {
    return { minX: 0, minY: 0, maxX: 1920, maxY: 1080, width: 1920, height: 1080 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const obj of objects) {
    if (obj.type === 'stroke' && obj.strokeData) {
      for (const p of obj.strokeData.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    } else {
      const w = obj.width || 180;
      const h = obj.height || 100;
      if (obj.x < minX) minX = obj.x;
      if (obj.y < minY) minY = obj.y;
      if (obj.x + w > maxX) maxX = obj.x + w;
      if (obj.y + h > maxY) maxY = obj.y + h;
    }
  }

  // Add padding
  const padding = 60;
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.max(minX + 800, maxX + padding);
  maxY = Math.max(minY + 500, maxY + padding);

  return {
    minX: Math.round(minX),
    minY: Math.round(minY),
    maxX: Math.round(maxX),
    maxY: Math.round(maxY),
    width: Math.round(maxX - minX),
    height: Math.round(maxY - minY),
  };
}

/**
 * Renders objects onto an HTML5 Canvas and returns the canvas element
 */
export function renderObjectsToOffscreenCanvas(
  objects: WhiteboardObject[],
  page: WhiteboardPage,
  options: ExportOptions = {}
): HTMLCanvasElement {
  const { resolution = 2, transparentBackground = false, includeGrid = true, autoCrop = true } = options;

  const bounds = autoCrop
    ? calculateContentBounds(objects)
    : { minX: 0, minY: 0, maxX: 1920, maxY: 1080, width: 1920, height: 1080 };

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bounds.width * resolution);
  canvas.height = Math.round(bounds.height * resolution);

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.scale(resolution, resolution);
  ctx.translate(-bounds.minX, -bounds.minY);

  // Background Fill
  if (!transparentBackground) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bounds.minX, bounds.minY, bounds.width, bounds.height);

    // Grid pattern
    if (includeGrid && page.background !== 'blank') {
      if (page.background === 'grid') {
        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 1;
        const step = 40;
        const startX = Math.floor(bounds.minX / step) * step;
        const endX = bounds.maxX;
        const startY = Math.floor(bounds.minY / step) * step;
        const endY = bounds.maxY;

        ctx.beginPath();
        for (let x = startX; x <= endX; x += step) {
          ctx.moveTo(x, bounds.minY);
          ctx.lineTo(x, bounds.maxY);
        }
        for (let y = startY; y <= endY; y += step) {
          ctx.moveTo(bounds.minX, y);
          ctx.lineTo(bounds.maxX, y);
        }
        ctx.stroke();
      } else if (page.background === 'dots') {
        ctx.fillStyle = '#e2e8f0';
        const step = 32;
        for (let x = bounds.minX; x <= bounds.maxX; x += step) {
          for (let y = bounds.minY; y <= bounds.maxY; y += step) {
            ctx.beginPath();
            ctx.arc(x, y, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }

  // Render objects sorted by zIndex
  const sorted = [...objects].sort((a, b) => a.zIndex - b.zIndex);

  for (const obj of sorted) {
    ctx.save();

    if (obj.type === 'stroke' && obj.strokeData) {
      const { points, color, size, opacity, tool } = obj.strokeData;
      if (points.length > 0) {
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = tool === 'highlighter' ? 0.35 : opacity;

        ctx.beginPath();
        if (points.length === 1) {
          ctx.arc(points[0].x, points[0].y, size / 2, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        } else {
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            const xc = (points[i].x + points[i - 1].x) / 2;
            const yc = (points[i].y + points[i - 1].y) / 2;
            ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
          }
          if (points.length > 1) {
            ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
          }
          ctx.stroke();
        }
      }
    } else if (obj.type === 'shape' && obj.shapeData) {
      const { shapeType, strokeColor, fillColor, strokeWidth, opacity } = obj.shapeData;
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = strokeColor;
      ctx.fillStyle = fillColor;
      ctx.lineWidth = strokeWidth;

      const w = obj.width || 120;
      const h = obj.height || 100;

      if (shapeType === 'rectangle') {
        if (fillColor !== 'transparent') ctx.fillRect(obj.x, obj.y, w, h);
        if (strokeWidth > 0) ctx.strokeRect(obj.x, obj.y, w, h);
      } else if (shapeType === 'circle') {
        ctx.beginPath();
        ctx.ellipse(obj.x + w / 2, obj.y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, 2 * Math.PI);
        if (fillColor !== 'transparent') ctx.fill();
        if (strokeWidth > 0) ctx.stroke();
      } else if (shapeType === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(obj.x + w / 2, obj.y);
        ctx.lineTo(obj.x + w, obj.y + h);
        ctx.lineTo(obj.x, obj.y + h);
        ctx.closePath();
        if (fillColor !== 'transparent') ctx.fill();
        if (strokeWidth > 0) ctx.stroke();
      } else if (shapeType === 'line' || shapeType === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(obj.x, obj.y);
        ctx.lineTo(obj.x + w, obj.y + h);
        ctx.stroke();

        if (shapeType === 'arrow') {
          const angle = Math.atan2(h, w);
          const headLen = 14;
          ctx.beginPath();
          ctx.moveTo(obj.x + w, obj.y + h);
          ctx.lineTo(
            obj.x + w - headLen * Math.cos(angle - Math.PI / 6),
            obj.y + h - headLen * Math.sin(angle - Math.PI / 6)
          );
          ctx.moveTo(obj.x + w, obj.y + h);
          ctx.lineTo(
            obj.x + w - headLen * Math.cos(angle + Math.PI / 6),
            obj.y + h - headLen * Math.sin(angle + Math.PI / 6)
          );
          ctx.stroke();
        }
      }
    } else if (obj.type === 'text' && obj.textData) {
      const { text, fontSize, color, fontFamily, bold } = obj.textData;
      ctx.fillStyle = color;
      ctx.font = `${bold ? 'bold ' : ''}${fontSize}px ${fontFamily || 'sans-serif'}`;
      ctx.textBaseline = 'top';
      const lines = text.split('\n');
      lines.forEach((line, idx) => {
        ctx.fillText(line, obj.x, obj.y + idx * (fontSize * 1.3));
      });
    } else if (obj.type === 'sticky' && obj.stickyData) {
      const { text, color } = obj.stickyData;
      const w = obj.width || 200;
      const h = obj.height || 160;

      ctx.fillStyle = color;
      ctx.shadowColor = 'rgba(0,0,0,0.08)';
      ctx.shadowBlur = 8;
      ctx.fillRect(obj.x, obj.y, w, h);
      ctx.shadowColor = 'transparent';

      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillRect(obj.x, obj.y, w, 20);

      ctx.fillStyle = '#1e293b';
      ctx.font = '14px sans-serif';
      ctx.textBaseline = 'top';
      const lines = text.split('\n');
      lines.forEach((line, idx) => {
        ctx.fillText(line, obj.x + 12, obj.y + 26 + idx * 20, w - 24);
      });
    } else if (obj.type === 'equation' && obj.equationData) {
      const { rawExpression, solution } = obj.equationData;
      const w = obj.width || 380;
      const h = obj.height || (solution ? 200 : 90);

      // Card box
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.shadowColor = 'rgba(0,0,0,0.04)';
      ctx.shadowBlur = 8;
      ctx.fillRect(obj.x, obj.y, w, h);
      ctx.strokeRect(obj.x, obj.y, w, h);
      ctx.shadowColor = 'transparent';

      // Header
      ctx.fillStyle = '#2563eb';
      ctx.font = 'bold 11px sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText('EQUATION', obj.x + 16, obj.y + 14);

      // Formula
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 18px monospace, serif';
      ctx.fillText(rawExpression, obj.x + 16, obj.y + 32);

      if (solution) {
        ctx.fillStyle = '#1e40af';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(`Result: ${solution.solution}`, obj.x + 16, obj.y + 64);

        ctx.fillStyle = '#64748b';
        ctx.font = '11px sans-serif';
        solution.steps.slice(0, 3).forEach((s, idx) => {
          ctx.fillText(`Step ${s.stepNumber}: ${s.expression}`, obj.x + 16, obj.y + 88 + idx * 20);
        });
      }
    }
    ctx.restore();
  }

  return canvas;
}

/**
 * Exports current whiteboard page as a high-resolution PNG file
 */
export function exportToPNG(
  boardTitle: string,
  pageTitle: string,
  objects: WhiteboardObject[],
  page: WhiteboardPage,
  options: ExportOptions = {}
): void {
  const canvas = renderObjectsToOffscreenCanvas(objects, page, options);
  const cleanBoard = boardTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'whiteboard';
  const cleanPage = pageTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'page';

  const link = document.createElement('a');
  link.download = `${cleanBoard}-${cleanPage}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

/**
 * Copies the current whiteboard canvas as PNG to the user's system clipboard
 */
export async function copyCanvasToClipboard(
  objects: WhiteboardObject[],
  page: WhiteboardPage,
  options: ExportOptions = {}
): Promise<boolean> {
  try {
    const canvas = renderObjectsToOffscreenCanvas(objects, page, { ...options, resolution: 2 });
    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          resolve(false);
          return;
        }
        try {
          if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
            await navigator.clipboard.write([
              new ClipboardItem({
                'image/png': blob,
              }),
            ]);
            resolve(true);
          } else {
            resolve(false);
          }
        } catch {
          resolve(false);
        }
      }, 'image/png');
    });
  } catch {
    return false;
  }
}

/**
 * Exports current whiteboard page as a scalable SVG file
 */
export function exportToSVG(
  board: Whiteboard,
  currentPageId: string,
  options: ExportOptions = {}
): void {
  const { transparentBackground = false, includeGrid = true, autoCrop = true } = options;
  const objects = board.objects[currentPageId] || [];
  const page = board.pages.find((p) => p.id === currentPageId) || board.pages[0];

  const bounds = autoCrop
    ? calculateContentBounds(objects)
    : { minX: 0, minY: 0, maxX: 1920, maxY: 1080, width: 1920, height: 1080 };

  const cleanBoard = board.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'whiteboard';
  const cleanPage = (page?.title || 'page').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  let svgContent = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svgContent += `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}">\n`;

  // Defs & Styles
  svgContent += `  <defs>\n`;
  svgContent += `    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">\n`;
  svgContent += `      <polygon points="0 0, 10 3.5, 0 7" fill="#2563eb" />\n`;
  svgContent += `    </marker>\n`;
  svgContent += `  </defs>\n`;

  // Background
  if (!transparentBackground) {
    svgContent += `  <rect x="${bounds.minX}" y="${bounds.minY}" width="${bounds.width}" height="${bounds.height}" fill="#ffffff" />\n`;

    if (includeGrid && page?.background === 'grid') {
      const step = 40;
      svgContent += `  <g stroke="#f1f5f9" stroke-width="1">\n`;
      for (let x = bounds.minX; x <= bounds.maxX; x += step) {
        svgContent += `    <line x1="${x}" y1="${bounds.minY}" x2="${x}" y2="${bounds.maxY}" />\n`;
      }
      for (let y = bounds.minY; y <= bounds.maxY; y += step) {
        svgContent += `    <line x1="${bounds.minX}" y1="${y}" x2="${bounds.maxX}" y2="${y}" />\n`;
      }
      svgContent += `  </g>\n`;
    }
  }

  // Objects
  const sorted = [...objects].sort((a, b) => a.zIndex - b.zIndex);

  for (const obj of sorted) {
    if (obj.type === 'stroke' && obj.strokeData) {
      const { points, color, size, opacity, tool } = obj.strokeData;
      const effectiveOpacity = tool === 'highlighter' ? 0.35 : opacity;
      if (points.length === 1) {
        svgContent += `  <circle cx="${points[0].x}" cy="${points[0].y}" r="${size / 2}" fill="${color}" opacity="${effectiveOpacity}" />\n`;
      } else if (points.length > 1) {
        let d = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
          const xc = (points[i].x + points[i - 1].x) / 2;
          const yc = (points[i].y + points[i - 1].y) / 2;
          d += ` Q ${points[i - 1].x} ${points[i - 1].y}, ${xc} ${yc}`;
        }
        d += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
        svgContent += `  <path d="${d}" stroke="${color}" stroke-width="${size}" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="${effectiveOpacity}" />\n`;
      }
    } else if (obj.type === 'shape' && obj.shapeData) {
      const { shapeType, strokeColor, fillColor, strokeWidth, opacity } = obj.shapeData;
      const w = obj.width || 120;
      const h = obj.height || 100;

      if (shapeType === 'rectangle') {
        svgContent += `  <rect x="${obj.x}" y="${obj.y}" width="${w}" height="${h}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" opacity="${opacity}" rx="4" />\n`;
      } else if (shapeType === 'circle') {
        svgContent += `  <ellipse cx="${obj.x + w / 2}" cy="${obj.y + h / 2}" rx="${Math.abs(w / 2)}" ry="${Math.abs(h / 2)}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" opacity="${opacity}" />\n`;
      } else if (shapeType === 'triangle') {
        svgContent += `  <polygon points="${obj.x + w / 2},${obj.y} ${obj.x + w},${obj.y + h} ${obj.x},${obj.y + h}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" opacity="${opacity}" />\n`;
      } else if (shapeType === 'line') {
        svgContent += `  <line x1="${obj.x}" y1="${obj.y}" x2="${obj.x + w}" y2="${obj.y + h}" stroke="${strokeColor}" stroke-width="${strokeWidth}" opacity="${opacity}" stroke-linecap="round" />\n`;
      } else if (shapeType === 'arrow') {
        svgContent += `  <line x1="${obj.x}" y1="${obj.y}" x2="${obj.x + w}" y2="${obj.y + h}" stroke="${strokeColor}" stroke-width="${strokeWidth}" opacity="${opacity}" stroke-linecap="round" marker-end="url(#arrowhead)" />\n`;
      }
    } else if (obj.type === 'text' && obj.textData) {
      const { text, fontSize, color, fontFamily, bold } = obj.textData;
      const lines = text.split('\n');
      svgContent += `  <text x="${obj.x}" y="${obj.y + fontSize}" font-size="${fontSize}" fill="${color}" font-family="${fontFamily || 'sans-serif'}" font-weight="${bold ? 'bold' : 'normal'}">\n`;
      lines.forEach((line, idx) => {
        svgContent += `    <tspan x="${obj.x}" dy="${idx === 0 ? 0 : fontSize * 1.3}">${escapeXml(line)}</tspan>\n`;
      });
      svgContent += `  </text>\n`;
    } else if (obj.type === 'sticky' && obj.stickyData) {
      const { text, color } = obj.stickyData;
      const w = obj.width || 200;
      const h = obj.height || 160;
      svgContent += `  <g>\n`;
      svgContent += `    <rect x="${obj.x}" y="${obj.y}" width="${w}" height="${h}" fill="${color}" rx="8" />\n`;
      svgContent += `    <rect x="${obj.x}" y="${obj.y}" width="${w}" height="18" fill="rgba(0,0,0,0.06)" rx="8" />\n`;
      const lines = text.split('\n');
      svgContent += `    <text x="${obj.x + 12}" y="${obj.y + 36}" font-size="14" fill="#1e293b" font-family="sans-serif">\n`;
      lines.forEach((line, idx) => {
        svgContent += `      <tspan x="${obj.x + 12}" dy="${idx === 0 ? 0 : 20}">${escapeXml(line)}</tspan>\n`;
      });
      svgContent += `    </text>\n`;
      svgContent += `  </g>\n`;
    } else if (obj.type === 'equation' && obj.equationData) {
      const { rawExpression, solution } = obj.equationData;
      const w = obj.width || 380;
      const h = obj.height || (solution ? 180 : 80);
      svgContent += `  <g>\n`;
      svgContent += `    <rect x="${obj.x}" y="${obj.y}" width="${w}" height="${h}" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" rx="8" />\n`;
      svgContent += `    <text x="${obj.x + 16}" y="${obj.y + 24}" font-size="11" fill="#2563eb" font-family="sans-serif" font-weight="bold">EQUATION</text>\n`;
      svgContent += `    <text x="${obj.x + 16}" y="${obj.y + 48}" font-size="18" fill="#0f172a" font-family="monospace, serif" font-weight="bold">${escapeXml(rawExpression)}</text>\n`;
      if (solution) {
        svgContent += `    <text x="${obj.x + 16}" y="${obj.y + 76}" font-size="13" fill="#1e40af" font-family="sans-serif" font-weight="bold">${escapeXml(`Result: ${solution.solution}`)}</text>\n`;
        if (solution.steps && solution.steps.length > 0) {
          solution.steps.slice(0, 3).forEach((s, idx) => {
            svgContent += `    <text x="${obj.x + 16}" y="${obj.y + 98 + idx * 20}" font-size="11" fill="#64748b" font-family="sans-serif">${escapeXml(`Step ${s.stepNumber}: ${s.expression}`)}</text>\n`;
          });
        }
      }
      svgContent += `  </g>\n`;
    }
  }

  svgContent += `</svg>`;

  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${cleanBoard}-${cleanPage}.svg`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Exports all pages in the whiteboard as separate high-res PNG files
 */
export async function exportAllPagesToPNG(
  board: Whiteboard,
  options: ExportOptions = {}
): Promise<void> {
  for (let i = 0; i < board.pages.length; i++) {
    const page = board.pages[i];
    const objects = board.objects[page.id] || [];
    exportToPNG(board.title, `${i + 1}-${page.title}`, objects, page, options);
    // Slight pause between downloads so browser doesn't block bulk downloads
    if (i < board.pages.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }
}

/**
 * Exports all pages in the whiteboard as separate SVG files
 */
export async function exportAllPagesToSVG(
  board: Whiteboard,
  options: ExportOptions = {}
): Promise<void> {
  for (let i = 0; i < board.pages.length; i++) {
    const page = board.pages[i];
    exportToSVG(board, page.id, options);
    if (i < board.pages.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }
}

export function exportToJSON(board: Whiteboard): void {
  const jsonStr = JSON.stringify(board, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const cleanBoard = board.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'whiteboard';
  link.download = `${cleanBoard}.whiteboard.json`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
