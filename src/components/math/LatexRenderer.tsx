/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import katex from 'katex';

interface LatexRendererProps {
  latex: string;
  displayMode?: boolean;
  className?: string;
}

export const LatexRenderer: React.FC<LatexRendererProps> = ({
  latex,
  displayMode = false,
  className = '',
}) => {
  const renderedHtml = useMemo(() => {
    try {
      // Clean up common input quirks
      const clean = latex.trim().replace(/^\\\[/, '').replace(/\\\]$/, '').replace(/^\$/, '').replace(/\$$/, '');
      return katex.renderToString(clean, {
        displayMode,
        throwOnError: false,
      });
    } catch {
      return null;
    }
  }, [latex, displayMode]);

  if (!renderedHtml) {
    return <span className={`font-mono text-slate-800 ${className}`}>{latex}</span>;
  }

  return (
    <span
      className={`inline-block ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
};
