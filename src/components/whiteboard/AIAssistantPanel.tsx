/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Sparkles,
  BookOpen,
  Send,
  Loader2,
  Mic,
  MicOff,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  RotateCcw,
  Volume2
} from 'lucide-react';
import { WhiteboardObject, MathSolution } from '../../types/whiteboard';
import { LatexRenderer } from '../math/LatexRenderer';
import { api } from '../../services/api';

interface AIAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEquation: WhiteboardObject | null;
  onInsertSolution?: (equationObj: WhiteboardObject, solution: MathSolution) => void;
}

export const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({
  isOpen,
  onClose,
  selectedEquation,
  onInsertSolution,
}) => {
  const [level, setLevel] = useState<'beginner' | 'student' | 'advanced'>('student');
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [customQuestion, setCustomQuestion] = useState('');
  const [qaHistory, setQaHistory] = useState<{ q: string; a: string }[]>([]);

  // Speech-to-Text (Voice Recognition) state
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  const recognitionRef = useRef<any>(null);
  const baseQuestionRef = useRef<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize Speech Recognition capability check
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition ||
        null;
      setSpeechSupported(!!SpeechRecognition);
    }
  }, []);

  // Stop listening when unmounted or closed
  useEffect(() => {
    if (!isOpen && isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsListening(false);
    }
  }, [isOpen, isListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Helper to directly request microphone media access to trigger the browser prompt
  const requestMicrophoneAccess = async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      return true; // fallback to native SpeechRecognition prompt
    }
    try {
      setIsRequestingPermission(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Clean up tracks immediately once permission is verified
      stream.getTracks().forEach((track) => track.stop());
      setIsRequestingPermission(false);
      setSpeechError(null);
      setShowPermissionGuide(false);
      return true;
    } catch (err: any) {
      setIsRequestingPermission(false);
      console.warn('getUserMedia permission error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setSpeechError('Microphone permission denied. Click "How to Allow" or the icon in your address bar.');
        setShowPermissionGuide(true);
      } else {
        setSpeechError(`Microphone access error: ${err.message || 'Unable to access microphone'}`);
      }
      return false;
    }
  };

  const startRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      null;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      setSpeechError('Voice dictation is not supported by your current browser. Please try Chrome, Edge, or Safari.');
      return;
    }

    try {
      setSpeechError(null);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = typeof navigator !== 'undefined' ? (navigator.language || 'en-US') : 'en-US';

      // Save whatever text was typed before speaking
      baseQuestionRef.current = customQuestion;

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
        setShowPermissionGuide(false);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }

        const base = baseQuestionRef.current.trim();
        const speech = transcript.trim();
        if (speech) {
          const combined = base ? `${base} ${speech}` : speech;
          setCustomQuestion(combined);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setSpeechError('Microphone permission denied. Please allow microphone access in your browser.');
          setShowPermissionGuide(true);
        } else if (event.error === 'network') {
          setSpeechError('Speech recognition network error. Please verify your connection.');
        } else if (event.error !== 'no-speech') {
          setSpeechError(`Voice input issue: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      inputRef.current?.focus();
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      setSpeechError('Could not start microphone. Please check permissions.');
      setIsListening(false);
    }
  };

  const toggleSpeechRecognition = useCallback(async () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsListening(false);
      return;
    }

    // Proactively check / prompt microphone permission via getUserMedia
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
      const allowed = await requestMicrophoneAccess();
      if (!allowed) {
        return;
      }
    }

    startRecognition();
  }, [isListening, customQuestion]);

  if (!isOpen) return null;

  const rawExpr = selectedEquation?.equationData?.rawExpression || '2x + 5 = 15';
  const latexExpr = selectedEquation?.equationData?.latex || rawExpr;
  const currentSol = selectedEquation?.equationData?.solution;

  const handleFetchExplanation = async (targetLevel = level, question?: string) => {
    // Stop voice listening when submitting
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }

    setIsLoading(true);
    setSpeechError(null);

    try {
      const res = await api.explainEquation(rawExpr, currentSol?.solution, targetLevel, question);
      if (question) {
        setQaHistory((prev) => [...prev, { q: question, a: res.explanation }]);
        setCustomQuestion('');
        baseQuestionRef.current = '';
      } else {
        setExplanation(res.explanation);
      }
    } catch (e: any) {
      setExplanation('Could not load AI explanation. Please check connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="absolute right-4 top-16 bottom-16 w-96 bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl rounded-2xl flex flex-col z-30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 leading-tight">AI Math Assistant</h3>
            <span className="text-[11px] text-slate-500">Step reasoning & concept tutor</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          title="Close AI Assistant"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
        {/* Selected Expression Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
          <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">
            Active Equation
          </span>
          <div className="text-base py-1 text-slate-800 font-medium">
            <LatexRenderer latex={latexExpr} />
          </div>
          {currentSol && (
            <div className="mt-2 text-xs font-semibold text-emerald-600 bg-emerald-50 py-1 px-2 rounded-md inline-block">
              Final: {currentSol.solution}
            </div>
          )}
        </div>

        {/* Level Selector */}
        <div className="flex items-center justify-between bg-slate-100 p-1 rounded-lg">
          {(['beginner', 'student', 'advanced'] as const).map((l) => (
            <button
              key={l}
              onClick={() => {
                setLevel(l);
                handleFetchExplanation(l);
              }}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${
                level === l
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Explanation Area */}
        <div className="space-y-3">
          {isLoading && !explanation && (
            <div className="flex flex-col items-center justify-center p-8 space-y-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span>Analyzing formula steps with AI...</span>
            </div>
          )}

          {!isLoading && !explanation && qaHistory.length === 0 && (
            <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl text-center">
              <BookOpen className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <p className="text-slate-600 mb-3">
                Need an intuitive explanation of why this solution holds? Click below for a tailored breakdown.
              </p>
              <button
                onClick={() => handleFetchExplanation()}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-xs transition-colors"
              >
                Explain This Problem
              </button>
            </div>
          )}

          {explanation && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-slate-500 font-semibold text-[11px]">
                <span>TUTOR INSIGHT ({level.toUpperCase()})</span>
              </div>
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{explanation}</p>
            </div>
          )}

          {/* Q&A Conversation stream */}
          {qaHistory.map((item, idx) => (
            <div key={idx} className="space-y-2">
              <div className="flex justify-end">
                <div className="bg-blue-600 text-white rounded-xl rounded-tr-xs px-3 py-2 max-w-[85%] text-xs shadow-xs">
                  {item.q}
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-slate-100 text-slate-800 rounded-xl rounded-tl-xs px-3 py-2 max-w-[90%] text-xs border border-slate-200 leading-relaxed whitespace-pre-wrap">
                  {item.a}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Input Bar with Voice-to-Text and Rotating Send Button */}
      <div className="p-3 border-t border-slate-200 bg-white">
        {/* Live Listening Indicator */}
        {isListening && (
          <div className="flex items-center justify-between px-2.5 py-1.5 mb-2 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-600 animate-pulse">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
              Listening... Speak clearly into your mic
            </span>
            <button
              onClick={() => toggleSpeechRecognition()}
              className="text-red-700 hover:text-red-900 font-semibold underline text-[10px]"
            >
              Stop
            </button>
          </div>
        )}

        {/* Microphone Permission denied warning & Troubleshooting guide */}
        {speechError && (
          <div className="mb-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-2">
            <div className="flex items-start justify-between gap-1.5">
              <div className="flex items-start gap-1.5 flex-1">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="leading-snug font-medium">{speechError}</span>
              </div>
              <button
                onClick={() => {
                  setSpeechError(null);
                  setShowPermissionGuide(false);
                }}
                className="text-amber-500 hover:text-amber-800 p-0.5"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-amber-200/60 text-[11px]">
              <button
                type="button"
                onClick={async () => {
                  setSpeechError(null);
                  await requestMicrophoneAccess();
                  startRecognition();
                }}
                disabled={isRequestingPermission}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium flex items-center gap-1 transition-colors disabled:opacity-50"
              >
                <RotateCcw className={`w-3 h-3 ${isRequestingPermission ? 'animate-spin' : ''}`} />
                {isRequestingPermission ? 'Prompting...' : 'Try Again'}
              </button>

              <button
                type="button"
                onClick={() => setShowPermissionGuide(!showPermissionGuide)}
                className="text-amber-900 hover:underline flex items-center gap-1 font-medium"
              >
                <HelpCircle className="w-3 h-3" />
                {showPermissionGuide ? 'Hide Instructions' : 'How to Allow'}
              </button>
            </div>

            {/* Quick step-by-step browser permission instructions */}
            {showPermissionGuide && (
              <div className="mt-2 p-2 bg-white rounded border border-amber-200 text-[11px] text-slate-700 space-y-1.5">
                <div className="font-semibold text-slate-900">How to unblock microphone in browser:</div>
                <ol className="list-decimal list-inside space-y-1 text-slate-600">
                  <li>Look at your browser's address bar at the top of the page.</li>
                  <li>Click the <strong>padlock</strong> or <strong>tune / site settings icon (icon with sliders or lock)</strong> next to the URL.</li>
                  <li>Find <strong>Microphone</strong> and switch it from <em>Block</em> to <strong>Allow</strong>.</li>
                  <li>If prompted, reload the page or click <strong>Try Again</strong> above.</li>
                </ol>
              </div>
            )}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!customQuestion.trim() || isLoading) return;
            handleFetchExplanation(level, customQuestion.trim());
          }}
          className="flex items-center gap-2"
        >
          {/* Voice to Speech-to-Text Button */}
          <button
            type="button"
            onClick={toggleSpeechRecognition}
            disabled={!speechSupported || isLoading || isRequestingPermission}
            className={`p-2 rounded-lg transition-all shrink-0 flex items-center justify-center relative ${
              isListening
                ? 'bg-red-600 text-white shadow-md ring-2 ring-red-400 ring-offset-1 animate-pulse'
                : !speechSupported
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 border border-slate-200'
            }`}
            title={
              !speechSupported
                ? 'Speech recognition not supported in this browser'
                : isListening
                ? 'Listening... Click to stop voice dictation'
                : 'Click to speak (Voice-to-Text dictation)'
            }
          >
            {isRequestingPermission ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            ) : isListening ? (
              <Mic className="w-4 h-4 animate-bounce" />
            ) : !speechSupported ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          {/* Text Input Box */}
          <input
            ref={inputRef}
            type="text"
            value={customQuestion}
            onChange={(e) => {
              setCustomQuestion(e.target.value);
              baseQuestionRef.current = e.target.value;
            }}
            placeholder={
              isListening
                ? 'Listening... say your question now'
                : 'Ask AI why a step works (or speak via mic)...'
            }
            className={`flex-1 px-3 py-2 border rounded-lg text-xs outline-none transition-all ${
              isListening
                ? 'bg-red-50/40 border-red-300 focus:border-red-500'
                : 'bg-slate-50 border-slate-200 focus:border-blue-500 focus:bg-white'
            }`}
          />

          {/* Rotating Send Button */}
          <button
            type="submit"
            disabled={!customQuestion.trim() || isLoading}
            className={`p-2 rounded-lg transition-all shrink-0 flex items-center justify-center ${
              isLoading
                ? 'bg-blue-600 text-white cursor-wait opacity-90'
                : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40'
            }`}
            title={isLoading ? 'Generating response...' : 'Send message to AI Tutor'}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
