/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Smartphone,
  Share2,
  Download,
  Settings,
  Sparkles,
  ArrowLeft,
  Check,
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Edit2,
  Wifi,
  WifiOff,
  ChevronDown,
  FileImage,
  FileCode,
  Copy,
  Activity,
} from 'lucide-react';
import {
  Whiteboard,
  WhiteboardObject,
  ToolType,
  BackgroundPattern,
  MathSolution,
  CollaboratorCursor,
} from '../../types/whiteboard';
import { WhiteboardCanvas } from './WhiteboardCanvas';
import { WhiteboardToolbar } from './WhiteboardToolbar';
import { ToolSettings } from './ToolSettings';
import { EquationOverlay } from './EquationOverlay';
import { AIAssistantPanel } from './AIAssistantPanel';
import { PageNavigator } from './PageNavigator';
import { ConnectPhoneModal } from '../remote/ConnectPhoneModal';
import { ShareModal } from '../collaboration/ShareModal';
import { ExportModal } from '../export/ExportModal';
import { SettingsModal } from '../settings/SettingsModal';
import { DiagnosticPanel } from './DiagnosticPanel';
import { OfflineIndicator } from '../pwa/OfflineIndicator';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { subscribeToSyncEvents } from '../../services/offlineSync';
import { api } from '../../services/api';
import { socket } from '../../services/socket';
import { exportToPNG, exportToSVG, copyCanvasToClipboard } from '../../utils/export';

interface WhiteboardEditorProps {
  boardId: string;
  onBackToDashboard: () => void;
}

export const WhiteboardEditor: React.FC<WhiteboardEditorProps> = ({
  boardId,
  onBackToDashboard,
}) => {
  const [board, setBoard] = useState<Whiteboard | null>(null);
  const [currentPageId, setCurrentPageId] = useState<string>('');
  const [currentTool, setCurrentTool] = useState<ToolType>('pen');
  const [color, setColor] = useState<string>('#0f172a');
  const [strokeWidth, setStrokeWidth] = useState<number>(4);
  const [fillColor, setFillColor] = useState<string>('transparent');
  const [backgroundPattern, setBackgroundPattern] = useState<BackgroundPattern>('grid');
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  // Canvas Pan & Zoom
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // History Undo / Redo
  const [history, setHistory] = useState<Record<string, WhiteboardObject[]>[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Auto-Save Status
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'offline'>('saved');
  const saveTimeout = useRef<any>(null);

  // Modals & Panels
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [selectedEquationForAI, setSelectedEquationForAI] = useState<WhiteboardObject | null>(null);

  // Floating feedback toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<any>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  }, []);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    if (isExportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExportMenuOpen]);

  // Quick direct exports
  const handleQuickExportPNG = useCallback(() => {
    if (!board) return;
    const page = board.pages.find((p) => p.id === currentPageId) || board.pages[0];
    const objects = board.objects[currentPageId] || [];
    exportToPNG(board.title, page.title, objects, page, {
      resolution: 2,
      transparentBackground: false,
      includeGrid: true,
      autoCrop: true,
    });
    showToast(`Downloaded ${page.title}.png (2x HD)`);
    setIsExportMenuOpen(false);
  }, [board, currentPageId, showToast]);

  const handleQuickExportSVG = useCallback(() => {
    if (!board) return;
    const page = board.pages.find((p) => p.id === currentPageId) || board.pages[0];
    exportToSVG(board, currentPageId, {
      transparentBackground: false,
      includeGrid: true,
      autoCrop: true,
    });
    showToast(`Downloaded ${page.title}.svg (Vector)`);
    setIsExportMenuOpen(false);
  }, [board, currentPageId, showToast]);

  const handleQuickCopyClipboard = useCallback(async () => {
    if (!board) return;
    const page = board.pages.find((p) => p.id === currentPageId) || board.pages[0];
    const objects = board.objects[currentPageId] || [];
    const success = await copyCanvasToClipboard(objects, page, {
      resolution: 2,
      transparentBackground: false,
      includeGrid: true,
      autoCrop: true,
    });
    if (success) {
      showToast('Canvas image copied to clipboard! (Ctrl+V)');
    } else {
      exportToPNG(board.title, page.title, objects, page, { resolution: 2 });
      showToast('Clipboard unavailable, downloaded PNG instead');
    }
    setIsExportMenuOpen(false);
  }, [board, currentPageId, showToast]);

  // Real-time Collaborators & Remote Phone
  const [collaborators, setCollaborators] = useState<CollaboratorCursor[]>([]);
  const [remotePointer, setRemotePointer] = useState<{
    x: number;
    y: number;
    isDown: boolean;
    mode: 'move' | 'draw' | 'laser';
    pressure?: number;
  } | null>(null);
  const [isPhoneConnected, setIsPhoneConnected] = useState(false);
  const [isRemoteTransmitting, setIsRemoteTransmitting] = useState(false);
  const [pairedSessionId, setPairedSessionId] = useState<string | null>(null);
  const [activePasscode, setActivePasscode] = useState<string | null>(null);
  const [isDiagnosticPanelOpen, setIsDiagnosticPanelOpen] = useState(false);
  const transmitTimerRef = useRef<any>(null);

  const markTransmissionActive = useCallback(() => {
    setIsPhoneConnected(true);
    setIsRemoteTransmitting(true);
    if (transmitTimerRef.current) clearTimeout(transmitTimerRef.current);
    transmitTimerRef.current = setTimeout(() => {
      setIsRemoteTransmitting(false);
    }, 350);
  }, []);

  // Active remote drawing stroke
  const remoteStrokeId = useRef<string | null>(null);
  const currentPageIdRef = useRef(currentPageId);
  currentPageIdRef.current = currentPageId;
  const boardRef = useRef(board);
  boardRef.current = board;

  // 1. Load Board
  useEffect(() => {
    let mounted = true;
    api
      .getBoard(boardId)
      .then((data) => {
        if (!mounted) return;
        setBoard(data);
        const firstPageId = data.pages[0]?.id || '';
        setCurrentPageId(firstPageId);
        setBackgroundPattern(data.pages[0]?.background || 'grid');
        setHistory([data.objects]);
        setHistoryIndex(0);
      })
      .catch((err) => {
        console.error('Failed to load board:', err);
      });

    return () => {
      mounted = false;
    };
  }, [boardId]);

  // Logging helper for WhiteboardEditor connection events & heartbeat tracking
  const logWhiteboard = useCallback((level: 'info' | 'warn' | 'error' | 'debug', msg: string, data?: any) => {
    const time = new Date().toLocaleTimeString();
    const prefix = `[WhiteboardEditor @ ${time}]`;
    if (level === 'error') {
      console.error(`${prefix} ${msg}`, data !== undefined ? data : '');
    } else if (level === 'warn') {
      console.warn(`${prefix} ${msg}`, data !== undefined ? data : '');
    } else if (level === 'debug') {
      console.debug(`${prefix} ${msg}`, data !== undefined ? data : '');
    } else {
      console.info(`${prefix} ${msg}`, data !== undefined ? data : '');
    }
  }, []);

  // 2. Setup Real-time WebSocket connection to Board Room
  useEffect(() => {
    const userColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    const randomColor = userColors[Math.floor(Math.random() * userColors.length)];

    logWhiteboard('info', '🚀 Initializing real-time board session...', {
      boardId,
      isVercel: typeof window !== 'undefined' && window.location.hostname.includes('vercel.app'),
      origin: typeof window !== 'undefined' ? window.location.origin : '',
    });

    socket.joinBoard(boardId, {
      name: `User-${Math.floor(Math.random() * 900 + 100)}`,
      color: randomColor,
    });

    // Check and auto-bind active remote session if one already exists for this board, or provision one immediately
    api
      .getActiveSessionForBoard(boardId)
      .then((active) => {
        if (active) {
          logWhiteboard('info', 'Found existing active remote session for board:', active);
          setPairedSessionId(active.sessionId);
          setActivePasscode(active.passcode);
          socket.bindRemote(active.sessionId, 'display', active.passcode);
          if (active.connectedControllers > 0) {
            setIsPhoneConnected(true);
          }
        } else {
          // Provision a session immediately so WebRTC host peer is always listening!
          api
            .createRemoteSession(boardId)
            .then((newSess) => {
              logWhiteboard('info', 'Auto-created remote pairing session for board:', newSess);
              setPairedSessionId(newSess.sessionId);
              setActivePasscode(newSess.passcode);
              socket.bindRemote(newSess.sessionId, 'display', newSess.passcode);
            })
            .catch((e) => {
              logWhiteboard('debug', 'Local pairing fallback ready:', e?.message || e);
            });
        }
      })
      .catch(() => {
        api
          .createRemoteSession(boardId)
          .then((newSess) => {
            setPairedSessionId(newSess.sessionId);
            setActivePasscode(newSess.passcode);
            socket.bindRemote(newSess.sessionId, 'display', newSess.passcode);
          })
          .catch(() => {});
      });

    // WebRTC Host Lifecycle Tracking
    const unsubP2PHostInit = socket.on('p2p:init_host', (data) => {
      logWhiteboard('info', '🌐 Registering WebRTC Host Peer for phone pairing:', data);
    });

    const unsubP2PHostReady = socket.on('p2p:host_ready', (data) => {
      logWhiteboard('info', '✅ WebRTC Host Peer ready for smartphone connection:', data);
    });

    const unsubP2PIncoming = socket.on('p2p:incoming_connection', (data) => {
      logWhiteboard('info', '📱 Smartphone attempting P2P connection...', data);
    });

    const unsubP2PSuccess = socket.on('p2p:handshake_success', (data) => {
      logWhiteboard('info', '🎉 Smartphone paired via WebRTC P2P DataChannel! Low-latency touch input active.', data);
    });

    const unsubP2PClosed = socket.on('p2p:connection_closed', (data) => {
      logWhiteboard('warn', '⚠️ Smartphone WebRTC DataChannel closed:', data);
    });

    const unsubP2PError = socket.on('p2p:connection_error', (data) => {
      logWhiteboard('error', '❌ Smartphone WebRTC DataChannel error:', data);
    });

    const unsubP2PHostError = socket.on('p2p:host_error', (data) => {
      logWhiteboard('warn', '⚠️ WebRTC PeerJS Host warning/error:', data);
    });

    // Socket.IO Connection & Heartbeat Tracking
    const unsubSocketConnect = socket.on('socket:connect', (data) => {
      logWhiteboard('info', '🟢 Socket.IO connected to server:', data);
    });

    const unsubSocketHeartbeat = socket.on('socket:heartbeat', (data) => {
      logWhiteboard('debug', '💓 Socket.IO Heartbeat packet:', data);
    });

    const unsubSocketError = socket.on('socket:error', (data) => {
      logWhiteboard('warn', '⚠️ Socket.IO connection error (if on Vercel, serverless functions do not keep persistent WebSockets; WebRTC P2P direct channels will handle smartphone events):', data);
    });

    const unsubSocketDisconnect = socket.on('socket:disconnect', (data) => {
      logWhiteboard('warn', '🔌 Socket.IO disconnected:', data);
    });

    const unsubCursor = socket.on('board:cursor', (data) => {
      setCollaborators((prev) => {
        const filtered = prev.filter((c) => c.userId !== data.userId);
        return [
          ...filtered,
          {
            userId: data.userId,
            userName: data.userName,
            color: data.color,
            x: data.x,
            y: data.y,
            lastUpdated: Date.now(),
          },
        ];
      });
    });

    const unsubPaired = socket.on('remote:phone_paired', (data) => {
      setIsPhoneConnected(true);
      if (data?.sessionId) setPairedSessionId(data.sessionId);
      logWhiteboard('info', '📱 Smartphone remote paired notification received:', data);
      showToast('📱 Smartphone Remote Paired! Touchpad writing active.');
    });

    const unsubDisconnected = socket.on('remote:phone_disconnected', () => {
      setIsPhoneConnected(false);
      logWhiteboard('warn', '📱 Smartphone remote disconnected notification received');
      showToast('📱 Smartphone Remote Disconnected');
    });

    const unsubStatus = socket.on('remote:status', (data) => {
      logWhiteboard('debug', 'Remote status update:', data);
      if (data?.isPaired !== undefined) {
        setIsPhoneConnected(data.isPaired);
      }
      if (data?.sessionId) {
        setPairedSessionId(data.sessionId);
      }
    });

    // Remote phone pointer movements
    const unsubPointer = socket.on('remote:pointer', (data) => {
      markTransmissionActive();
      setRemotePointer({
        x: data.x,
        y: data.y,
        isDown: data.isDown,
        mode: data.mode || 'move',
        pressure: data.pressure,
      });
    });

    // Remote phone drawing onto laptop canvas!
    const unsubStrokeStart = socket.on('remote:stroke_start', (data) => {
      markTransmissionActive();
      logWhiteboard('debug', '✍️ Incoming remote touch stroke start:', { x: data.x, y: data.y, tool: data.tool, color: data.color, pressure: data.pressure });
      const newId = `remote-stroke-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      remoteStrokeId.current = newId;
      const targetPg = currentPageIdRef.current;
      const initialPressure = typeof data.pressure === 'number' ? data.pressure : 1;
      const strokeObj: WhiteboardObject = {
        id: newId,
        pageId: targetPg,
        type: 'stroke',
        x: data.x,
        y: data.y,
        zIndex: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        strokeData: {
          points: [{ x: data.x, y: data.y, pressure: initialPressure }],
          color: data.color || '#2563eb',
          size: data.size || 5,
          opacity: 1,
          tool: (data.tool as any) || 'pen',
        },
      };

      setBoard((prev) => {
        if (!prev) return prev;
        const currentObjs = prev.objects[targetPg] || [];
        return {
          ...prev,
          objects: {
            ...prev.objects,
            [targetPg]: [...currentObjs, strokeObj],
          },
        };
      });

      setRemotePointer({
        x: data.x,
        y: data.y,
        isDown: true,
        mode: 'draw',
        pressure: data.pressure,
      });
    });

    const unsubStrokePoint = socket.on('remote:stroke_point', (data) => {
      markTransmissionActive();
      if (!remoteStrokeId.current) return;
      const sid = remoteStrokeId.current;
      const targetPg = currentPageIdRef.current;
      const pointPressure = typeof data.pressure === 'number' ? data.pressure : 1;

      setBoard((prev) => {
        if (!prev) return prev;
        const currentObjs = prev.objects[targetPg] || [];
        const updatedObjs = currentObjs.map((obj) => {
          if (obj.id === sid && obj.strokeData) {
            return {
              ...obj,
              strokeData: {
                ...obj.strokeData,
                points: [...obj.strokeData.points, { x: data.x, y: data.y, pressure: pointPressure }],
              },
            };
          }
          return obj;
        });
        return {
          ...prev,
          objects: { ...prev.objects, [targetPg]: updatedObjs },
        };
      });

      setRemotePointer({
        x: data.x,
        y: data.y,
        isDown: true,
        mode: 'draw',
        pressure: data.pressure,
      });
    });

    const unsubStrokeEnd = socket.on('remote:stroke_end', () => {
      logWhiteboard('debug', '✍️ Incoming remote touch stroke completed');
      remoteStrokeId.current = null;
      if (boardRef.current) {
        queueAutoSave(boardRef.current);
      }
      setTimeout(() => {
        setRemotePointer((prev) => (prev ? { ...prev, isDown: false } : null));
      }, 300);
    });

    // Remote Phone Solves Math Equation!
    const unsubEquationSolve = socket.on('remote:equation_solve', (data) => {
      logWhiteboard('info', '📐 Remote phone requested math equation solution:', data);
      const targetPg = currentPageIdRef.current;
      const expr = data.rawExpression;
      if (!expr) return;

      const newEqObj: WhiteboardObject = {
        id: `eq-${Date.now()}`,
        pageId: targetPg,
        type: 'equation',
        x: 220,
        y: 160,
        width: 380,
        height: 140,
        zIndex: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        equationData: {
          rawExpression: expr,
          latex: data.solution?.latex || expr,
          status: data.solution ? 'solved' : 'idle',
          solution: data.solution,
        },
      };

      handleAddObject(newEqObj);
      if (!data.solution) {
        handleSolveEquation(newEqObj);
      }
    });

    // Remote Phone Actions
    const unsubAction = socket.on('remote:action', (data) => {
      logWhiteboard('info', '📱 Remote phone action triggered:', data.action);
      if (data.action === 'undo') handleUndo();
      else if (data.action === 'redo') handleRedo();
      else if (data.action === 'zoom_in') setZoom((z) => Math.min(z * 1.2, 5));
      else if (data.action === 'zoom_out') setZoom((z) => Math.max(z / 1.2, 0.2));
      else if (data.action === 'zoom_reset') {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      } else if (data.action === 'add_page') {
        handleAddPage();
      } else if (data.action === 'clear') {
        handleClearPage();
      }
    });

    const unsubToolChange = socket.on('remote:tool_change', (data) => {
      logWhiteboard('info', '📱 Remote phone tool change:', data);
      if (data.tool) setCurrentTool(data.tool);
      if (data.color) setColor(data.color);
    });

    // Periodic Heartbeat Status Logger (every 15s) to console
    const heartbeatInterval = setInterval(() => {
      const diag = socket.getDiagnostics();
      logWhiteboard('info', '💓 Socket & P2P Heartbeat Status Check:', {
        status: diag.connectionStatus,
        socketIO: diag.socketIO,
        webRTC: diag.webRTC,
        isVercel: diag.isVercel,
        timeSinceLastHeartbeatMs: Date.now() - diag.lastHeartbeatTime,
      });
    }, 15000);

    return () => {
      clearInterval(heartbeatInterval);
      unsubP2PHostInit();
      unsubP2PHostReady();
      unsubP2PIncoming();
      unsubP2PSuccess();
      unsubP2PClosed();
      unsubP2PError();
      unsubP2PHostError();
      unsubSocketConnect();
      unsubSocketHeartbeat();
      unsubSocketError();
      unsubSocketDisconnect();
      unsubCursor();
      unsubPaired();
      unsubDisconnected();
      unsubStatus();
      unsubPointer();
      unsubStrokeStart();
      unsubStrokePoint();
      unsubStrokeEnd();
      unsubEquationSolve();
      unsubAction();
      unsubToolChange();
    };
  }, [boardId, markTransmissionActive, showToast, logWhiteboard]);

  // 3. Auto-save handler
  const queueAutoSave = useCallback((updatedBoard: Whiteboard) => {
    setSaveStatus('saving');
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      api
        .updateBoard(updatedBoard.id, {
          title: updatedBoard.title,
          pages: updatedBoard.pages,
          objects: updatedBoard.objects,
        })
        .then(() => {
          setSaveStatus('saved');
        })
        .catch((err) => {
          console.warn('Auto-save error:', err);
          setSaveStatus('offline');
        });
    }, 600);
  }, []);

  // Offline / Online Intermittent Drops Auto-Sync Handler
  const isOnline = useOnlineStatus();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleManualSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const count = await api.syncPendingOfflineUpdates();
      if (count > 0) {
        setSaveStatus('saved');
        showToast(`Synced ${count} cached updates with server!`);
      } else {
        setSaveStatus('saved');
      }
    } catch (err) {
      console.warn('[WhiteboardEditor] Offline queue sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [showToast]);

  useEffect(() => {
    const unsub = subscribeToSyncEvents((event) => {
      if (event === 'online') {
        handleManualSync();
      } else if (event === 'offline') {
        setSaveStatus('offline');
      }
    });

    if (isOnline && saveStatus === 'offline') {
      handleManualSync();
    }

    return () => unsub();
  }, [isOnline, saveStatus, handleManualSync]);

  // Update object state + push to history
  const updateObjectsWithHistory = useCallback(
    (newObjectsMap: Record<string, WhiteboardObject[]>) => {
      if (!board) return;

      const newBoard: Whiteboard = {
        ...board,
        objects: newObjectsMap,
        updatedAt: new Date().toISOString(),
      };

      setBoard(newBoard);
      queueAutoSave(newBoard);

      // Record in undo/redo stack
      const nextHistory = history.slice(0, historyIndex + 1);
      nextHistory.push(newObjectsMap);
      setHistory(nextHistory);
      setHistoryIndex(nextHistory.length - 1);
    },
    [board, history, historyIndex, queueAutoSave]
  );

  // Object Mutations
  const handleAddObject = useCallback(
    (newObj: WhiteboardObject) => {
      if (!board) return;
      const currentObjs = board.objects[currentPageId] || [];
      const updatedObjs = [...currentObjs, newObj];
      const newMap = { ...board.objects, [currentPageId]: updatedObjs };
      updateObjectsWithHistory(newMap);

      // Broadcast to room
      socket.send({
        type: 'board:object_create',
        pageId: currentPageId,
        object: newObj,
      });
    },
    [board, currentPageId, updateObjectsWithHistory]
  );

  const handleUpdateObject = useCallback(
    (updatedObj: WhiteboardObject) => {
      if (!board) return;
      const currentObjs = board.objects[currentPageId] || [];
      const updatedObjs = currentObjs.map((o) => (o.id === updatedObj.id ? updatedObj : o));
      const newMap = { ...board.objects, [currentPageId]: updatedObjs };
      updateObjectsWithHistory(newMap);

      socket.send({
        type: 'board:object_update',
        pageId: currentPageId,
        object: updatedObj,
      });
    },
    [board, currentPageId, updateObjectsWithHistory]
  );

  const handleDeleteObject = useCallback(
    (id: string) => {
      if (!board) return;
      const currentObjs = board.objects[currentPageId] || [];
      const updatedObjs = currentObjs.filter((o) => o.id !== id);
      const newMap = { ...board.objects, [currentPageId]: updatedObjs };
      updateObjectsWithHistory(newMap);

      socket.send({
        type: 'board:object_delete',
        pageId: currentPageId,
        objectId: id,
      });
    },
    [board, currentPageId, updateObjectsWithHistory]
  );

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0 && board) {
      const prevObjects = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      const updatedBoard = { ...board, objects: prevObjects };
      setBoard(updatedBoard);
      queueAutoSave(updatedBoard);
    }
  }, [historyIndex, history, board, queueAutoSave]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1 && board) {
      const nextObjects = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      const updatedBoard = { ...board, objects: nextObjects };
      setBoard(updatedBoard);
      queueAutoSave(updatedBoard);
    }
  }, [historyIndex, history, board, queueAutoSave]);

  const handleClearPage = useCallback(() => {
    if (!board) return;
    if (confirm('Clear all drawings and items on this page?')) {
      const newMap = { ...board.objects, [currentPageId]: [] };
      updateObjectsWithHistory(newMap);
    }
  }, [board, currentPageId, updateObjectsWithHistory]);

  // Mathematics Actions
  const handleSolveEquation = async (equationObj: WhiteboardObject) => {
    if (!equationObj.equationData) return;

    // Set solving status
    handleUpdateObject({
      ...equationObj,
      equationData: { ...equationObj.equationData, status: 'solving' },
    });

    try {
      const solution = await api.solveEquation(equationObj.equationData.rawExpression);
      handleUpdateObject({
        ...equationObj,
        equationData: {
          ...equationObj.equationData,
          solution,
          latex: solution.latex || equationObj.equationData.rawExpression,
          status: 'solved',
        },
      });
    } catch (err: any) {
      handleUpdateObject({
        ...equationObj,
        equationData: {
          ...equationObj.equationData,
          status: 'error',
          errorMessage: 'Could not solve equation.',
        },
      });
    }
  };

  const handleExplainEquation = (equationObj: WhiteboardObject) => {
    setSelectedEquationForAI(equationObj);
    setIsAIPanelOpen(true);
  };

  // Insert AI Solution directly onto the Whiteboard canvas as editable objects
  const handleInsertSolutionOntoCanvas = (
    equationObj: WhiteboardObject,
    solution: MathSolution
  ) => {
    if (!board) return;

    const currentObjs = board.objects[currentPageId] || [];
    const newItems: WhiteboardObject[] = [];

    let currentY = equationObj.y + (equationObj.height || 140) + 20;

    // 1. Solution Answer Banner Box
    newItems.push({
      id: `solution-answer-${Date.now()}`,
      pageId: currentPageId,
      type: 'sticky',
      x: equationObj.x,
      y: currentY,
      width: 380,
      height: 90,
      zIndex: currentObjs.length + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stickyData: {
        color: '#dbeafe', // crisp light blue
        text: `Final Answer:\n${solution.solution}`,
      },
    });

    currentY += 110;

    // 2. Individual Step Sticky Cards
    solution.steps.forEach((step, idx) => {
      newItems.push({
        id: `solution-step-${Date.now()}-${idx}`,
        pageId: currentPageId,
        type: 'sticky',
        x: equationObj.x,
        y: currentY,
        width: 380,
        height: 100,
        zIndex: currentObjs.length + 2 + idx,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stickyData: {
          color: '#f8fafc',
          text: `Step ${step.stepNumber}: ${step.expression}\n${step.explanation}`,
        },
      });
      currentY += 115;
    });

    const newMap = { ...board.objects, [currentPageId]: [...currentObjs, ...newItems] };
    updateObjectsWithHistory(newMap);
  };

  // Equation Recognition Trigger
  const handleRecognizeEquationPrompt = async () => {
    const expr = prompt('Enter or write a mathematical equation (e.g. 2x + 5 = 15 or x² - 5x + 6 = 0):', '2x + 5 = 15');
    if (!expr) return;

    const newEqObj: WhiteboardObject = {
      id: `eq-${Date.now()}`,
      pageId: currentPageId,
      type: 'equation',
      x: 200,
      y: 150,
      width: 380,
      height: 140,
      zIndex: (board?.objects[currentPageId]?.length || 0) + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      equationData: {
        rawExpression: expr,
        latex: expr,
        status: 'idle',
      },
    };

    handleAddObject(newEqObj);
    handleSolveEquation(newEqObj);
  };

  // Page Operations
  const handleAddPage = () => {
    if (!board) return;
    const newPageId = `page-${Date.now()}`;
    const newPage = {
      id: newPageId,
      title: `Page ${board.pages.length + 1}`,
      order: board.pages.length,
      background: 'grid' as BackgroundPattern,
      createdAt: new Date().toISOString(),
    };
    const updatedBoard = {
      ...board,
      pages: [...board.pages, newPage],
      objects: { ...board.objects, [newPageId]: [] },
    };
    setBoard(updatedBoard);
    setCurrentPageId(newPageId);
    queueAutoSave(updatedBoard);
  };

  const handleDuplicatePage = (id: string) => {
    if (!board) return;
    const targetPage = board.pages.find((p) => p.id === id);
    if (!targetPage) return;

    const newPageId = `page-${Date.now()}`;
    const duplicatedPage = {
      ...targetPage,
      id: newPageId,
      title: `${targetPage.title} (Copy)`,
      order: board.pages.length,
    };
    const clonedObjects = JSON.parse(JSON.stringify(board.objects[id] || []));

    const updatedBoard = {
      ...board,
      pages: [...board.pages, duplicatedPage],
      objects: { ...board.objects, [newPageId]: clonedObjects },
    };
    setBoard(updatedBoard);
    setCurrentPageId(newPageId);
    queueAutoSave(updatedBoard);
  };

  const handleDeletePage = (id: string) => {
    if (!board || board.pages.length <= 1) return;
    const remainingPages = board.pages.filter((p) => p.id !== id);
    const updatedBoard = {
      ...board,
      pages: remainingPages,
    };
    setBoard(updatedBoard);
    setCurrentPageId(remainingPages[0].id);
    queueAutoSave(updatedBoard);
  };

  const handleRenamePage = (id: string, newTitle: string) => {
    if (!board) return;
    const updatedPages = board.pages.map((p) => (p.id === id ? { ...p, title: newTitle } : p));
    const updatedBoard = { ...board, pages: updatedPages };
    setBoard(updatedBoard);
    queueAutoSave(updatedBoard);
  };

  if (!board) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-3 text-slate-500 text-sm">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span>Loading whiteboard session...</span>
      </div>
    );
  }

  const currentObjects = board.objects[currentPageId] || [];
  const currentEquations = currentObjects.filter((o) => o.type === 'equation');

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col bg-slate-100 font-sans">
      {/* Top Navigation Bar */}
      <header className="h-14 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 flex items-center justify-between shrink-0 z-20">
        {/* Left: Back to Dashboard & Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={board.title}
              onChange={(e) => {
                const updated = { ...board, title: e.target.value };
                setBoard(updated);
                queueAutoSave(updated);
              }}
              className="text-base font-bold text-slate-900 bg-transparent hover:bg-slate-50 focus:bg-white px-2 py-0.5 rounded border border-transparent focus:border-slate-300 outline-none transition-colors max-w-xs md:max-w-md truncate"
            />

            {/* Save Status */}
            <div className="flex items-center gap-1 text-xs text-slate-400 pl-2">
              {saveStatus === 'saving' ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                  <span>Saving...</span>
                </>
              ) : saveStatus === 'saved' ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-700 font-medium">Saved</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-amber-500" />
                  <span className="text-amber-700">Offline</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Center: Zoom Controls */}
        <div className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-mono">
          <button
            onClick={() => setZoom((z) => Math.max(z / 1.15, 0.2))}
            className="p-1 hover:bg-white rounded transition-colors text-slate-600"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="px-2 py-0.5 hover:bg-white rounded transition-colors text-slate-700 font-semibold"
            title="Reset 100%"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(z * 1.15, 5))}
            className="p-1 hover:bg-white rounded transition-colors text-slate-600"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Real-time Smartphone Touchpad Connection Status Indicator */}
          <button
            onClick={() => setIsPhoneModalOpen(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer border ${
              isPhoneConnected
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-400/20 hover:bg-emerald-100'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
            }`}
            title={
              isPhoneConnected
                ? 'Phone Remote is Paired & Connected. Click to view pairing details.'
                : 'Connect smartphone remote touchpad'
            }
          >
            {isPhoneConnected ? (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <Smartphone className="w-4 h-4 text-emerald-600" />
                <span className="hidden sm:inline">Phone Paired</span>
                {isRemoteTransmitting && (
                  <span className="px-1.5 py-0.2 bg-emerald-200 text-emerald-900 rounded text-[9px] font-mono font-bold animate-pulse">
                    TOUCH
                  </span>
                )}
              </>
            ) : (
              <>
                <Smartphone className="w-4 h-4 text-slate-500" />
                <span className="hidden sm:inline">Connect Phone</span>
                <span className="w-2 h-2 rounded-full bg-slate-300"></span>
              </>
            )}
          </button>

          {/* Real-time Socket & Connection Diagnostics Panel Toggle */}
          <button
            onClick={() => setIsDiagnosticPanelOpen(!isDiagnosticPanelOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
              isDiagnosticPanelOpen
                ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
            }`}
            title="Open Live Socket Events & Vercel Connection Diagnostics"
          >
            <Activity className={`w-4 h-4 ${isPhoneConnected ? 'text-emerald-500 animate-pulse' : 'text-blue-600'}`} />
            <span className="hidden sm:inline">Diagnostics</span>
          </button>

          {/* AI Math Tutor Panel Toggle */}
          <button
            onClick={() => setIsAIPanelOpen(!isAIPanelOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isAIPanelOpen
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="hidden sm:inline">AI Tutor</span>
          </button>

          {/* Share */}
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Share</span>
          </button>

          {/* Export Split Dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <div className="flex items-center rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden">
              <button
                onClick={() => setIsExportModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
                title="Export Whiteboard Canvas as PNG, SVG, PDF, or JSON"
              >
                <Download className="w-4 h-4 text-blue-600" />
                <span className="hidden sm:inline">Export</span>
              </button>
              <button
                onClick={() => setIsExportMenuOpen((prev) => !prev)}
                className="px-1.5 py-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 border-l border-slate-200 transition-colors"
                title="Quick Export Options (PNG / SVG / Copy)"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Export Dropdown Menu */}
            {isExportMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-white border border-slate-200 shadow-xl rounded-xl p-1.5 z-40 text-xs animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Quick Export Canvas
                </div>
                <button
                  type="button"
                  onClick={handleQuickExportPNG}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-left transition-colors font-medium"
                >
                  <FileImage className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900">Export as PNG</div>
                    <div className="text-[10px] text-slate-500">2x Retina HD image (.png)</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={handleQuickExportSVG}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg text-left transition-colors font-medium"
                >
                  <FileCode className="w-4 h-4 text-purple-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900">Export as SVG</div>
                    <div className="text-[10px] text-slate-500">Scalable vector graphics (.svg)</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={handleQuickCopyClipboard}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg text-left transition-colors font-medium"
                >
                  <Copy className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900">Copy to Clipboard</div>
                    <div className="text-[10px] text-slate-500">Paste directly (Ctrl+V)</div>
                  </div>
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    setIsExportModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-left transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>More Options & Formats...</span>
                </button>
              </div>
            )}
          </div>

          {/* PWA Install Button */}
          <PWAInstallButton variant="compact" />

          {/* Settings */}
          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            title="Shortcuts & Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Workspace Area */}
      <div className="relative flex-1 w-full overflow-hidden">
        {/* Floating Left Toolbar */}
        <div className="absolute left-4 top-4 z-20">
          <WhiteboardToolbar
            currentTool={currentTool}
            setTool={setCurrentTool}
            canUndo={historyIndex > 0}
            canRedo={historyIndex < history.length - 1}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClear={handleClearPage}
            onRecognizeEquation={handleRecognizeEquationPrompt}
            onExport={() => setIsExportModalOpen(true)}
          />
        </div>

        {/* Floating Top Tool Settings (Colors, Sizes, Grid) */}
        <div className="absolute left-20 top-4 z-20">
          <ToolSettings
            currentTool={currentTool}
            color={color}
            setColor={setColor}
            strokeWidth={strokeWidth}
            setStrokeWidth={setStrokeWidth}
            backgroundPattern={backgroundPattern}
            setBackgroundPattern={(pat) => {
              setBackgroundPattern(pat);
              if (board) {
                const updatedPages = board.pages.map((p) =>
                  p.id === currentPageId ? { ...p, background: pat } : p
                );
                const updatedBoard = { ...board, pages: updatedPages };
                setBoard(updatedBoard);
                queueAutoSave(updatedBoard);
              }
            }}
            fillColor={fillColor}
            setFillColor={setFillColor}
          />
        </div>

        {/* The Whiteboard Canvas */}
        <WhiteboardCanvas
          objects={currentObjects}
          currentTool={currentTool}
          color={color}
          strokeWidth={strokeWidth}
          fillColor={fillColor}
          backgroundPattern={backgroundPattern}
          selectedObjectId={selectedObjectId}
          onSelectObject={setSelectedObjectId}
          onAddObject={handleAddObject}
          onUpdateObject={handleUpdateObject}
          onDeleteObject={handleDeleteObject}
          collaborators={collaborators}
          remotePointer={remotePointer}
          zoom={zoom}
          pan={pan}
          onPanChange={setPan}
          onZoomChange={setZoom}
          currentPageId={currentPageId}
        />

        {/* Interactive Equation Cards on Canvas */}
        <EquationOverlay
          equations={currentEquations}
          zoom={zoom}
          pan={pan}
          onSolve={handleSolveEquation}
          onExplain={handleExplainEquation}
          onInsertSolution={handleInsertSolutionOntoCanvas}
          onDelete={handleDeleteObject}
          onEdit={(eqObj) => {
            const newExpr = prompt('Edit equation:', eqObj.equationData?.rawExpression);
            if (newExpr && eqObj.equationData) {
              handleUpdateObject({
                ...eqObj,
                equationData: {
                  ...eqObj.equationData,
                  rawExpression: newExpr,
                  latex: newExpr,
                  status: 'idle',
                  solution: undefined,
                },
              });
            }
          }}
        />

        {/* Collapsible AI Assistant Side Panel */}
        <AIAssistantPanel
          isOpen={isAIPanelOpen}
          onClose={() => setIsAIPanelOpen(false)}
          selectedEquation={selectedEquationForAI || currentEquations[0] || null}
          onInsertSolution={handleInsertSolutionOntoCanvas}
        />

        {/* Bottom Multi-Page Navigation Bar */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
          <PageNavigator
            pages={board.pages}
            currentPageId={currentPageId}
            onSelectPage={setCurrentPageId}
            onAddPage={handleAddPage}
            onDuplicatePage={handleDuplicatePage}
            onDeletePage={handleDeletePage}
            onRenamePage={handleRenamePage}
          />
        </div>
      </div>

      {/* Modals */}
      <ConnectPhoneModal
        isOpen={isPhoneModalOpen}
        onClose={() => setIsPhoneModalOpen(false)}
        boardId={board.id}
        isPhoneConnected={isPhoneConnected}
        onPhoneConnectionChange={setIsPhoneConnected}
        onSessionReady={(sessId, pass) => {
          setPairedSessionId(sessId);
          setActivePasscode(pass || null);
          socket.bindRemote(sessId, 'display', pass);
        }}
      />

      <DiagnosticPanel
        isOpen={isDiagnosticPanelOpen}
        onClose={() => setIsDiagnosticPanelOpen(false)}
        boardId={board.id}
        remotePointer={remotePointer}
        isPhoneConnected={isPhoneConnected}
        pairedSessionId={pairedSessionId}
        activePasscode={activePasscode}
        onToast={showToast}
      />

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        board={board}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        board={board}
        currentPageId={currentPageId}
        onToast={showToast}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />

      {/* Floating Notification Toast */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-2xl backdrop-blur-md flex items-center gap-2.5 border border-slate-700/60 pointer-events-none animate-in fade-in slide-in-from-top-2 duration-150">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Offline & Connection Drop Resilience Indicator */}
      <OfflineIndicator onRetrySync={handleManualSync} isSyncing={isSyncing} />
    </div>
  );
};
