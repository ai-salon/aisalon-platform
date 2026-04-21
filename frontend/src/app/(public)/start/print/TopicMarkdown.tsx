"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function TopicMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p style={{ fontSize: 11, color: "#444", lineHeight: 1.5, margin: "0 0 4px" }}>
            {children}
          </p>
        ),
        h2: ({ children }) => (
          <h2 style={{ fontSize: 11, fontWeight: 700, color: "#111", margin: "8px 0 4px" }}>
            {children}
          </h2>
        ),
        ul: ({ children }) => (
          <ul style={{ margin: "2px 0 6px", paddingLeft: 16 }}>{children}</ul>
        ),
        li: ({ children }) => (
          <li style={{ fontSize: 11, color: "#555", lineHeight: 1.4, marginBottom: 2 }}>
            {children}
          </li>
        ),
        a: ({ href, children }) => (
          <a href={href} style={{ color: "#56a1d2", fontSize: 11 }}>
            {children}
          </a>
        ),
        strong: ({ children }) => (
          <strong style={{ fontWeight: 700, color: "#333" }}>{children}</strong>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
