"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useOnboardingCheck } from "./OnboardingChecks";

export function CheckItem({
  children,
  link,
  checkId,
  action,
}: {
  children: React.ReactNode;
  link?: string;
  /** Saves the check for this user when set; otherwise the box is local only. */
  checkId?: string;
  /** Turns the row into a highlighted call to action. */
  action?: { label: string; onClick: () => void };
}) {
  const [done, setDone] = useOnboardingCheck(checkId);
  const featured = !!action && !done;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 6,
        padding: featured ? "10px 12px" : "6px 8px",
        borderRadius: featured ? 8 : 6,
        background: done ? "#f8f6ec" : featured ? "#eff6ff" : "transparent",
        border: featured ? "1.5px solid #56a1d2" : "1.5px solid transparent",
        transition: "background 0.15s",
      }}
    >
      <label style={{ display: "flex", gap: 10, cursor: "pointer", alignItems: "flex-start", flex: 1 }}>
        <input
          type="checkbox"
          checked={done}
          onChange={() => setDone(!done)}
          style={{ marginTop: 2, accentColor: "#d2b356", cursor: "pointer", flexShrink: 0 }}
        />
        <span
          style={{
            fontSize: featured ? 14 : 13,
            fontWeight: featured ? 700 : 400,
            color: done ? "#aaa" : featured ? "#111" : "#222",
            textDecoration: done ? "line-through" : "none",
            lineHeight: 1.5,
          }}
        >
          {children}
          {link && !done && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#56a1d2", marginLeft: 6, fontSize: 11, fontWeight: 700 }}
              onClick={(e) => e.stopPropagation()}
            >
              ↗
            </a>
          )}
        </span>
      </label>
      {action && !done && (
        <button
          type="button"
          onClick={action.onClick}
          style={{
            flexShrink: 0,
            padding: "7px 14px",
            background: "#56a1d2",
            color: "#fff",
            border: "none",
            borderRadius: 7,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      style={{
        position: "absolute",
        top: 10,
        right: 10,
        padding: "4px 12px",
        background: copied ? "#d2b356" : "#fff",
        border: "1px solid #d2b356",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 700,
        color: copied ? "#fff" : "#d2b356",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export function CopyBox({ content }: { content: string }) {
  return (
    <div style={{ position: "relative", marginTop: 10 }}>
      <pre
        style={{
          background: "#f8f6ec",
          border: "1px solid #ede9d8",
          borderRadius: 8,
          padding: "14px 16px",
          paddingRight: 80,
          fontSize: 12,
          lineHeight: 1.7,
          color: "#333",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          margin: 0,
          fontFamily: "inherit",
        }}
      >
        {content}
      </pre>
      <CopyButton content={content} />
    </div>
  );
}

export function MarkdownCopyBox({ content, maxHeight }: { content: string; maxHeight?: number }) {
  return (
    <div style={{ position: "relative", marginTop: 10 }}>
      <div
        style={{
          maxHeight,
          overflowY: maxHeight ? "auto" : undefined,
          background: "#f8f6ec",
          border: "1px solid #ede9d8",
          borderRadius: 8,
          padding: "14px 16px",
          paddingRight: 80,
          fontSize: 12,
          lineHeight: 1.7,
          color: "#333",
        }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <p style={{ margin: "0 0 8px" }}>{children}</p>,
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "#56a1d2", fontWeight: 600 }}>
                {children}
              </a>
            ),
            ul: ({ children }) => <ul style={{ margin: "4px 0 8px", paddingLeft: 18 }}>{children}</ul>,
            li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
            hr: () => <hr style={{ border: "none", borderTop: "1px solid #ede9d8", margin: "10px 0" }} />,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
      <CopyButton content={content} />
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 1.5,
        color: "#d2b356",
        margin: "0 0 10px 2px",
      }}
    >
      {children}
    </p>
  );
}
