'use client';

import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';

interface CodeBlockProps {
  language: string;
  value: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="my-6 overflow-hidden rounded-xl border border-border-warm bg-[#1F1E1A] text-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#2C2A25] bg-[#171614] px-4 py-2 text-xs font-mono text-text-secondary">
        <span className="uppercase tracking-wider text-neutral-400">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-neutral-800 hover:text-white"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-success-green" />
              <span className="text-success-green">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto p-4 font-mono text-sm leading-relaxed text-neutral-200">
        <pre><code>{value}</code></pre>
      </div>
    </div>
  );
};

interface MermaidProps {
  chart: string;
}

const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    
    const renderChart = async () => {
      try {
        const { default: mermaid } = await import('mermaid');
        mermaid.initialize({
          startOnLoad: false,
          theme: 'neutral',
          securityLevel: 'loose',
          themeVariables: {
            background: '#FFFDF8',
            primaryColor: '#C9A86A',
            lineColor: '#ECE7DC',
          }
        });

        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg: renderedSvg } = await mermaid.render(id, chart);
        
        if (isMounted) {
          setSvg(renderedSvg);
          setError(false);
        }
      } catch (err) {
        console.error('Mermaid render error:', err);
        if (isMounted) {
          setError(true);
        }
      }
    };

    renderChart();

    return () => {
      isMounted = false;
    };
  }, [chart]);

  if (error) {
    return (
      <div className="my-6 rounded-xl border border-error-red/20 bg-error-red/5 p-4 text-sm text-error-red font-mono">
        <p className="font-semibold">Failed to render diagram:</p>
        <pre className="mt-2 text-xs overflow-x-auto">{chart}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="my-6 flex h-32 items-center justify-center rounded-xl border border-border-warm bg-card-warm">
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-gold border-t-transparent" />
          <span>Generating diagram...</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="my-6 overflow-hidden rounded-xl border border-border-warm bg-card-warm p-6 shadow-sm flex justify-center"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0 prose-headings:font-medium prose-headings:tracking-tight prose-a:text-accent-gold prose-a:no-underline hover:prose-a:underline">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const value = String(children).replace(/\n$/, '');
            const isInline = !match;

            if (isInline) {
              return (
                <code className="rounded bg-hover-warm px-1.5 py-0.5 font-mono text-sm font-medium text-text-primary dark:bg-neutral-800" {...props}>
                  {children}
                </code>
              );
            }

            if (language === 'mermaid') {
              return <Mermaid chart={value} />;
            }

            return <CodeBlock language={language} value={value} />;
          },
          table({ children }) {
            return (
              <div className="my-6 overflow-x-auto rounded-xl border border-border-warm">
                <table className="min-w-full divide-y divide-border-warm text-sm">{children}</table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-hover-warm/50 dark:bg-neutral-900">{children}</thead>;
          },
          tbody({ children }) {
            return <tbody className="divide-y divide-border-warm bg-card-warm/30">{children}</tbody>;
          },
          tr({ children }) {
            return <tr className="transition-colors hover:bg-hover-warm/20">{children}</tr>;
          },
          th({ children }) {
            return <th className="px-4 py-3 text-left font-medium text-text-primary">{children}</th>;
          },
          td({ children }) {
            return <td className="px-4 py-3 text-text-secondary">{children}</td>;
          },
          p({ children }) {
            return <p className="mb-4 text-base leading-relaxed text-text-primary/90">{children}</p>;
          },
          ul({ children }) {
            return <ul className="mb-4 list-disc pl-6 space-y-1.5 text-text-primary/90">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="mb-4 list-decimal pl-6 space-y-1.5 text-text-primary/90">{children}</ol>;
          },
          li({ children }) {
            return <li className="text-base">{children}</li>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="my-4 border-l-4 border-accent-gold/40 pl-4 italic text-text-secondary">
                {children}
              </blockquote>
            );
          },
          h1: ({ children }) => <h1 className="mt-8 mb-4 text-2xl font-semibold tracking-tight text-text-primary">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-6 mb-3 text-xl font-semibold tracking-tight text-text-primary">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-4 mb-2 text-lg font-medium tracking-tight text-text-primary">{children}</h3>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
