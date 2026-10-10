/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  PenTool,
  Smartphone,
  Sparkles,
  Layers,
  ArrowRight,
  CheckCircle2,
  Share2,
  Download,
  BookOpen,
  QrCode,
  Sigma,
  Zap,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { LatexRenderer } from '../math/LatexRenderer';
import { solveEquationLocally } from '../../utils/mathSolver';

interface MarketingLandingProps {
  onStartWhiteboard: () => void;
  onExploreTemplates: () => void;
}

export const MarketingLanding: React.FC<MarketingLandingProps> = ({
  onStartWhiteboard,
  onExploreTemplates,
}) => {
  // Interactive Math Demo on Landing Page
  const [demoInput, setDemoInput] = useState('2x + 5 = 15');
  const demoSolution = solveEquationLocally(demoInput);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Headline and CTAs */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200/80 rounded-full text-xs font-semibold text-blue-700">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Next-Generation Digital Learning Surface</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.1] text-balance">
              Write. Think. Solve. Create.
            </h1>

            <p className="text-lg text-slate-600 max-w-xl leading-relaxed">
              A smarter digital whiteboard designed for handwritten mathematics, step-by-step AI problem solving,
              interactive teaching, and wireless smartphone remote touchpad control.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <button
                onClick={onStartWhiteboard}
                className="flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-500/25 transition-all hover:shadow-lg focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <span>Create a Whiteboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={onExploreTemplates}
                className="flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors"
              >
                <span>Browse Templates</span>
              </button>
            </div>

            <div className="pt-4 flex items-center gap-6 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Free to use
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> No signup required
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Works on any device
              </span>
            </div>
          </div>

          {/* Right Column: Realistic Whiteboard Interface Preview */}
          <div className="lg:col-span-6">
            <div className="bg-slate-900 rounded-2xl p-2 shadow-2xl border border-slate-800">
              {/* Window Chrome Header */}
              <div className="bg-slate-800/80 rounded-t-xl px-4 py-2.5 flex items-center justify-between text-xs text-slate-300 border-b border-slate-700/60">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="font-medium text-slate-200 ml-2">Algebra Lesson — Quadratic Systems</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Phone Paired</span>
                </div>
              </div>

              {/* Whiteboard Canvas Visual Preview */}
              <div className="bg-white rounded-b-xl p-6 min-h-[360px] relative overflow-hidden flex flex-col justify-between">
                {/* Background dot grid */}
                <div
                  className="absolute inset-0 opacity-25 pointer-events-none"
                  style={{
                    backgroundImage: 'radial-gradient(#64748b 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                  }}
                />

                {/* Left Miniature Toolbar mockup */}
                <div className="absolute left-3 top-3 bg-white/95 border border-slate-200 shadow-sm rounded-lg p-1 flex flex-col gap-1 text-slate-500 pointer-events-none">
                  <div className="p-1 rounded bg-blue-50 text-blue-600 font-bold text-xs">✎</div>
                  <div className="p-1 text-xs">□</div>
                  <div className="p-1 text-xs">T</div>
                  <div className="p-1 text-xs">∑</div>
                </div>

                {/* Canvas Content */}
                <div className="pl-10 space-y-4 relative z-10">
                  {/* Handwritten equation card */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm max-w-sm">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500 pb-2 border-b border-slate-100">
                      <span>Equation Recognized</span>
                      <span className="text-blue-600 font-mono">LaTeX Ready</span>
                    </div>

                    <div className="py-2 text-center">
                      <LatexRenderer latex="2x + 5 = 15" displayMode={true} className="text-xl text-slate-900" />
                    </div>

                    <div className="bg-blue-50/70 p-2.5 rounded-lg text-xs space-y-1 border border-blue-100">
                      <div className="font-bold text-blue-900 flex justify-between">
                        <span>Solution:</span>
                        <span>x = 5</span>
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Step 1: 2x = 10 (subtract 5)
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Step 2: x = 5 (divide by 2)
                      </div>
                    </div>
                  </div>

                  {/* Connected Phone Sticky Note */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 shadow-sm max-w-xs ml-auto">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                      <Smartphone className="w-3.5 h-3.5 text-amber-600" />
                      <span>Smartphone Touchpad</span>
                    </div>
                    <p className="text-[11px] text-amber-800 mt-1">
                      Controlled wirelessly from mobile browser. Zero app install needed.
                    </p>
                  </div>
                </div>

                {/* Bottom Canvas Footer */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-4 border-t border-slate-100 relative z-10">
                  <span>Page 1 of 3</span>
                  <span className="font-medium text-blue-600">Saved to Cloud ✓</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 1: Natural Handwriting & Drawing */}
      <section className="py-20 max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Natural Expression</span>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Write as Naturally as Real Chalk or Paper
          </h2>
          <p className="text-sm text-slate-600">
            Whether you use an Apple Pencil, stylus, laptop trackpad, touchscreen, or mouse, our smooth Bezier
            stroke engine delivers zero-latency fluid handwriting.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <PenTool className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900">Versatile Writing Instruments</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Switch effortlessly between fountain pen, fine-tip pencil, translucent highlighter, stroke eraser,
              geometric shapes, and sticky notes.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900">Infinite Multi-Page Lectures</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Structure long lectures into organized multi-page boards. Duplicate pages, reorder lessons, and export
              entire curricula in one click.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900">Auto-Save & Offline Resilience</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Every stroke and formula is backed up immediately to disk and cached in your browser. Work continues
              uninterrupted even if your connection drops.
            </p>
          </div>
        </div>
      </section>

      {/* Section 2: Interactive Mathematics & AI Step Solver */}
      <section id="mathematics" className="py-20 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-900/50 border border-blue-700/60 rounded-full text-xs font-semibold text-blue-300">
              <Sigma className="w-3.5 h-3.5" />
              <span>Intelligent Mathematics</span>
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white">
              Understands Mathematical Handwriting
            </h2>
            <p className="text-sm text-slate-400">
              Write any equation. The whiteboard automatically parses mathematical notation, solves it step-by-step,
              and generates conversational pedagogical explanations.
            </p>
          </div>

          {/* Interactive Math Demo Sandbox */}
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 max-w-3xl mx-auto shadow-2xl">
            <div className="flex flex-col sm:flex-row items-center gap-3 pb-6 border-b border-slate-700">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                Try an equation:
              </label>
              <div className="flex flex-wrap gap-2 flex-1">
                {['2x + 5 = 15', 'x^2 - 5x + 6 = 0', '3x - 7 = 14', '2(x + 4) = 20'].map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setDemoInput(ex)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors ${
                      demoInput === ex
                        ? 'bg-blue-600 text-white font-bold'
                        : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                    }`}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Solution Display */}
            <div className="py-6 space-y-4">
              <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-700/80 text-center">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Recognized Formula (LaTeX)
                </span>
                <LatexRenderer latex={demoInput} displayMode={true} className="text-2xl text-white font-medium" />
              </div>

              {demoSolution && (
                <div className="space-y-3 bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-blue-400">Step-by-Step Working Steps:</span>
                    <span className="text-slate-400">Method: {demoSolution.method}</span>
                  </div>

                  <div className="space-y-2">
                    {demoSolution.steps.map((st) => (
                      <div key={st.stepNumber} className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60 text-xs">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold text-slate-400">Step {st.stepNumber}</span>
                          <LatexRenderer latex={st.latex || st.expression} className="text-emerald-400 font-bold" />
                        </div>
                        <p className="text-slate-300">{st.explanation}</p>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-slate-700 flex items-center justify-between font-bold text-sm">
                    <span className="text-slate-300">Final Answer:</span>
                    <span className="text-emerald-400 font-mono text-base">{demoSolution.solution}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 text-center">
              <button
                onClick={onStartWhiteboard}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md transition-colors inline-flex items-center gap-1.5"
              >
                <span>Solve your equations on the whiteboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Smartphone Remote Touchpad */}
      <section id="remote-touchpad" className="py-20 max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-semibold text-amber-800">
              <Smartphone className="w-3.5 h-3.5 text-amber-600" />
              <span>Wireless Presentation Freedom</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Transform Your Smartphone into a Wireless Touchpad
            </h2>

            <p className="text-sm text-slate-600 leading-relaxed">
              Step away from your laptop. Walk freely around the classroom or conference room. Scan a single QR code
              to turn your phone into a remote touchpad with live cursor movement, presentation laser pointer,
              drawing mode, and slide controls.
            </p>

            <div className="space-y-3 pt-2 text-xs text-slate-700">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[11px] mt-0.5">
                  1
                </div>
                <div>
                  <strong>Instant QR Pairing:</strong> Laptop generates a temporary secure code. Simply scan with your phone camera.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[11px] mt-0.5">
                  2
                </div>
                <div>
                  <strong>Tactile Touch Surface:</strong> Drag your thumb across the phone screen to glide the cursor across the big screen.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[11px] mt-0.5">
                  3
                </div>
                <div>
                  <strong>Remote Drawing & Eraser:</strong> Toggle Draw mode to write notes onto the laptop canvas directly from your mobile screen.
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 flex justify-center">
            {/* Phone Controller Mockup */}
            <div className="w-72 bg-slate-950 p-3 rounded-[36px] shadow-2xl border-4 border-slate-800 relative">
              {/* Speaker Notch */}
              <div className="w-20 h-4 bg-slate-800 rounded-full mx-auto mb-2" />

              <div className="bg-slate-900 rounded-[24px] p-4 flex flex-col justify-between h-[420px] text-white">
                <div className="flex items-center justify-between text-[11px] border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>Touchpad Active</span>
                  </div>
                  <span className="text-slate-400 font-mono">12ms</span>
                </div>

                {/* Simulated touchpad */}
                <div className="flex-1 my-3 bg-gradient-to-b from-slate-900 to-slate-950 rounded-xl border border-slate-800 flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-full border border-slate-700 flex items-center justify-center text-blue-400">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-2">Smooth Touchpad</span>
                </div>

                {/* Controller Buttons */}
                <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-semibold">
                  <div className="bg-blue-600 py-2 rounded-lg">Pen</div>
                  <div className="bg-slate-800 py-2 rounded-lg">Laser</div>
                  <div className="bg-slate-800 py-2 rounded-lg">Eraser</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Templates Gallery */}
      <section id="templates" className="py-20 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Curated Workspaces</span>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Board Templates for Every Discipline
            </h2>
            <p className="text-sm text-slate-600">
              Jump straight into teaching, problem solving, or brainstorming with pre-configured whiteboard layouts.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div
              onClick={onExploreTemplates}
              className="group p-6 bg-slate-50 hover:bg-white border border-slate-200 hover:border-blue-400 rounded-2xl transition-all shadow-xs hover:shadow-md cursor-pointer space-y-3"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-base">
                ∑
              </div>
              <h3 className="font-bold text-base text-slate-900 group-hover:text-blue-600 transition-colors">
                Algebra & Polynomials
              </h3>
              <p className="text-xs text-slate-600">
                Balanced linear equations, quadratic factorization, and step-by-step reasoning guides.
              </p>
              <div className="pt-2 text-xs font-semibold text-blue-600 flex items-center gap-1">
                Open Template <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            <div
              onClick={onExploreTemplates}
              className="group p-6 bg-slate-50 hover:bg-white border border-slate-200 hover:border-purple-400 rounded-2xl transition-all shadow-xs hover:shadow-md cursor-pointer space-y-3"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-base">
                📐
              </div>
              <h3 className="font-bold text-base text-slate-900 group-hover:text-purple-600 transition-colors">
                Geometry & Trigonometry
              </h3>
              <p className="text-xs text-slate-600">
                Pythagorean proofs, triangle formulas, angles, and interactive coordinate grids.
              </p>
              <div className="pt-2 text-xs font-semibold text-purple-600 flex items-center gap-1">
                Open Template <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            <div
              onClick={onExploreTemplates}
              className="group p-6 bg-slate-50 hover:bg-white border border-slate-200 hover:border-amber-400 rounded-2xl transition-all shadow-xs hover:shadow-md cursor-pointer space-y-3"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-base">
                💡
              </div>
              <h3 className="font-bold text-base text-slate-900 group-hover:text-amber-600 transition-colors">
                Mind Map & Brainstorm
              </h3>
              <p className="text-xs text-slate-600">
                Color-coded sticky cards, connector branches, and collaborative team planning boards.
              </p>
              <div className="pt-2 text-xs font-semibold text-amber-600 flex items-center gap-1">
                Open Template <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: Final CTA */}
      <section className="py-20 bg-blue-600 text-white text-center">
        <div className="max-w-4xl mx-auto px-6 space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Ready to Experience the Smart Whiteboard?
          </h2>
          <p className="text-base text-blue-100 max-w-xl mx-auto">
            Write formulas, solve problems with AI, and present wirelessly from your phone. Start now for free.
          </p>
          <div>
            <button
              onClick={onStartWhiteboard}
              className="px-8 py-4 bg-white text-blue-700 hover:bg-blue-50 rounded-xl text-sm font-bold shadow-lg transition-all shadow-blue-900/20 inline-flex items-center gap-2"
            >
              <span>Create Your First Whiteboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Minimal Editorial Footer adhering strictly to Anti-Slop Rules */}
      <footer className="py-8 bg-white border-t border-slate-200 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="font-bold text-slate-900">
            AI Smart Whiteboard
          </div>
          <div className="flex items-center gap-6">
            <button onClick={onStartWhiteboard} className="hover:text-slate-900 transition-colors">
              Whiteboard Editor
            </button>
            <button onClick={onExploreTemplates} className="hover:text-slate-900 transition-colors">
              Templates
            </button>
            <span>© {new Date().getFullYear()} All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
