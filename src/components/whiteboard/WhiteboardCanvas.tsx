/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  ToolType,
  WhiteboardObject,
  Point,
  BackgroundPattern,
  CollaboratorCursor,
} from '../../types/whiteboard';

interface RemotePointer {
  x: number;
  y: number;
  isDown: boolean;
  mode: 'move' | 'draw' | 'laser';
  pressure?: number;
}

interface WhiteboardCanvasProps {
  objects: WhiteboardObject[];
  currentTool: ToolType;
  color: string;
  strokeWidth: number;
  fillColor: string;
  backgroundPattern: BackgroundPattern;
  selectedObjectId: string | null;
  onSelectObject: (id: string | null) => void;
  onAddObject: (obj: WhiteboardObject) => void;
  onUpdateObject: (obj: WhiteboardObject) => void;
  onDeleteObject: (id: string) => void;
  collaborators: CollaboratorCursor[];
  remotePointer: RemotePointer | null;
  zoom: number;
  pan: { x: number; y: number };
  onPanChange: (pan: { x: number; y: number }) => void;
  onZoomChange: (zoom: number) => void;
  currentPageId: string;
  readOnly?: boolean;
}

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  objects,
  currentTool,
  color,
  strokeWidth,
  fillColor,
  backgroundPattern,
  selectedObjectId,
  onSelectObject,
  onAddObject,
  onUpdateObject,
  onDeleteObject,
  collaborators,
  remotePointer,
  zoom,
  pan,
  onPanChange,
  onZoomChange,
  currentPageId,
  readOnly = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isPointerDown, setIsPointerDown] = useState(false);
  const currentStrokePoints = useRef<Point[]>([]);
  const startDragPoint = useRef<Point | null>(null);
  const draggingObjectId = useRef<string | null>(null);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Inline text editing state
  const [editingTextObj, setEditingTextObj] = useState<{
    id: string;
    x: number;
    y: number;
    text: string;
  } | null>(null);

  // Convert screen coordinates to canvas world coordinates
  const screenToWorld = useCallback(
    (screenX: number, screenY: number): Point => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: screenX, y: screenY };
      const rawX = screenX - rect.left;
      const rawY = screenY - rect.top;
      return {
        x: (rawX - pan.x) / zoom,
        y: (rawY - pan.y) / zoom,
      };
    },
    [pan, zoom]
  );

  // Convert canvas world coordinates to screen coordinates
  const worldToScreen = useCallback(
    (worldX: number, worldY: number): Point => {
      return {
        x: worldX * zoom + pan.x,
        y: worldY * zoom + pan.y,
      };
    },
    [pan, zoom]
  );

  // Main rendering loop
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    ctx.save();
    // Apply pan and zoom
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // 1. Draw Background Pattern
    if (backgroundPattern === 'grid') {
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1 / zoom;
      const step = 40;
      const startX = Math.floor(-pan.x / zoom / step) * step - step;
      const endX = startX + width / zoom + step * 2;
      const startY = Math.floor(-pan.y / zoom / step) * step - step;
      const endY = startY + height / zoom + step * 2;

      ctx.beginPath();
      for (let x = startX; x <= endX; x += step) {
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
      }
      for (let y = startY; y <= endY; y += step) {
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
      }
      ctx.stroke();
    } else if (backgroundPattern === 'dots') {
      ctx.fillStyle = '#cbd5e1';
      const step = 32;
      const startX = Math.floor(-pan.x / zoom / step) * step - step;
      const endX = startX + width / zoom + step * 2;
      const startY = Math.floor(-pan.y / zoom / step) * step - step;
      const endY = startY + height / zoom + step * 2;

      for (let x = startX; x <= endX; x += step) {
        for (let y = startY; y <= endY; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, 1.5 / zoom, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (backgroundPattern === 'lined') {
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1 / zoom;
      const step = 36;
      const startY = Math.floor(-pan.y / zoom / step) * step - step;
      const endY = startY + height / zoom + step * 2;
      const startX = -pan.x / zoom - 100;
      const endX = startX + width / zoom + 200;

      ctx.beginPath();
      for (let y = startY; y <= endY; y += step) {
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
      }
      ctx.stroke();
    }

    // 2. Draw Whiteboard Objects
    const sorted = [...objects].sort((a, b) => a.zIndex - b.zIndex);

    for (const obj of sorted) {
      ctx.save();

      // Highlight selected object
      if (obj.id === selectedObjectId) {
        ctx.shadowColor = 'rgba(59, 130, 246, 0.4)';
        ctx.shadowBlur = 10 / zoom;
      }

      if (obj.type === 'stroke' && obj.strokeData) {
        const { points, color: strokeColor, size, opacity, tool } = obj.strokeData;
        if (points.length > 0) {
          ctx.strokeStyle = strokeColor;
          ctx.fillStyle = strokeColor;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.globalAlpha = tool === 'highlighter' ? 0.35 : opacity;

          const hasPressureData = points.some((p) => typeof p.pressure === 'number' && p.pressure > 0);

          if (points.length === 1) {
            const p = points[0];
            const pRadius = hasPressureData && p.pressure ? (size * Math.max(0.3, Math.min(2.5, p.pressure))) / 2 : size / 2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, pRadius, 0, Math.PI * 2);
            ctx.fill();
          } else if (hasPressureData) {
            // Render variable-width segments based on point pressure intensity
            for (let i = 1; i < points.length; i++) {
              const p0 = points[i - 1];
              const p1 = points[i];
              const press0 = typeof p0.pressure === 'number' ? p0.pressure : 1;
              const press1 = typeof p1.pressure === 'number' ? p1.pressure : 1;
              const avgPressure = (press0 + press1) / 2;
              const segWidth = Math.max(1, size * Math.max(0.2, Math.min(2.5, avgPressure)));

              ctx.lineWidth = segWidth;
              ctx.beginPath();
              ctx.moveTo(p0.x, p0.y);
              ctx.lineTo(p1.x, p1.y);
              ctx.stroke();
            }
          } else {
            ctx.lineWidth = size;
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
              // Smooth quadratic Bezier curve
              const xc = (points[i].x + points[i - 1].x) / 2;
              const yc = (points[i].y + points[i - 1].y) / 2;
              ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
            }
            ctx.stroke();
          }
        }
      } else if (obj.type === 'shape' && obj.shapeData) {
        const { shapeType, strokeColor, fillColor: shapeFill, strokeWidth: sWidth, opacity } = obj.shapeData;
        ctx.globalAlpha = opacity;
        ctx.strokeStyle = strokeColor;
        ctx.fillStyle = shapeFill;
        ctx.lineWidth = sWidth;

        const w = obj.width || 100;
        const h = obj.height || 100;

        if (shapeType === 'rectangle') {
          if (shapeFill !== 'transparent') ctx.fillRect(obj.x, obj.y, w, h);
          if (sWidth > 0) ctx.strokeRect(obj.x, obj.y, w, h);
        } else if (shapeType === 'circle') {
          ctx.beginPath();
          ctx.ellipse(obj.x + w / 2, obj.y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, 2 * Math.PI);
          if (shapeFill !== 'transparent') ctx.fill();
          if (sWidth > 0) ctx.stroke();
        } else if (shapeType === 'triangle') {
          ctx.beginPath();
          ctx.moveTo(obj.x + w / 2, obj.y);
          ctx.lineTo(obj.x + w, obj.y + h);
          ctx.lineTo(obj.x, obj.y + h);
          ctx.closePath();
          if (shapeFill !== 'transparent') ctx.fill();
          if (sWidth > 0) ctx.stroke();
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
      } else if (obj.type === 'text' && obj.textData && editingTextObj?.id !== obj.id) {
        const { text, fontSize, color: textColor, fontFamily, bold } = obj.textData;
        ctx.fillStyle = textColor;
        ctx.font = `${bold ? 'bold ' : ''}${fontSize}px ${fontFamily || 'sans-serif'}`;
        ctx.textBaseline = 'top';
        const lines = text.split('\n');
        lines.forEach((line, idx) => {
          ctx.fillText(line, obj.x, obj.y + idx * (fontSize * 1.3));
        });
      } else if (obj.type === 'sticky' && obj.stickyData) {
        const { text, color: stickyColor } = obj.stickyData;
        const w = obj.width || 200;
        const h = obj.height || 160;

        // Shadow & Card
        ctx.fillStyle = stickyColor;
        ctx.shadowColor = 'rgba(0,0,0,0.08)';
        ctx.shadowBlur = 6 / zoom;
        ctx.fillRect(obj.x, obj.y, w, h);
        ctx.shadowColor = 'transparent';

        // Pin border top
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        ctx.fillRect(obj.x, obj.y, w, 18);

        ctx.fillStyle = '#1e293b';
        ctx.font = '14px sans-serif';
        ctx.textBaseline = 'top';
        const lines = text.split('\n');
        lines.forEach((line, idx) => {
          ctx.fillText(line, obj.x + 12, obj.y + 26 + idx * 20, w - 24);
        });
      }

      // Selection bounding box
      if (obj.id === selectedObjectId) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([6 / zoom, 4 / zoom]);
        const w = obj.width || 120;
        const h = obj.height || 60;
        ctx.strokeRect(obj.x - 4, obj.y - 4, w + 8, h + 8);
        ctx.setLineDash([]);
      }

      ctx.restore();
    }

    // 3. Draw Active In-Progress Stroke (while pointer is dragging)
    if (isPointerDown && currentStrokePoints.current.length > 0) {
      ctx.save();
      const pts = currentStrokePoints.current;
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = currentTool === 'highlighter' ? 0.35 : 1;

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        const xc = (pts[i].x + pts[i - 1].x) / 2;
        const yc = (pts[i].y + pts[i - 1].y) / 2;
        ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, xc, yc);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 4. Draw Collaborators' Cursors
    for (const c of collaborators) {
      ctx.save();
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 6 / zoom, 0, Math.PI * 2);
      ctx.fill();

      // Name tag
      ctx.font = `${11 / zoom}px sans-serif`;
      ctx.fillStyle = '#0f172a';
      ctx.fillText(c.userName, c.x + 10 / zoom, c.y - 6 / zoom);
      ctx.restore();
    }

    // 5. Draw Remote Smartphone Laser Pointer
    if (remotePointer) {
      ctx.save();
      const { x: rx, y: ry, mode } = remotePointer;
      if (mode === 'laser') {
        // Glowing laser dot
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(rx, ry, 8 / zoom, 0, Math.PI * 2);
        ctx.fill();
      } else if (mode === 'draw') {
        // Phone writing ink indicator with dynamic pressure size
        const pressScale = typeof remotePointer.pressure === 'number' && remotePointer.pressure > 0
          ? Math.max(0.4, Math.min(2.2, remotePointer.pressure))
          : 1;
        const pointerRadius = (6 * pressScale) / zoom;
        ctx.fillStyle = '#2563eb';
        ctx.shadowColor = '#2563eb';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(rx, ry, pointerRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = `bold ${10 / zoom}px sans-serif`;
        ctx.fillStyle = '#2563eb';
        const pressPct = remotePointer.pressure ? ` (${Math.round(remotePointer.pressure * 100)}%)` : '';
        ctx.fillText(`✍️ Phone Writing${pressPct}`, rx + 10 / zoom, ry + 4 / zoom);
      } else {
        // Glowing phone cursor
        ctx.fillStyle = '#3b82f6';
        ctx.shadowColor = '#3b82f6';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(rx, ry, 7 / zoom, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = `bold ${10 / zoom}px sans-serif`;
        ctx.fillStyle = '#1d4ed8';
        ctx.fillText('Phone Remote', rx + 10 / zoom, ry + 4 / zoom);
      }
      ctx.restore();
    }

    ctx.restore();
  }, [
    objects,
    selectedObjectId,
    pan,
    zoom,
    backgroundPattern,
    isPointerDown,
    color,
    strokeWidth,
    currentTool,
    collaborators,
    remotePointer,
    editingTextObj,
  ]);

  // Handle Resize and High DPI
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
      renderCanvas();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderCanvas]);

  // Request Animation Frame continuous sync
  useEffect(() => {
    let animId: number;
    const loop = () => {
      renderCanvas();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [renderCanvas]);

  // Pointer Down
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const worldPoint = screenToWorld(e.clientX, e.clientY);

    // If canvas is read-only (e.g. student in view-only mode), only panning is allowed
    if (readOnly) {
      if (currentTool === 'pan' || e.button === 0 || e.button === 1 || e.buttons === 4) {
        isPanning.current = true;
        panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      }
      return;
    }

    // Pan mode or middle-click or spacebar
    if (currentTool === 'pan' || e.button === 1 || e.buttons === 4) {
      isPanning.current = true;
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }

    setIsPointerDown(true);

    // 1. Select Tool: Check if user clicked an existing object
    if (currentTool === 'select') {
      const clicked = [...objects].reverse().find((obj) => {
        const w = obj.width || 120;
        const h = obj.height || 60;
        return (
          worldPoint.x >= obj.x &&
          worldPoint.x <= obj.x + w &&
          worldPoint.y >= obj.y &&
          worldPoint.y <= obj.y + h
        );
      });

      if (clicked) {
        onSelectObject(clicked.id);
        draggingObjectId.current = clicked.id;
        dragOffset.current = {
          x: worldPoint.x - clicked.x,
          y: worldPoint.y - clicked.y,
        };
      } else {
        onSelectObject(null);
      }
      return;
    }

    // 2. Eraser Tool: Delete clicked object
    if (currentTool === 'eraser') {
      const clicked = [...objects].reverse().find((obj) => {
        if (obj.type === 'stroke' && obj.strokeData) {
          return obj.strokeData.points.some(
            (p) => Math.hypot(p.x - worldPoint.x, p.y - worldPoint.y) < 18
          );
        }
        const w = obj.width || 100;
        const h = obj.height || 60;
        return (
          worldPoint.x >= obj.x &&
          worldPoint.x <= obj.x + w &&
          worldPoint.y >= obj.y &&
          worldPoint.y <= obj.y + h
        );
      });
      if (clicked) {
        onDeleteObject(clicked.id);
      }
      return;
    }

    // 3. Text Tool: Create new text object or edit
    if (currentTool === 'text') {
      const newTextObj: WhiteboardObject = {
        id: `text-${Date.now()}`,
        pageId: currentPageId,
        type: 'text',
        x: worldPoint.x,
        y: worldPoint.y,
        zIndex: objects.length + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        textData: {
          text: 'Type text here',
          fontSize: 20,
          color,
          fontFamily: 'sans-serif',
        },
      };
      onAddObject(newTextObj);
      setEditingTextObj({
        id: newTextObj.id,
        x: worldPoint.x,
        y: worldPoint.y,
        text: 'Type text here',
      });
      return;
    }

    // 4. Sticky Note Tool: Create new sticky note
    if (currentTool === 'sticky') {
      const newSticky: WhiteboardObject = {
        id: `sticky-${Date.now()}`,
        pageId: currentPageId,
        type: 'sticky',
        x: worldPoint.x,
        y: worldPoint.y,
        width: 200,
        height: 150,
        zIndex: objects.length + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stickyData: {
          color: '#fef08a', // default sunny yellow
          text: 'Double click to edit note',
        },
      };
      onAddObject(newSticky);
      return;
    }

    // 5. Drawing & Shape Tools
    startDragPoint.current = worldPoint;
    currentStrokePoints.current = [worldPoint];
  };

  // Pointer Move
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const worldPoint = screenToWorld(e.clientX, e.clientY);

    // Pan dragging
    if (isPanning.current) {
      onPanChange({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y,
      });
      return;
    }

    if (!isPointerDown) return;

    // Moving selected object
    if (currentTool === 'select' && draggingObjectId.current) {
      const target = objects.find((o) => o.id === draggingObjectId.current);
      if (target) {
        onUpdateObject({
          ...target,
          x: worldPoint.x - dragOffset.current.x,
          y: worldPoint.y - dragOffset.current.y,
        });
      }
      return;
    }

    // Continuous eraser sweep
    if (currentTool === 'eraser') {
      const hit = objects.find((obj) => {
        if (obj.type === 'stroke' && obj.strokeData) {
          return obj.strokeData.points.some(
            (p) => Math.hypot(p.x - worldPoint.x, p.y - worldPoint.y) < 18
          );
        }
        return false;
      });
      if (hit) onDeleteObject(hit.id);
      return;
    }

    // Pen / Pencil / Highlighter
    if (['pen', 'pencil', 'highlighter'].includes(currentTool)) {
      currentStrokePoints.current.push({
        x: worldPoint.x,
        y: worldPoint.y,
        pressure: e.pressure,
      });
    }
  };

  // Pointer Up
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);

    if (isPanning.current) {
      isPanning.current = false;
      return;
    }

    if (!isPointerDown) return;
    setIsPointerDown(false);

    const worldPoint = screenToWorld(e.clientX, e.clientY);

    if (currentTool === 'select') {
      draggingObjectId.current = null;
      return;
    }

    // Finalize freehand stroke
    if (['pen', 'pencil', 'highlighter'].includes(currentTool)) {
      if (currentStrokePoints.current.length > 0) {
        const strokeObj: WhiteboardObject = {
          id: `stroke-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          pageId: currentPageId,
          type: 'stroke',
          x: currentStrokePoints.current[0].x,
          y: currentStrokePoints.current[0].y,
          zIndex: objects.length + 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          strokeData: {
            points: [...currentStrokePoints.current],
            color,
            size: strokeWidth,
            opacity: currentTool === 'highlighter' ? 0.35 : 1,
            tool: currentTool as 'pen' | 'pencil' | 'highlighter',
          },
        };
        onAddObject(strokeObj);
      }
      currentStrokePoints.current = [];
      return;
    }

    // Finalize Shapes (Rectangle, Circle, Triangle, Line, Arrow)
    if (['rectangle', 'circle', 'triangle', 'line', 'arrow'].includes(currentTool) && startDragPoint.current) {
      const start = startDragPoint.current;
      const w = worldPoint.x - start.x;
      const h = worldPoint.y - start.y;

      // Minimum threshold so single accidental click doesn't produce zero-size shape
      if (Math.abs(w) > 5 || Math.abs(h) > 5) {
        const shapeObj: WhiteboardObject = {
          id: `shape-${Date.now()}`,
          pageId: currentPageId,
          type: 'shape',
          x: Math.min(start.x, worldPoint.x),
          y: Math.min(start.y, worldPoint.y),
          width: Math.abs(w),
          height: Math.abs(h),
          zIndex: objects.length + 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          shapeData: {
            shapeType: currentTool as any,
            strokeColor: color,
            fillColor,
            strokeWidth,
            strokeStyle: 'solid',
            opacity: 1,
          },
        };
        onAddObject(shapeObj);
      }
      startDragPoint.current = null;
      currentStrokePoints.current = [];
    }
  };

  // Zoom with Wheel
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.2), 5);

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Zoom towards mouse pointer
      const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
      const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

      onZoomChange(newZoom);
      onPanChange({ x: newPanX, y: newPanY });
    } else {
      // Pan
      onPanChange({
        x: pan.x - e.deltaX,
        y: pan.y - e.deltaY,
      });
    }
  };

  // Double click for sticky notes or text inline editing
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    const worldPoint = screenToWorld(e.clientX, e.clientY);
    const hitSticky = objects.find(
      (o) =>
        o.type === 'sticky' &&
        worldPoint.x >= o.x &&
        worldPoint.x <= o.x + (o.width || 200) &&
        worldPoint.y >= o.y &&
        worldPoint.y <= o.y + (o.height || 150)
    );

    if (hitSticky && hitSticky.stickyData) {
      const newText = prompt('Edit note text:', hitSticky.stickyData.text);
      if (newText !== null) {
        onUpdateObject({
          ...hitSticky,
          stickyData: { ...hitSticky.stickyData, text: newText },
        });
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-white select-none">
      {/* View-Only Indicator Banner */}
      {readOnly && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 bg-amber-600/90 text-white rounded-full shadow-lg backdrop-blur-sm text-xs font-semibold flex items-center gap-2 pointer-events-none border border-amber-400/40">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
          <span>View-Only Mode: Teacher has paused student drawing. You can pan, zoom, and take personal study notes.</span>
        </div>
      )}

      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        className={`w-full h-full touch-none block ${
          currentTool === 'pan' ? 'cursor-grab active:cursor-grabbing' : currentTool === 'select' ? 'cursor-default' : 'cursor-crosshair'
        }`}
      />

      {/* Inline Text Editor Overlay */}
      {editingTextObj && (
        <div
          style={{
            position: 'absolute',
            left: `${worldToScreen(editingTextObj.x, editingTextObj.y).x}px`,
            top: `${worldToScreen(editingTextObj.x, editingTextObj.y).y}px`,
            zIndex: 40,
          }}
        >
          <input
            type="text"
            autoFocus
            defaultValue={editingTextObj.text}
            onBlur={(e) => {
              const target = objects.find((o) => o.id === editingTextObj.id);
              if (target && target.textData) {
                onUpdateObject({
                  ...target,
                  textData: { ...target.textData, text: e.target.value },
                });
              }
              setEditingTextObj(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            className="border-2 border-blue-500 bg-white/95 px-2 py-1 rounded text-lg outline-none shadow-lg min-w-[140px]"
          />
        </div>
      )}
    </div>
  );
};
