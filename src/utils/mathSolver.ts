/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MathSolution, MathSolutionStep } from '../types/whiteboard.ts';

/**
 * Local symbolic mathematics solver for linear, quadratic, and arithmetic equations.
 * Provides immediate deterministic step-by-step reasoning.
 */
export function solveEquationLocally(rawInput: string): MathSolution | null {
  const clean = rawInput.trim().replace(/\s+/g, ' ');
  if (!clean) return null;

  // 1. Try Linear Equation in one variable: ax + b = c or ax + b = cx + d
  const linearResult = solveLinearEquation(clean);
  if (linearResult) return linearResult;

  // 2. Try Quadratic Equation: ax^2 + bx + c = 0
  const quadraticResult = solveQuadraticEquation(clean);
  if (quadraticResult) return quadraticResult;

  // 3. Try Arithmetic Expression: e.g. "15 * 4 + 20 / 2"
  const arithmeticResult = solveArithmeticExpression(clean);
  if (arithmeticResult) return arithmeticResult;

  return null;
}

/**
 * Formats LaTeX with KaTeX formatting
 */
export function toCleanLatex(expr: string): string {
  return expr
    .replace(/\*/g, ' \\cdot ')
    .replace(/\//g, ' \\div ')
    .replace(/<=/g, ' \\le ')
    .replace(/>=/g, ' \\ge ')
    .replace(/!=/g, ' \\ne ')
    .replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}')
    .replace(/\^2/g, '^2')
    .replace(/\^([0-9a-zA-Z]+)/g, '^{$1}');
}

function solveLinearEquation(input: string): MathSolution | null {
  // Pattern: e.g. 2x + 5 = 15 or 3x - 4 = 11 or 5x = 25 or 2x + 3 = x + 7
  if (!input.includes('=')) return null;

  const sides = input.split('=');
  if (sides.length !== 2) return null;

  const left = sides[0].trim();
  const right = sides[1].trim();

  // Find variable (x, y, z, n, t)
  const varMatch = input.match(/[a-zA-Z]/);
  if (!varMatch) return null;
  const variable = varMatch[0];

  // If there's an exponent like x^2, it's not linear
  if (input.includes(`${variable}^2`) || input.includes(`${variable}²`)) {
    return null;
  }

  // Parse standard ax + b = c
  // Match forms like: "2x + 5", "-3x - 7", "x + 4", "5x", "12"
  const parseSide = (sideStr: string) => {
    let coeff = 0;
    let constant = 0;

    // Normalize spacing around signs
    const normalized = sideStr.replace(/-/g, ' -').replace(/\+/g, ' +').trim();
    const tokens = normalized.split(/\s+/).filter(Boolean);

    for (const token of tokens) {
      if (token.includes(variable)) {
        const cStr = token.replace(variable, '');
        if (cStr === '' || cStr === '+') {
          coeff += 1;
        } else if (cStr === '-') {
          coeff -= 1;
        } else {
          const parsed = parseFloat(cStr);
          if (!isNaN(parsed)) coeff += parsed;
        }
      } else {
        const parsed = parseFloat(token);
        if (!isNaN(parsed)) constant += parsed;
      }
    }

    return { coeff, constant };
  };

  const leftTerms = parseSide(left);
  const rightTerms = parseSide(right);

  // a*x + b = c*x + d  =>  (a - c)*x = d - b
  const totalCoeff = leftTerms.coeff - rightTerms.coeff;
  const totalConst = rightTerms.constant - leftTerms.constant;

  if (totalCoeff === 0) {
    if (totalConst === 0) {
      return {
        originalExpression: input,
        latex: toCleanLatex(input),
        solution: 'Infinite solutions (Identity)',
        steps: [
          {
            stepNumber: 1,
            expression: `${input}`,
            latex: toCleanLatex(input),
            explanation: 'Simplify both sides of the equation.',
          },
          {
            stepNumber: 2,
            expression: `0 = 0`,
            latex: '0 = 0',
            explanation: 'Both sides are identical for all real values.',
          },
        ],
        method: 'Standard Linear Isolation',
      };
    } else {
      return {
        originalExpression: input,
        latex: toCleanLatex(input),
        solution: 'No solution (Contradiction)',
        steps: [
          {
            stepNumber: 1,
            expression: `${input}`,
            latex: toCleanLatex(input),
            explanation: 'Attempt to isolate the variable.',
          },
          {
            stepNumber: 2,
            expression: `0 = ${totalConst}`,
            latex: `0 \\ne ${totalConst}`,
            explanation: 'Contradiction: the coefficients cancel out but constants differ.',
          },
        ],
        method: 'Standard Linear Isolation',
      };
    }
  }

  const solutionNum = totalConst / totalCoeff;
  const roundedSol = Math.round(solutionNum * 1000) / 1000;
  const steps: MathSolutionStep[] = [];

  steps.push({
    stepNumber: 1,
    expression: input,
    latex: toCleanLatex(input),
    explanation: 'Write down the original equation.',
  });

  // Step 2: collect constants
  if (leftTerms.constant !== 0 || rightTerms.coeff !== 0) {
    const leftExpr = `${totalCoeff !== 1 ? totalCoeff : ''}${variable}`;
    steps.push({
      stepNumber: 2,
      expression: `${leftExpr} = ${totalConst}`,
      latex: `${totalCoeff === 1 ? variable : `${totalCoeff}${variable}`} = ${totalConst}`,
      explanation:
        leftTerms.constant > 0
          ? `Subtract ${Math.abs(leftTerms.constant)} from both sides to group constants.`
          : `Add ${Math.abs(leftTerms.constant)} to both sides to group constants.`,
    });
  }

  // Step 3: divide by coefficient
  if (totalCoeff !== 1) {
    steps.push({
      stepNumber: steps.length + 1,
      expression: `${variable} = ${roundedSol}`,
      latex: `${variable} = ${roundedSol}`,
      explanation: `Divide both sides by ${totalCoeff} to isolate ${variable}.`,
    });
  }

  return {
    originalExpression: input,
    latex: toCleanLatex(input),
    solution: `${variable} = ${roundedSol}`,
    steps,
    method: 'Linear Balance & Isolation',
    alternativeMethods: [
      {
        method: 'Graphical Intersection',
        steps: [
          `Plot line y₁ = ${left}`,
          `Plot line y₂ = ${right}`,
          `The intersection point x-coordinate is ${roundedSol}.`,
        ],
      },
    ],
  };
}

function solveQuadraticEquation(input: string): MathSolution | null {
  // Pattern: e.g. x^2 - 5x + 6 = 0 or 2x^2 + 4x - 6 = 0 or x^2 = 9
  if (!input.includes('=') || (!input.includes('^2') && !input.includes('²'))) {
    return null;
  }

  const varMatch = input.match(/[a-zA-Z]/);
  if (!varMatch) return null;
  const v = varMatch[0];

  const sides = input.split('=');
  const left = sides[0].trim();
  const right = sides[1].trim();

  // Normalize to standard form ax^2 + bx + c = 0
  const parseQuad = (expr: string) => {
    let a = 0;
    let b = 0;
    let c = 0;

    const norm = expr
      .replace(/²/g, '^2')
      .replace(/-/g, ' -')
      .replace(/\+/g, ' +')
      .trim();
    const tokens = norm.split(/\s+/).filter(Boolean);

    for (const t of tokens) {
      if (t.includes(`${v}^2`)) {
        const coefStr = t.replace(`${v}^2`, '');
        if (coefStr === '' || coefStr === '+') a += 1;
        else if (coefStr === '-') a -= 1;
        else {
          const p = parseFloat(coefStr);
          if (!isNaN(p)) a += p;
        }
      } else if (t.includes(v)) {
        const coefStr = t.replace(v, '');
        if (coefStr === '' || coefStr === '+') b += 1;
        else if (coefStr === '-') b -= 1;
        else {
          const p = parseFloat(coefStr);
          if (!isNaN(p)) b += p;
        }
      } else {
        const p = parseFloat(t);
        if (!isNaN(p)) c += p;
      }
    }
    return { a, b, c };
  };

  const lq = parseQuad(left);
  const rq = parseQuad(right);

  const a = lq.a - rq.a;
  const b = lq.b - rq.b;
  const c = lq.c - rq.c;

  if (a === 0) return null; // not quadratic

  // Discriminant: D = b^2 - 4ac
  const D = b * b - 4 * a * c;
  const steps: MathSolutionStep[] = [];

  steps.push({
    stepNumber: 1,
    expression: `${a !== 1 ? a : ''}${v}^2 ${b >= 0 ? `+ ${b}` : `- ${Math.abs(b)}`}${v} ${c >= 0 ? `+ ${c}` : `- ${Math.abs(c)}`} = 0`,
    latex: `${a !== 1 ? (a === -1 ? '-' : a) : ''}${v}^2 ${b >= 0 ? `+ ${b}` : `- ${Math.abs(b)}`}${v} ${c >= 0 ? `+ ${c}` : `- ${Math.abs(c)}`} = 0`,
    explanation: 'Convert equation to standard form: ax² + bx + c = 0.',
  });

  steps.push({
    stepNumber: 2,
    expression: `D = (${b})^2 - 4(${a})(${c}) = ${D}`,
    latex: `\\Delta = b^2 - 4ac = (${b})^2 - 4(${a})(${c}) = ${D}`,
    explanation: `Calculate discriminant (Δ). Since Δ ${D > 0 ? '> 0' : D === 0 ? '= 0' : '< 0'}, there ${D > 0 ? 'are two distinct real roots' : D === 0 ? 'is one real repeated root' : 'are two complex roots'}.`,
  });

  if (D > 0) {
    const sqrtD = Math.sqrt(D);
    const x1 = (-b + sqrtD) / (2 * a);
    const x2 = (-b - sqrtD) / (2 * a);
    const rx1 = Math.round(x1 * 1000) / 1000;
    const rx2 = Math.round(x2 * 1000) / 1000;

    steps.push({
      stepNumber: 3,
      expression: `${v} = (-(${b}) ± √${D}) / (2 · ${a})`,
      latex: `${v} = \\frac{-(${b}) \\pm \\sqrt{${D}}}{2(${a})}`,
      explanation: 'Apply the Quadratic Formula: x = (-b ± √Δ) / 2a.',
    });

    steps.push({
      stepNumber: 4,
      expression: `${v}₁ = ${rx1}, ${v}₂ = ${rx2}`,
      latex: `${v}_1 = ${rx1}, \\quad ${v}_2 = ${rx2}`,
      explanation: `Evaluate both signs (plus and minus) to get roots ${rx1} and ${rx2}.`,
    });

    return {
      originalExpression: input,
      latex: toCleanLatex(input),
      solution: `${v} = ${rx1} \\quad \\text{or} \\quad ${v} = ${rx2}`,
      steps,
      method: 'Quadratic Formula',
      alternativeMethods: [
        {
          method: 'Factoring / Null Factor Law',
          steps: [
            `Find factors of ac that sum to b.`,
            `Rewrite as product: (x - ${rx1})(x - ${rx2}) = 0.`,
            `By zero-product property, x = ${rx1} or x = ${rx2}.`,
          ],
        },
      ],
    };
  } else if (D === 0) {
    const x = -b / (2 * a);
    const rx = Math.round(x * 1000) / 1000;
    steps.push({
      stepNumber: 3,
      expression: `${v} = -(${b}) / (2 · ${a}) = ${rx}`,
      latex: `${v} = \\frac{-(${b})}{2(${a})} = ${rx}`,
      explanation: 'Since the discriminant is zero, the vertex touches the x-axis with a single double root.',
    });

    return {
      originalExpression: input,
      latex: toCleanLatex(input),
      solution: `${v} = ${rx} \\quad (\\text{double root})`,
      steps,
      method: 'Quadratic Formula / Perfect Square',
    };
  } else {
    // Complex roots
    const realPart = Math.round((-b / (2 * a)) * 1000) / 1000;
    const imagPart = Math.round((Math.sqrt(Math.abs(D)) / (2 * a)) * 1000) / 1000;

    steps.push({
      stepNumber: 3,
      expression: `${v} = ${realPart} ± ${Math.abs(imagPart)}i`,
      latex: `${v} = ${realPart} \\pm ${Math.abs(imagPart)}i`,
      explanation: 'Because the discriminant is negative, the solutions are complex conjugates.',
    });

    return {
      originalExpression: input,
      latex: toCleanLatex(input),
      solution: `${v} = ${realPart} \\pm ${Math.abs(imagPart)}i`,
      steps,
      method: 'Complex Quadratic Formula',
    };
  }
}

function solveArithmeticExpression(input: string): MathSolution | null {
  // Simple sanitized math evaluation without eval:
  // e.g. "25 + 17 * 3" or "(10 + 5) * 4 - 8 / 2"
  const sanitized = input.replace(/\s+/g, '');
  if (!/^[-+*/0-9().^]+$/.test(sanitized)) return null;

  try {
    // Controlled evaluator for math expressions using Function with empty context
    const cleanExpr = sanitized.replace(/\^/g, '**');
    const result = new Function(`'use strict'; return (${cleanExpr});`)();
    if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) return null;

    const rounded = Math.round(result * 10000) / 10000;
    return {
      originalExpression: input,
      latex: toCleanLatex(input) + ' = ' + rounded,
      solution: `${rounded}`,
      steps: [
        {
          stepNumber: 1,
          expression: input,
          latex: toCleanLatex(input),
          explanation: 'Original arithmetic expression.',
        },
        {
          stepNumber: 2,
          expression: `= ${rounded}`,
          latex: `= ${rounded}`,
          explanation: 'Apply order of operations (PEMDAS / BODMAS) to evaluate the result.',
        },
      ],
      method: 'Order of Operations (PEMDAS)',
    };
  } catch {
    return null;
  }
}
