"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import OnboardingBanner, { type OnboardingStep } from "@/components/OnboardingBanner";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function TeamAvatar({ url, name, size = 28 }: { url: string; name: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const src = url.startsWith("/") ? `${API_URL}${url}` : url;
  if (!url || broken) {
    return (
      <div style={{ width: size, height: size, borderRadius: "50%", background: "#f0ebe0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.43, flexShrink: 0 }}>
        👤
      </div>
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
      <img src={src} alt={name} onError={() => setBroken(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );
}

// ─── Reusable primitives ──────────────────────────────────────────────────────

function Accordion({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      style={{
        border: "1px solid #ede9d8",
        borderRadius: 10,
        marginBottom: 8,
        overflow: "hidden",
        boxShadow: open ? "0 2px 12px rgba(0,0,0,0.05)" : "none",
        transition: "box-shadow 0.2s",
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
          background: open ? "#fdf9f0" : "#fafaf8",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {icon && <span style={{ fontSize: 17, lineHeight: 1 }}>{icon}</span>}
          <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{title}</span>
        </span>
        <span
          style={{
            color: "#d2b356",
            fontSize: 10,
            fontWeight: 700,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
            flexShrink: 0,
          }}
        >
          ▼
        </span>
      </button>
      {open && (
        <div
          style={{
            padding: "16px 18px 20px",
            borderTop: "1px solid #ede9d8",
            background: "#fff",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function CheckItem({
  children,
  link,
}: {
  children: React.ReactNode;
  link?: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <label
      style={{
        display: "flex",
        gap: 10,
        cursor: "pointer",
        alignItems: "flex-start",
        marginBottom: 6,
        padding: "6px 8px",
        borderRadius: 6,
        background: done ? "#f8f6ec" : "transparent",
        transition: "background 0.15s",
      }}
    >
      <input
        type="checkbox"
        checked={done}
        onChange={() => setDone(!done)}
        style={{ marginTop: 2, accentColor: "#d2b356", cursor: "pointer", flexShrink: 0 }}
      />
      <span
        style={{
          fontSize: 13,
          color: done ? "#aaa" : "#222",
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
  );
}

function CopyBox({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
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
      <button
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
    </div>
  );
}

function MarkdownCopyBox({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ position: "relative", marginTop: 10 }}>
      <div
        style={{
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
      <button
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
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
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

function QuickLink({ href, emoji, label }: { href: string; emoji: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 7,
        fontSize: 13,
        color: "#56a1d2",
        textDecoration: "none",
        fontWeight: 600,
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = "#eff6ff")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = "transparent")}
    >
      <span style={{ fontSize: 14 }}>{emoji}</span>
      {label}
    </a>
  );
}

function ValueRow({
  emoji,
  title,
  desc,
}: {
  emoji: string;
  title: string;
  desc: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "9px 0",
        borderBottom: "1px solid #f0ebe0",
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.4 }}>{emoji}</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#111", marginBottom: 1 }}>{title}</div>
        <div style={{ fontSize: 11, color: "#696969", lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  );
}

// ─── Guide sections ───────────────────────────────────────────────────────────

function HostingGuide() {
  return (
    <div>
      <Accordion icon="✅" title="Setup Checklist" defaultOpen>
        <p style={{ fontSize: 13, color: "#696969", marginBottom: 14, lineHeight: 1.6 }}>
          Work through these steps before your first event, then use the per-event checklist for every salon you run.
        </p>

        <SectionLabel>Before your first event</SectionLabel>
        <CheckItem link="https://docs.google.com/forms/d/e/1FAIpQLScOHdporrmJFLXZ1RvuRAH7At5_O9HcD1PUI4ObO0E4dexUZw/viewform">
          Fill out the hosting interest form
        </CheckItem>
        <CheckItem link="https://cal.com/ianeisenberg/ai-salon-coordination">
          Schedule a 1:1 with Ian Eisenberg
        </CheckItem>
        <CheckItem link="https://aisalon.xyz/">
          Read the Ai Salon website — understand what we&apos;re about
        </CheckItem>
        <CheckItem>
          Join the &ldquo;Ai Salon Hosts: Global&rdquo; WhatsApp group (Ian will invite you during your 1:1)
        </CheckItem>
        <CheckItem>Connect with a co-host to support you on your first event</CheckItem>

        <div style={{ height: 14 }} />
        <SectionLabel>⭐ For every event</SectionLabel>
        <CheckItem>Secure a space and choose a theme</CheckItem>
        <CheckItem link="https://lu.ma/">
          Create a Luma event, add to the Ai Salon calendar, add contact@aisalon.xyz as co-host
        </CheckItem>
        <CheckItem>Get event approved on the Ai Salon calendar</CheckItem>
        <CheckItem>Curate attendees using registration questions</CheckItem>
        <CheckItem>Run the salon — introduce values, record, take photos</CheckItem>
        <CheckItem link="/upload">
          Upload the recording to the member portal
        </CheckItem>
        <CheckItem link="https://photos.app.goo.gl/27GC3nktVkvDL11x8">
          Upload photos to the shared album
        </CheckItem>
        <CheckItem>Follow up with attendees</CheckItem>
      </Accordion>

      <Accordion icon="🧘" title="Values & Dialogue Agreements">
        <p style={{ fontSize: 13, color: "#444", lineHeight: 1.6, marginBottom: 12 }}>
          Start every salon by explicitly setting the conversation culture. Open by naming these three values:
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {[
            { e: "🧘", v: "Give and Take Space" },
            { e: "🔭", v: "Seek the Truth" },
            { e: "🚀", v: "Encourage Exploration" },
          ].map(({ e, v }) => (
            <span
              key={v}
              style={{
                padding: "7px 14px",
                background: "#fdf9f0",
                border: "1px solid #ede9d8",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600,
                color: "#333",
              }}
            >
              {e} {v}
            </span>
          ))}
        </div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 6 }}>
          Additional principles to invoke:
        </p>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#444", lineHeight: 1.9 }}>
          <li>Listen as if the speaker is the most important person in the world</li>
          <li>Suspend initial judgment</li>
          <li>Creative conflict is welcome</li>
          <li>Practice equity of voice</li>
          <li>Lead with curiosity</li>
        </ul>
      </Accordion>

      <Accordion icon="🤔" title="Plan Your Salon">
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 8 }}>
            Two formats
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              {
                title: "General Salons",
                tag: "AI Enthused",
                desc: "Passionate amateurs exploring a theme. Broad topics work well — Education, Relationships, Space.",
              },
              {
                title: "Expert Series",
                tag: "AI Empowered",
                desc: "Professionals with deep expertise. Same theme across 3+ monthly sessions. Use snowball recruiting.",
              },
            ].map(({ title, tag, desc }) => (
              <div
                key={title}
                style={{
                  padding: "12px 14px",
                  background: "#f8f6ec",
                  borderRadius: 8,
                  border: "1px solid #ede9d8",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{title}</div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#56a1d2",
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    margin: "3px 0 6px",
                  }}
                >
                  {tag}
                </div>
                <div style={{ fontSize: 12, color: "#696969", lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 6 }}>
          Finding a space
        </p>
        <p style={{ fontSize: 13, color: "#444", lineHeight: 1.6, marginBottom: 6 }}>
          8–20 people works great. Any comfortable, distraction-free space works:
        </p>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#444", lineHeight: 1.9 }}>
          <li>Your home — easy and cozy</li>
          <li>Coworking spaces or social areas you have access to</li>
          <li>Public libraries</li>
          <li>Cafes</li>
        </ul>
      </Accordion>

      <Accordion icon="📅" title="Create & Promote the Event">
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 4 }}>
            Event name &amp; duration
          </p>
          <p style={{ fontSize: 13, color: "#444" }}>
            Name:{" "}
            <code
              style={{
                background: "#f8f6ec",
                padding: "1px 6px",
                borderRadius: 4,
                fontFamily: "monospace",
                fontSize: 12,
              }}
            >
              Ai Salon: [Theme]
            </code>
            &nbsp;·&nbsp; Duration: 2–3 hours
          </p>
        </div>

        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 6 }}>
            Luma setup
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#444", lineHeight: 1.9 }}>
            <li>
              Create the event early — set visibility to <strong>private</strong> first
            </li>
            <li>
              Add <strong>contact@aisalon.xyz</strong> as co-host
            </li>
            <li>Go public 2–3 weeks before (you can do this before you have the location)</li>
            <li>Require approval; hide the address until approved</li>
            <li>Add registration questions to help curate attendees</li>
          </ul>
        </div>

        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 6 }}>
            Suggested registration questions
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#444", lineHeight: 1.9 }}>
            <li>&ldquo;What topics would you explore in the context of this theme?&rdquo;</li>
            <li>&ldquo;What is your personal or professional relationship with AI?&rdquo;</li>
            <li>&ldquo;LinkedIn URL&rdquo;</li>
          </ul>
          <p style={{ fontSize: 12, color: "#696969", marginTop: 8 }}>
            Curate for: enthusiasm, knowledge, diversity of perspective, diversity of demographics.
            Typical acceptance rate ~50% — accept 20–30 if you want 15 attendees.
          </p>
        </div>

        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 4 }}>
            Standard event description footer
          </p>
          <p style={{ fontSize: 12, color: "#696969", marginBottom: 4 }}>
            Always include this at the bottom of your Luma event:
          </p>
          <CopyBox
            content={`The Ai Salon is a global community founded in San Francisco focused on intimate, small-sized group discussions on the sociological, economic, cultural, and philosophical impacts and meaning of AI developments. We host small group discussions, all of which you can find on our calendar. You can find summaries of our previous conversations on our substack.

https://aisalon.xyz/ · https://lu.ma/ai-salon · https://aisalon.substack.com`}
          />
        </div>
      </Accordion>

      <Accordion icon="💬" title="Run the Salon">
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 10 }}>
            Event format (~3 hours)
          </p>
          <div>
            {[
              ["0:00 – 0:20", "Chit-chat and arrivals"],
              ["0:20 – 0:35", "Formal start — introduce Ai Salon, theme, set values"],
              ["0:35 – 1:05", "Introductions (~30 min — focus on why people are there, not just titles)"],
              ["1:05 – 2:45", "Salon conversation"],
              ["2:45 – 3:00", "Wrap-up — takeaways, open questions, new ideas"],
              ["3:00+", "Open social time — food/drinks, help people connect"],
            ].map(([time, desc]) => (
              <div
                key={time}
                style={{
                  display: "flex",
                  gap: 14,
                  padding: "8px 0",
                  borderBottom: "1px solid #f0ebe0",
                  fontSize: 13,
                  color: "#444",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#d2b356",
                    minWidth: 96,
                    flexShrink: 0,
                    paddingTop: 1,
                  }}
                >
                  {time}
                </span>
                <span style={{ lineHeight: 1.5 }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 6 }}>
            Introducing the Ai Salon — key themes
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#444", lineHeight: 1.9 }}>
            <li>
              &ldquo;AI will impact everyone — everyone should impact AI&rdquo;
            </li>
            <li>Global org with chapters in SF, Lagos, Vancouver, Bangalore, and more</li>
            <li>Multiple lenses: philosophical, historical, cultural, technical</li>
            <li>Participatory AI development starts with conversation</li>
          </ul>
        </div>

        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 6 }}>
            Facilitation tips
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#444", lineHeight: 1.9 }}>
            <li>Let conversation flow organically; interject only when needed</li>
            <li>
              Overly enthusiastic contributor: &ldquo;Thanks — I&apos;d love to hear from some others for a bit&rdquo;
            </li>
            <li>
              Negative direction: &ldquo;This isn&apos;t the best forum for that&rdquo; — firmly but kindly
            </li>
            <li>
              Follow divergence → emergence → convergence (the &ldquo;diamond of participation&rdquo;)
            </li>
            <li>You&apos;re the facilitator first, not the expert speaker</li>
          </ul>
        </div>
      </Accordion>

      <Accordion icon="🙏" title="After the Salon">
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 8 }}>
            Immediate actions
          </p>
          <CheckItem link="/upload">
            Upload the recording in the member portal
          </CheckItem>
          <CheckItem link="https://photos.app.goo.gl/27GC3nktVkvDL11x8">
            Upload photos to the shared Google album
          </CheckItem>
          <CheckItem>Send follow-up email to attendees (template below)</CheckItem>
          <CheckItem>Post a recap on social media — tag @TheAISalonSF on X and LinkedIn</CheckItem>
        </div>

        <p style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 4 }}>
          Follow-up email template
        </p>
        <CopyBox
          content={`Thanks everyone that joined!

📖 Our article on [THEME] will be on our substack soon! We love keeping the conversation going so feedback or comments on any post is always appreciated. The Ai Salon is a broader community with a lot going on, and you can be part of it!

🗓️ Subscribe to our calendar: https://lu.ma/Ai-salon

📝 Interested in hosting? https://docs.google.com/forms/d/e/1FAIpQLScOHdporrmJFLXZ1RvuRAH7At5_O9HcD1PUI4ObO0E4dexUZw/viewform

💬 Join our WhatsApp community: https://chat.whatsapp.com/GhNRrDFcZnIBPFFIjdT3gz

✉️ Feedback? contact@aisalon.xyz

Best,
[YOUR NAME]`}
        />
      </Accordion>
    </div>
  );
}

function ChapterLeadGuide() {
  return (
    <div>
      <Accordion icon="🚀" title="Getting Started Checklist" defaultOpen>
        <p style={{ fontSize: 13, color: "#696969", lineHeight: 1.6, marginBottom: 12 }}>
          This guide complements the Hosting Guide — make sure you know that well first! Then work through these
          chapter-lead-specific steps.
        </p>
        <CheckItem link="https://aisalon.xyz/">Read the Ai Salon website</CheckItem>
        <CheckItem link="https://docs.google.com/document/d/1KFdrYrIwfeK8juz1-oLyN_qhQ3HN2MUs3MZ6vNRiPeE/edit">
          Read the Ai Salon about doc
        </CheckItem>
        <CheckItem link="https://aisalon.substack.com">Read several previous Substacks</CheckItem>
        <CheckItem>
          Contact Ian to be added to the chapter&apos;s private WhatsApp group, the Chapter Leads channel, and monthly
          check-ins
        </CheckItem>
        <CheckItem>Identify marketing channels for your city</CheckItem>
        <CheckItem>Expand the chapter by recruiting additional hosts</CheckItem>
        <CheckItem>Run your first salon event!</CheckItem>
      </Accordion>

      <Accordion icon="📋" title="Your Expectations as Chapter Lead">
        <p style={{ fontSize: 13, color: "#444", lineHeight: 1.6, marginBottom: 12 }}>
          Being a chapter lead means leading Ai Salon&apos;s mission to create civic engagement with AI in your region.
          Color your chapter with your personality and the character of your city!
        </p>
        <SectionLabel>Core commitments</SectionLabel>
        <CheckItem>
          Ensure an Ai Salon is held <strong>at least once a month</strong> — you don&apos;t have to facilitate every
          one, just make sure it happens
        </CheckItem>
        <CheckItem>
          Attend monthly Chapter Lead touchpoints (1st Tuesday of each month, 8–8:45am PT)
        </CheckItem>
        <CheckItem>Represent the Ai Salon consistently and embody our values</CheckItem>
        <CheckItem>
          Grow the salon — support people who show interest and help them get started
        </CheckItem>
      </Accordion>

      <Accordion icon="🎯" title="Representing the Ai Salon">
        <p style={{ fontSize: 13, color: "#444", lineHeight: 1.6, marginBottom: 12 }}>
          As a chapter lead you are an ambassador. Consistency across every touchpoint builds trust in the brand.
        </p>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#444", lineHeight: 1.9 }}>
          <li>Embody our values in all interactions and events</li>
          <li>Maintain consistency in messaging and branding across all platforms</li>
          <li>Stay informed about AI developments and Ai Salon org updates</li>
          <li>Foster a welcoming, inclusive environment for all participants</li>
          <li>
            Use brand assets (table tents, logos) especially when co-hosting with partners
          </li>
        </ul>
      </Accordion>

      <Accordion icon="📅" title="Touchpoints & Communication">
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 6 }}>
            Monthly sync
          </p>
          <p style={{ fontSize: 13, color: "#444", lineHeight: 1.6 }}>
            First Tuesday of every month, 8–8:45am PT. Three agenda items:
          </p>
          <ol style={{ margin: "8px 0 0", paddingLeft: 20, fontSize: 13, color: "#444", lineHeight: 1.9 }}>
            <li>Org-wide updates</li>
            <li>Chapter updates, questions, concerns, and opportunities</li>
            <li>Ideating on future initiatives</li>
          </ol>
          <p style={{ fontSize: 12, color: "#696969", marginTop: 8 }}>
            Notes are recorded in a shared Google doc.
          </p>
        </div>

        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 6 }}>
            WhatsApp channels
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#444", lineHeight: 1.9 }}>
            <li>
              <strong>Chapter Leads group</strong> — share successes, challenges, and collaborate across chapters
            </li>
            <li>
              <strong>Your chapter&apos;s local group</strong> — for core members and hosts in your city
            </li>
          </ul>
        </div>

        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 6 }}>1:1 with Ian</p>
          <a
            href="https://cal.com/ianeisenberg/ai-salon-coordination"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 13, color: "#56a1d2", fontWeight: 700 }}
          >
            Book time on Cal.com →
          </a>
        </div>
      </Accordion>

      <Accordion icon="🤲" title="Expanding Your Chapter">
        <p style={{ fontSize: 13, color: "#444", lineHeight: 1.6, marginBottom: 12 }}>
          The single biggest thing you can do is recruit additional hosts.{" "}
          <strong>A team of 6 is ideal</strong>: 2 chapter leads + 4 volunteers and hosts you can rely on.
        </p>

        <div
          style={{
            padding: "10px 14px",
            background: "#eff6ff",
            borderRadius: 8,
            border: "1px solid #bfdbfe",
            marginBottom: 14,
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8", margin: "0 0 4px" }}>
            Volunteer onboarding is automated
          </p>
          <p style={{ fontSize: 12, color: "#444", margin: 0, lineHeight: 1.5 }}>
            When someone fills out the interest form they automatically receive an email with the volunteer agreement,
            wiki, and hosting guide. You&apos;ll then connect with them for a 1:1.
          </p>
        </div>

        <p style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 6 }}>
          Tactics that work:
        </p>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#444", lineHeight: 1.9 }}>
          <li>At every salon, explicitly mention that people can get involved</li>
          <li>
            Include the{" "}
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLScOHdporrmJFLXZ1RvuRAH7At5_O9HcD1PUI4ObO0E4dexUZw/viewform"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#56a1d2" }}
            >
              volunteer form
            </a>{" "}
            in all follow-up emails
          </li>
          <li>Personally ask great contributors if they&apos;d like to host</li>
          <li>Check in often — building the hosting habit takes time</li>
          <li>Host a community-building event once you&apos;ve built momentum (use the intro deck)</li>
        </ul>
      </Accordion>

      <Accordion icon="📡" title="Marketing & Partnerships">
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 6 }}>
            Finding marketing channels
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#444", lineHeight: 1.9 }}>
            <li>Advertise on Luma aggregators in your city (e.g. lu.ma/boston)</li>
            <li>Find local newsletters that cover AI or tech events</li>
            <li>Post on LinkedIn and Instagram</li>
            <li>Approach thought leaders to share about the salon</li>
            <li>Network at AI meetups and student clubs</li>
            <li>Partner with aligned orgs for first events to reach their audience</li>
          </ul>
          <p style={{ fontSize: 12, color: "#696969", marginTop: 8 }}>
            When you discover a new channel that works, update the shared marketing channels database!
          </p>
        </div>

        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 6 }}>
            Working with partners
          </p>
          <p style={{ fontSize: 13, color: "#444", lineHeight: 1.6 }}>
            Partners can provide venues, food, and extended reach. When co-hosting, be intentional about keeping the Ai
            Salon identity distinct — bring table tents, ensure we&apos;re featured prominently in all advertising. Add
            them to the team directory as a collaborator.
          </p>
        </div>
      </Accordion>
    </div>
  );
}

// ─── Event Creator ────────────────────────────────────────────────────────────

function EventCreator({
  chapterName,
  chapterCode,
}: {
  chapterName?: string;
  chapterCode?: string;
}) {
  const [theme, setTheme] = useState("");
  const [format, setFormat] = useState<"general" | "expert">("general");
  const [generated, setGenerated] = useState(false);

  const city = chapterName || "";
  const lumaTag = chapterCode || "";

  const eventTitle = theme
    ? `Ai Salon: ${theme}${lumaTag ? ` [${lumaTag.toUpperCase()}]` : ""}`
    : "";

  const expertNote =
    format === "expert"
      ? `\n\nThis is part of our Expert Series — a recurring monthly conversation on ${theme || "[THEME]"} with professionals who work closely with AI. We meet regularly to explore how this theme evolves over time.`
      : "";

  const eventDescription = `Join us for an intimate Ai Salon conversation on "${theme || "[THEME]"}".${expertNote}

[FILL IN: 2–3 sentences describing what makes this theme timely or interesting. What tension or question is at the heart of it? Why should someone show up?]

We'll explore questions like:
• [FILL IN: A specific question about this theme]
• [FILL IN: Another angle — personal, societal, or philosophical]
• [FILL IN: An open-ended question that invites diverse perspectives]

---
⏱️ 2–3 hours

---
[The Ai Salon](https://aisalon.xyz/) is a global community founded in San Francisco focused on intimate, small-sized group discussions on the sociological, economic, cultural, and philosophical impacts and meaning of AI developments. We host small group discussions, all of which you can find on [our calendar](https://lu.ma/ai-salon). You can find summaries of our [previous conversations on our substack](https://aisalon.substack.com/).

*Please be advised: Unfortunately, space is very limited at these in-person community events and we can not always accept everyone we would like to. If you are not accepted to this event, please try and come to another.!*`;

  const regQuestions = [
    `What topics would you most want to explore in the context of "${theme || "[THEME]"}"?`,
    "What is your personal or professional relationship with AI?",
    "LinkedIn URL",
  ];

  const promotionChannels = [
    {
      emoji: "🗓️",
      label: "Luma — Global Ai Salon Calendar",
      desc: "Creates directly on the Ai Salon calendar. Add contact@aisalon.xyz as co-host once created.",
      link: "https://luma.com/create?calendar=cal-XHZLGpY8HDOAYm3",
      linkLabel: "Create event on Ai Salon calendar →",
      primary: true,
    },
    ...(lumaTag
      ? [
          {
            emoji: "📍",
            label: `Luma — ${city || lumaTag} Local Feed`,
            desc: `Submit your event to appear in the local Luma aggregator for ${city || lumaTag}`,
            link: `https://lu.ma/${lumaTag}`,
            linkLabel: `Browse lu.ma/${lumaTag} →`,
          },
        ]
      : []),
    {
      emoji: "💼",
      label: "LinkedIn",
      desc: "Post about the event and tag @The Ai Salon. Share in AI-focused groups and your network.",
      link: "https://www.linkedin.com/company/92632727/",
      linkLabel: "Ai Salon LinkedIn →",
    },
    {
      emoji: "𝕏",
      label: "X / Twitter",
      desc: "Post and tag @TheAISalonSF. Use hashtags: #AiSalon #AI #[YourCity]",
      link: "https://x.com/TheAISalonSF",
      linkLabel: "@TheAISalonSF →",
    },
    {
      emoji: "💬",
      label: "WhatsApp — Ai Salon Hosts",
      desc: "Share your event link in the Ai Salon Hosts: Global WhatsApp group for cross-chapter visibility",
      link: "https://chat.whatsapp.com/GhNRrDFcZnIBPFFIjdT3gz",
      linkLabel: "Community WhatsApp →",
    },
    {
      emoji: "📰",
      label: "Local AI & Tech Newsletters",
      desc: "Reach out to city-specific newsletters, Substack writers, or community managers covering AI events in your area",
      link: null,
      linkLabel: null,
    },
    {
      emoji: "🤝",
      label: "Meetup.com & Local Groups",
      desc: "Post in AI meetup groups, university AI clubs, or professional communities in your city",
      link: "https://www.meetup.com/find/?keywords=artificial+intelligence",
      linkLabel: "Find AI groups →",
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111", margin: "0 0 4px" }}>
          🗓️ Event Creator
        </h2>
        <p style={{ fontSize: 13, color: "#696969", margin: 0 }}>
          Generate ready-to-use event templates for Luma, then find out where to promote.
        </p>
      </div>

      {/* Step 1: Inputs */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #ede9d8",
          borderRadius: 12,
          padding: "20px 22px",
          marginBottom: 20,
        }}
      >
        <SectionLabel>Step 1 — Event Details</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#444", marginBottom: 5 }}>
              Theme / Topic *
            </label>
            <input
              type="text"
              value={theme}
              onChange={(e) => { setTheme(e.target.value); setGenerated(false); }}
              placeholder="e.g. AI & Relationships, Future of Work, Creativity..."
              style={{
                width: "100%",
                padding: "9px 12px",
                border: "1px solid #ddd",
                borderRadius: 7,
                fontSize: 13,
                color: "#111",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#444", marginBottom: 5 }}>
              Format
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["general", "expert"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => { setFormat(f); setGenerated(false); }}
                  style={{
                    flex: 1,
                    padding: "9px 12px",
                    border: `1.5px solid ${format === f ? "#56a1d2" : "#ddd"}`,
                    borderRadius: 7,
                    background: format === f ? "#eff6ff" : "#fff",
                    color: format === f ? "#1d4ed8" : "#555",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {f === "general" ? "General Salon" : "Expert Series"}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: "#999", margin: "5px 0 0" }}>
              {format === "general"
                ? "Broad theme, diverse attendees — AI Enthused"
                : "Deep expertise, recurring series — AI Empowered"}
            </p>
          </div>
        </div>
        <button
          onClick={() => { if (theme.trim()) setGenerated(true); }}
          disabled={!theme.trim()}
          style={{
            padding: "10px 24px",
            background: theme.trim() ? "#56a1d2" : "#ccc",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: theme.trim() ? "pointer" : "not-allowed",
            transition: "background 0.15s",
          }}
        >
          Generate Templates →
        </button>
      </div>

      {/* Step 2: Generated templates */}
      {generated && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #ede9d8",
            borderRadius: 12,
            padding: "20px 22px",
            marginBottom: 20,
          }}
        >
          <SectionLabel>Step 2 — Copy Your Templates</SectionLabel>

          <div style={{ marginBottom: 18 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#111", margin: "0 0 4px" }}>
              Event Title
            </p>
            <CopyBox content={eventTitle} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#111", margin: "0 0 4px" }}>
              Event Description
            </p>
            <p style={{ fontSize: 11, color: "#999", margin: "0 0 4px" }}>
              Paste into Luma, then replace all <strong>[FILL IN]</strong> sections before publishing.
            </p>
            <MarkdownCopyBox content={eventDescription} />
          </div>

          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#111", margin: "0 0 6px" }}>
              Registration Questions
            </p>
            <p style={{ fontSize: 11, color: "#999", margin: "0 0 8px" }}>
              Add these in Luma under &ldquo;Registration&rdquo; → &ldquo;Questions&rdquo;. Curate for enthusiasm, knowledge, and diversity.
            </p>
            {regQuestions.map((q, i) => (
              <div key={i} style={{ marginBottom: 6 }}>
                <CopyBox content={q} />
              </div>
            ))}
            <p style={{ fontSize: 11, color: "#696969", marginTop: 8, lineHeight: 1.5 }}>
              Typical acceptance rate ~50% — accept 20–30 guests if you want 15 attendees.
            </p>
          </div>
        </div>
      )}

      {/* Step 3: Create + Promote */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #ede9d8",
          borderRadius: 12,
          padding: "20px 22px",
        }}
      >
        <SectionLabel>Step 3 — Create &amp; Promote</SectionLabel>

        {/* Luma CTA */}
        <a
          href="https://luma.com/create?calendar=cal-XHZLGpY8HDOAYm3"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            background: "linear-gradient(135deg, #56a1d2 0%, #3d7fb8 100%)",
            borderRadius: 10,
            textDecoration: "none",
            marginBottom: 20,
            color: "#fff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🗓️</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.2 }}>Create Event on Luma</div>
              <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
                Use your generated templates above · Add contact@aisalon.xyz as co-host
              </div>
            </div>
          </div>
          <span style={{ fontSize: 18, fontWeight: 700 }}>→</span>
        </a>

        {/* Luma settings reminder */}
        <div
          style={{
            padding: "12px 14px",
            background: "#fdf9f0",
            border: "1px solid #ede9d8",
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 700, color: "#d2b356", margin: "0 0 6px" }}>
            ✅ Luma settings checklist
          </p>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "#555", lineHeight: 1.8 }}>
            <li>Set visibility to <strong>Private</strong> first, go public 2–3 weeks out</li>
            <li>Enable <strong>Approval Required</strong> and hide address until approved</li>
            <li>Add <strong>contact@aisalon.xyz</strong> as a co-host</li>
            <li>Add the 3 registration questions above</li>
            {lumaTag && (
              <li>
                Tag with <strong>{lumaTag}</strong> so it appears on the{" "}
                <a
                  href={`https://lu.ma/Ai-salon?tag=${lumaTag}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#56a1d2" }}
                >
                  Ai Salon {city} calendar
                </a>
              </li>
            )}
          </ul>
        </div>

        {/* Promotion channels */}
        <p style={{ fontSize: 12, fontWeight: 700, color: "#444", margin: "0 0 8px" }}>
          Where to promote your event
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {promotionChannels.map(({ emoji, label, desc, link, linkLabel, primary }) => (
            <div
              key={label}
              style={{
                display: "flex",
                gap: 8,
                padding: "7px 10px",
                background: primary ? "#eff6ff" : "#fafaf8",
                border: `1px solid ${primary ? "#bfdbfe" : "#ede9d8"}`,
                borderRadius: 6,
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 14, flexShrink: 0 }}>{emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>{label}</span>
                {link && linkLabel && (
                  <>
                    {" · "}
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12, color: "#56a1d2", fontWeight: 600, textDecoration: "none" }}
                    >
                      {linkLabel}
                    </a>
                  </>
                )}
                <div style={{ fontSize: 11, color: "#888", lineHeight: 1.4 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Resources Tab ────────────────────────────────────────────────────────────

function ResourcesTab({ isChapterLead }: { isChapterLead: boolean }) {
  const [subTab, setSubTab] = useState<"hosting" | "chapter">("hosting");

  const tabs = [
    { id: "hosting" as const, label: "🏡 Hosting Guide" },
    ...(isChapterLead ? [{ id: "chapter" as const, label: "🗺️ Chapter Lead Guide" }] : []),
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111", margin: "0 0 4px" }}>
          📚 Resources
        </h2>
        <p style={{ fontSize: 13, color: "#696969", margin: 0 }}>
          Guides and references for running great Ai Salon events.
        </p>
      </div>

      {isChapterLead && (
        <div
          style={{
            display: "flex",
            gap: 4,
            background: "#f0ebe0",
            padding: 4,
            borderRadius: 10,
            marginBottom: 20,
            width: "fit-content",
          }}
        >
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setSubTab(id)}
              style={{
                padding: "7px 18px",
                borderRadius: 7,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 700,
                background: subTab === id ? "#fff" : "transparent",
                color: subTab === id ? "#111" : "#696969",
                boxShadow: subTab === id ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {subTab === "hosting" && <HostingGuide />}
      {subTab === "chapter" && isChapterLead && <ChapterLeadGuide />}
    </div>
  );
}

// ─── Chapter Guide ────────────────────────────────────────────────────────────

function ChapterGuideTab({
  chapterId,
  chapterName,
  canEdit,
}: {
  chapterId: string;
  chapterName: string;
  canEdit: boolean;
}) {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken;

  const [guide, setGuide] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!token || !chapterId) return;
    setLoading(true);
    fetch(`${API_URL}/admin/chapters/${chapterId}/guide`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setGuide(d.chapter_guide ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token, chapterId]);

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    setSaveError("");
    const r = await fetch(`${API_URL}/admin/chapters/${chapterId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ chapter_guide: draft }),
    });
    setSaving(false);
    if (!r.ok) {
      setSaveError("Failed to save. Please try again.");
      return;
    }
    const updated = await r.json();
    setGuide(updated.chapter_guide ?? null);
    setEditing(false);
  }

  function startEdit() {
    setDraft(guide ?? "");
    setSaveError("");
    setEditing(true);
  }

  if (loading) {
    return (
      <div style={{ padding: "40px 0", color: "#696969", fontSize: 14 }}>Loading…</div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111", margin: "0 0 4px" }}>
            📖 Chapter Guide
          </h2>
          <p style={{ fontSize: 13, color: "#696969", margin: 0 }}>
            {chapterName} — internal notes and resources for your chapter team.
          </p>
        </div>
        {canEdit && !editing && (
          <button
            onClick={startEdit}
            style={{
              fontSize: 13,
              fontWeight: 700,
              padding: "8px 18px",
              borderRadius: 8,
              border: "1.5px solid #56a1d2",
              color: "#56a1d2",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            ✏️ Edit
          </button>
        )}
      </div>

      {editing ? (
        <div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write your chapter guide in Markdown…

# Welcome to the [City] Chapter

Add notes, links, local contacts, recurring event info, and anything your team needs to know."
            style={{
              width: "100%",
              minHeight: 400,
              padding: "16px",
              fontSize: 14,
              lineHeight: 1.7,
              border: "1.5px solid #d1d5db",
              borderRadius: 10,
              outline: "none",
              fontFamily: "monospace",
              resize: "vertical",
              boxSizing: "border-box",
              background: "#fafaf8",
            }}
            autoFocus
          />
          <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                fontSize: 13,
                fontWeight: 700,
                padding: "9px 22px",
                borderRadius: 8,
                border: "none",
                background: "#56a1d2",
                color: "#fff",
                cursor: "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)}
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: "9px 16px",
                borderRadius: 8,
                border: "1.5px solid #d1d5db",
                background: "#fff",
                color: "#696969",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <span style={{ fontSize: 12, color: "#9ca3af" }}>
              Markdown supported
            </span>
          </div>
          {saveError && (
            <p style={{ fontSize: 13, color: "#dc2626", marginTop: 8 }}>{saveError}</p>
          )}
        </div>
      ) : guide ? (
        <div
          style={{
            background: "#fff",
            borderRadius: 10,
            border: "1px solid #ede9d8",
            padding: "24px 28px",
          }}
        >
          <div className="chapter-guide-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{guide}</ReactMarkdown>
          </div>
        </div>
      ) : (
        <div
          style={{
            background: "#fff",
            borderRadius: 10,
            border: "2px dashed #ede9d8",
            padding: "60px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>📖</div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 6 }}>
            No chapter guide yet
          </p>
          <p style={{ fontSize: 13, color: "#696969", marginBottom: 20 }}>
            {canEdit
              ? "Add notes, local contacts, event info, and resources for your chapter team."
              : "Your chapter lead hasn't added a guide yet."}
          </p>
          {canEdit && (
            <button
              onClick={startEdit}
              style={{
                fontSize: 13,
                fontWeight: 700,
                padding: "10px 24px",
                borderRadius: 8,
                border: "none",
                background: "#56a1d2",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Create Guide
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Chapter Team Tab ─────────────────────────────────────────────────────────

function ChapterTeamTab({ chapterCode }: { chapterCode: string }) {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/chapters/${chapterCode}`)
      .then((r) => r.json())
      .then((d) => {
        setMembers(d.team_members ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [chapterCode]);

  if (loading) {
    return <div style={{ padding: "40px 0", color: "#696969", fontSize: 14 }}>Loading…</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111", margin: "0 0 4px" }}>
          👥 Chapter Team
        </h2>
        <p style={{ fontSize: 13, color: "#696969", margin: 0 }}>
          Your fellow hosts and chapter leads.
        </p>
      </div>

      {members.length === 0 ? (
        <div
          style={{
            background: "#fff",
            borderRadius: 10,
            border: "2px dashed #ede9d8",
            padding: "48px 24px",
            textAlign: "center",
            color: "#696969",
            fontSize: 14,
          }}
        >
          No team members added yet.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 16,
          }}
        >
          {members.map((m: any) => (
            <div
              key={m.id}
              style={{
                background: "#fff",
                borderRadius: 12,
                border: "1px solid #ede9d8",
                padding: "20px 16px",
                textAlign: "center",
              }}
            >
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                <TeamAvatar url={m.profile_image_url ?? ""} name={m.name} size={64} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 2 }}>
                {m.name}
              </div>
              <div style={{ fontSize: 12, color: "#56a1d2", fontWeight: 600, marginBottom: m.is_cofounder ? 4 : 0 }}>
                {m.role}
              </div>
              {m.is_cofounder && (
                <div style={{ fontSize: 11, color: "#d2b356", fontWeight: 700 }}>⭐ Co-founder</div>
              )}
              {m.linkedin && (
                <a
                  href={m.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 11, color: "#696969", marginTop: 6, display: "block" }}
                >
                  LinkedIn ↗
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Community Stats ──────────────────────────────────────────────────────────

function CommunityStats({ token }: { token: string }) {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/admin/community-stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.resolve(null)))
      .then((data) => { if (data?.totals) setStats(data); })
      .catch(() => {});
  }, [token]);

  if (!stats) return null;

  const totals = stats.totals;
  const items = [
    { label: "Published Articles", value: totals.published_count, emoji: "📰" },
    { label: "Team Members", value: totals.team_size, emoji: "👥" },
    { label: "Events Processed", value: totals.completed_jobs, emoji: "🎤" },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 12,
        marginTop: 28,
      }}
    >
      {items.map(({ label, value, emoji }) => (
        <div
          key={label}
          style={{
            background: "#fff",
            borderRadius: 10,
            border: "1px solid #ede9d8",
            padding: "16px 18px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 22 }}>{emoji}</span>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#111", lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 11, color: "#696969", marginTop: 3 }}>{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Recent Activity ──────────────────────────────────────────────────────────

function RecentActivity({ token, chapterCode }: { token: string; chapterCode: string }) {
  const [articles, setArticles] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/admin/articles`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.resolve([])))
      .then((data) => setArticles(Array.isArray(data) ? data.slice(0, 4) : []))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    fetch(`${API_URL}/chapters/${chapterCode}`)
      .then((r) => r.json())
      .then((d) => setTeam(d.team_members ?? []))
      .catch(() => {});
  }, [chapterCode]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>
      {/* Recent Articles */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <SectionLabel>Recent Articles</SectionLabel>
          <Link href="/articles" style={{ fontSize: 12, color: "#56a1d2", fontWeight: 600 }}>
            View all →
          </Link>
        </div>
        {articles.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af" }}>No articles yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {articles.map((a: any) => (
              <Link
                key={a.id}
                href="/articles"
                style={{
                  display: "block",
                  background: "#fff",
                  borderRadius: 8,
                  border: "1px solid #ede9d8",
                  padding: "10px 14px",
                  textDecoration: "none",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111", marginBottom: 3, lineHeight: 1.3 }}>
                  {a.title}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 7px",
                      borderRadius: 10,
                      background: a.status === "published" ? "#dcfce7" : "#f3f4f6",
                      color: a.status === "published" ? "#16a34a" : "#6b7280",
                    }}
                  >
                    {a.status}
                  </span>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>
                    {new Date(a.publish_date ?? a.created_at).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Team */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <SectionLabel>Your Team</SectionLabel>
          <Link href="/team" style={{ fontSize: 12, color: "#56a1d2", fontWeight: 600 }}>
            Manage →
          </Link>
        </div>
        {team.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af" }}>No team members yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[...team].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5).map((m: any) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "#fff",
                  borderRadius: 8,
                  border: "1px solid #ede9d8",
                  padding: "8px 12px",
                }}
              >
                <TeamAvatar url={m.profile_image_url ?? ""} name={m.name} size={28} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: "#696969" }}>{m.role}</div>
                </div>
              </div>
            ))}
            {team.length > 5 && (
              <p style={{ fontSize: 12, color: "#9ca3af", margin: "4px 0 0" }}>
                +{team.length - 5} more — <Link href="/team" style={{ color: "#56a1d2" }}>view all</Link>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Invite Card ──────────────────────────────────────────────────────────────

function InviteCard() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken;
  const userRole = (session?.user as any)?.role;
  const userChapterId = (session?.user as any)?.chapterId;
  const isSuperadmin = userRole === "superadmin";

  const [chapters, setChapters] = useState<{ id: string; name: string; code: string }[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState(userChapterId ?? "");
  const [selectedRole, setSelectedRole] = useState("host");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSuperadmin || !token) return;
    fetch(`${API_URL}/chapters`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((c) => {
        setChapters(c);
        if (!selectedChapterId && c.length > 0) setSelectedChapterId(c[0].id);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperadmin, token]);

  const chapterId = isSuperadmin ? selectedChapterId : userChapterId;

  async function createInvite() {
    if (!token || !chapterId) return;
    setCreating(true);
    setError("");
    try {
      const r = await fetch(`${API_URL}/admin/invites`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ chapter_id: chapterId, role: selectedRole, max_uses: 1 }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setError(body.detail ?? "Failed to create invite.");
        setCreating(false);
        return;
      }
      const invite = await r.json();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setInviteUrl(`${origin}/register?invite=${invite.token}`);
    } catch {
      setError("Something went wrong.");
    }
    setCreating(false);
  }

  function copyLink() {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "2px solid #d2b356",
        padding: "18px 16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 20 }}>✉️</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: "#111" }}>Invite a Member</span>
      </div>
      <p style={{ fontSize: 12, color: "#696969", margin: "0 0 12px", lineHeight: 1.5 }}>
        Generate a one-time invite link for someone to register.
      </p>

      {!inviteUrl ? (
        <>
          {isSuperadmin && (
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <select
                value={selectedChapterId}
                onChange={(e) => setSelectedChapterId(e.target.value)}
                style={{ flex: 1, minWidth: 100, padding: "6px 8px", fontSize: 12, border: "1.5px solid #d1d5db", borderRadius: 6, background: "#fff" }}
              >
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                style={{ padding: "6px 8px", fontSize: 12, border: "1.5px solid #d1d5db", borderRadius: 6, background: "#fff" }}
              >
                <option value="host">Host</option>
                <option value="chapter_lead">Chapter Lead</option>
              </select>
            </div>
          )}
          <button
            onClick={createInvite}
            disabled={creating || !chapterId}
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#fff",
              background: "#d2b356",
              padding: "6px 14px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              opacity: creating ? 0.7 : 1,
            }}
          >
            {creating ? "Creating…" : "Create Invite Link"}
          </button>
          {error && <p style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>{error}</p>}
        </>
      ) : (
        <div>
          <div
            style={{
              background: "#f8f6ec",
              border: "1px solid #ede9d8",
              borderRadius: 6,
              padding: "8px 10px",
              fontSize: 11,
              wordBreak: "break-all",
              color: "#333",
              lineHeight: 1.5,
              marginBottom: 8,
            }}
          >
            {inviteUrl}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={copyLink}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "5px 12px",
                borderRadius: 6,
                border: "1px solid #d2b356",
                background: copied ? "#d2b356" : "#fff",
                color: copied ? "#fff" : "#d2b356",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {copied ? "Copied!" : "Copy Link"}
            </button>
            <button
              onClick={() => { setInviteUrl(null); setCopied(false); }}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "5px 12px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#696969",
                cursor: "pointer",
              }}
            >
              New Invite
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Chapter Guide (Superadmin with selector) ─────────────────────────────────

function SuperadminChapterGuide({
  allChapters,
}: {
  allChapters: { id: string; code: string; name: string }[];
}) {
  const [selectedId, setSelectedId] = useState(allChapters[0]?.id ?? "");
  const selected = allChapters.find((c) => c.id === selectedId);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          style={{
            padding: "8px 12px",
            fontSize: 13,
            fontWeight: 600,
            border: "1.5px solid #d1d5db",
            borderRadius: 8,
            background: "#fff",
            color: "#111",
            cursor: "pointer",
          }}
        >
          {allChapters.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      {selected && (
        <ChapterGuideTab
          key={selected.id}
          chapterId={selected.id}
          chapterName={selected.name}
          canEdit
        />
      )}
    </div>
  );
}

// ─── Tab bar ─────────────────────────────────────────────────────────────────

function TabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        background: "#f0ebe0",
        padding: 4,
        borderRadius: 10,
        marginBottom: 20,
        width: "fit-content",
      }}
    >
      {tabs.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          style={{
            padding: "8px 20px",
            borderRadius: 7,
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 700,
            background: active === id ? "#fff" : "transparent",
            color: active === id ? "#111" : "#696969",
            boxShadow: active === id ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            transition: "all 0.15s",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

const HOST_STEPS: OnboardingStep[] = [
  {
    title: "Add your API keys",
    description: "You need AssemblyAI and Google AI keys to process conversations.",
    ctaLabel: "Go to Settings",
    ctaHref: "/settings",
  },
  {
    title: "Upload your first conversation",
    description: "Record or import an audio file from your last Ai Salon event.",
    ctaLabel: "Upload now",
    ctaHref: "/upload",
  },
  {
    title: "Review your generated article",
    description: "Your conversation has been transcribed and turned into a draft article. Give it a read.",
    ctaLabel: "View articles",
    ctaHref: "/articles",
  },
  {
    title: "Read the Hosting Guide",
    description: "Learn how to plan, run, and follow up on an Ai Salon event.",
    ctaLabel: "Open guide",
    ctaHref: undefined,
  },
];

const CHAPTER_LEAD_STEPS: OnboardingStep[] = [
  {
    title: "Add your API keys",
    description: "You need AssemblyAI and Google AI keys to process conversations.",
    ctaLabel: "Go to Settings",
    ctaHref: "/settings",
  },
  {
    title: "Upload your first conversation",
    description: "Record or import audio from your last event.",
    ctaLabel: "Upload now",
    ctaHref: "/upload",
  },
  {
    title: "Complete your chapter profile",
    description: "Add a tagline and description so members can find you.",
    ctaLabel: "Edit profile",
    ctaHref: "/chapters",
  },
  {
    title: "Add your team",
    description: "Add co-founders and team members to your chapter page.",
    ctaLabel: "Manage team",
    ctaHref: "/team",
  },
  {
    title: "Read the Hosting Guide",
    description: "Learn how to plan, run, and follow up on an Ai Salon event.",
    ctaLabel: "Open guide",
    ctaHref: undefined,
  },
  {
    title: "Read the Chapter Lead Guide",
    description: "Learn how to build and grow your local Ai Salon chapter.",
    ctaLabel: "Open guide",
    ctaHref: undefined,
  },
  {
    title: "Set up your 1:1 scheduling link",
    description: "Add a booking link (cal.com, Calendly, or Google Calendar) so hosts can schedule time with you.",
    ctaLabel: "Go to Settings",
    ctaHref: "/settings",
  },
];

function GuideReadItem({ label, defaultRead, onOpen, onMarkRead }: { label: string; defaultRead?: boolean; onOpen: () => void; onMarkRead: () => void }) {
  const [read, setRead] = useState(defaultRead ?? false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid #f0ebe0" }}>
      <input
        type="checkbox"
        checked={read}
        onChange={() => { if (!read) { setRead(true); onMarkRead(); } }}
        style={{ accentColor: "#d2b356", cursor: "pointer", flexShrink: 0 }}
      />
      <span style={{ flex: 1, fontSize: 13, color: read ? "#aaa" : "#222", textDecoration: read ? "line-through" : "none", lineHeight: 1.5 }}>
        {label}
      </span>
      {!read && (
        <button
          onClick={() => { setRead(true); onMarkRead(); onOpen(); }}
          style={{ fontSize: 12, fontWeight: 700, color: "#56a1d2", background: "none", border: "none", cursor: "pointer", padding: "2px 8px", flexShrink: 0 }}
        >
          Open →
        </button>
      )}
    </div>
  );
}

export default function WelcomeDashboard({
  userName,
  userEmail,
  userRole,
  userChapter,
  allChapters,
  completedSteps,
  hasReadHostingGuide,
  hasReadLeadGuide,
  chapterLeads = [],
}: {
  userName: string;
  userEmail: string;
  userRole: string;
  userChapter?: { id: string; code: string; name: string };
  allChapters: { id: string; code: string; name: string }[];
  completedSteps?: boolean[];
  hasReadHostingGuide?: boolean;
  hasReadLeadGuide?: boolean;
  chapterLeads?: { id: string; name: string; scheduling_url: string | null }[];
}) {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken ?? "";

  async function markGuideRead(guide: "hosting" | "lead") {
    if (!token) return;
    await fetch(`${API_URL}/admin/me/guide-read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ guide }),
    });
  }

  const isHost = userRole === "host";
  const isChapterLead = userRole === "chapter_lead";
  const isSuperadmin = userRole === "superadmin";

  // Tab state per role
  const [hostTab, setHostTab] = useState<"getting-started" | "event-creator" | "hosting-guide">("getting-started");
  const [leadTab, setLeadTab] = useState<"getting-started" | "event-creator" | "hosting-guide" | "chapter-lead-guide" | "guide">("getting-started");

  return (
    <div style={{ maxWidth: 1140, margin: "0 auto", padding: "32px 28px" }}>
      {/* ── Page header ── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: "0 0 4px" }}>
          {userName || userEmail}
        </h1>
        <p style={{ fontSize: 13, color: "#696969", margin: 0 }}>
          {isChapterLead ? "Chapter Lead" : isHost ? "Host" : "Super Admin"}
          {userChapter && ` · ${userChapter.name}`}
        </p>
      </div>

      {/* ── Two-column layout ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 288px",
          gap: 22,
          alignItems: "start",
        }}
      >
        {/* ── Main column ── */}
        <div>
          {/* HOST view */}
          {isHost && (
            <>
              <TabBar
                tabs={[
                  { id: "getting-started" as const, label: "🚀 Getting Started" },
                  { id: "event-creator" as const, label: "🗓️ Event Creator" },
                  { id: "hosting-guide" as const, label: "🏡 Hosting Guide" },
                ]}
                active={hostTab}
                onChange={setHostTab}
              />
              {hostTab === "getting-started" && (
                <div>
                  {completedSteps && !completedSteps.every(Boolean) && (
                    <div style={{ marginBottom: 20 }}>
                      <OnboardingBanner steps={HOST_STEPS} completedSteps={completedSteps} />
                    </div>
                  )}
                  <div style={{ background: "#fff", border: "1px solid #ede9d8", borderRadius: 10, padding: "18px 20px", marginTop: completedSteps ? 0 : 0 }}>
                    <SectionLabel>Guide Checklist</SectionLabel>
                    <GuideReadItem
                      label="Read through the Hosting Guide"
                      defaultRead={hasReadHostingGuide}
                      onOpen={() => setHostTab("hosting-guide")}
                      onMarkRead={() => markGuideRead("hosting")}
                    />
                  </div>
                </div>
              )}
              {hostTab === "event-creator" && (
                <EventCreator chapterName={userChapter?.name} chapterCode={userChapter?.code} />
              )}
              {hostTab === "hosting-guide" && (
                <div>
                  <div style={{ marginBottom: 18 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111", margin: "0 0 4px" }}>🏡 Hosting Guide</h2>
                    <p style={{ fontSize: 13, color: "#696969", margin: 0 }}>
                      Everything you need to plan, run, and follow up on an Ai Salon.
                    </p>
                  </div>
                  <HostingGuide />
                </div>
              )}
            </>
          )}

          {/* CHAPTER LEAD view */}
          {isChapterLead && userChapter && (
            <>
              <TabBar
                tabs={[
                  { id: "getting-started" as const, label: "🚀 Getting Started" },
                  { id: "event-creator" as const, label: "🗓️ Event Creator" },
                  { id: "hosting-guide" as const, label: "🏡 Hosting Guide" },
                  { id: "chapter-lead-guide" as const, label: "🗺️ Chapter Lead Guide" },
                  { id: "guide" as const, label: "📖 Chapter Guide" },
                ]}
                active={leadTab}
                onChange={setLeadTab}
              />
              {leadTab === "getting-started" && (
                <div>
                  {completedSteps && !completedSteps.every(Boolean) && (
                    <div style={{ marginBottom: 20 }}>
                      <OnboardingBanner steps={CHAPTER_LEAD_STEPS} completedSteps={completedSteps} />
                    </div>
                  )}
                  <div style={{ background: "#fff", border: "1px solid #ede9d8", borderRadius: 10, padding: "18px 20px" }}>
                    <SectionLabel>Guide Checklist</SectionLabel>
                    <GuideReadItem
                      label="Read through the Hosting Guide"
                      defaultRead={hasReadHostingGuide}
                      onOpen={() => setLeadTab("hosting-guide")}
                      onMarkRead={() => markGuideRead("hosting")}
                    />
                    <GuideReadItem
                      label="Read through the Chapter Lead Guide"
                      defaultRead={hasReadLeadGuide}
                      onOpen={() => setLeadTab("chapter-lead-guide")}
                      onMarkRead={() => markGuideRead("lead")}
                    />
                  </div>
                </div>
              )}
              {leadTab === "event-creator" && (
                <EventCreator chapterName={userChapter.name} chapterCode={userChapter.code} />
              )}
              {leadTab === "hosting-guide" && (
                <div>
                  <div style={{ marginBottom: 18 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111", margin: "0 0 4px" }}>🏡 Hosting Guide</h2>
                    <p style={{ fontSize: 13, color: "#696969", margin: 0 }}>
                      Everything you need to plan, run, and follow up on an Ai Salon.
                    </p>
                  </div>
                  <HostingGuide />
                </div>
              )}
              {leadTab === "chapter-lead-guide" && (
                <div>
                  <div style={{ marginBottom: 18 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111", margin: "0 0 4px" }}>🗺️ Chapter Lead Guide</h2>
                    <p style={{ fontSize: 13, color: "#696969", margin: 0 }}>
                      Building and growing your local Ai Salon chapter.
                    </p>
                  </div>
                  <ChapterLeadGuide />
                </div>
              )}
              {leadTab === "guide" && (
                <ChapterGuideTab
                  chapterId={userChapter.id}
                  chapterName={userChapter.name}
                  canEdit
                />
              )}

              {/* Stats + Activity below tabs */}
              <CommunityStats token={token} />
              <RecentActivity token={token} chapterCode={userChapter.code} />
            </>
          )}

          {/* SUPERADMIN view */}
          {isSuperadmin && (
            <>
              <TabBar
                tabs={[
                  { id: "getting-started" as const, label: "🚀 Getting Started" },
                  { id: "event-creator" as const, label: "🗓️ Event Creator" },
                  { id: "hosting-guide" as const, label: "🏡 Hosting Guide" },
                  { id: "chapter-lead-guide" as const, label: "🗺️ Chapter Lead Guide" },
                  { id: "guide" as const, label: "📖 Chapter Guide" },
                ]}
                active={leadTab}
                onChange={setLeadTab}
              />
              {leadTab === "getting-started" && (
                <div>
                  <div style={{ background: "#fff", border: "1px solid #ede9d8", borderRadius: 10, padding: "18px 20px" }}>
                    <SectionLabel>Guide Checklist</SectionLabel>
                    <GuideReadItem
                      label="Read through the Hosting Guide"
                      defaultRead={hasReadHostingGuide}
                      onOpen={() => setLeadTab("hosting-guide")}
                      onMarkRead={() => markGuideRead("hosting")}
                    />
                    <GuideReadItem
                      label="Read through the Chapter Lead Guide"
                      defaultRead={hasReadLeadGuide}
                      onOpen={() => setLeadTab("chapter-lead-guide")}
                      onMarkRead={() => markGuideRead("lead")}
                    />
                  </div>
                </div>
              )}
              {leadTab === "event-creator" && <EventCreator />}
              {leadTab === "hosting-guide" && (
                <div>
                  <div style={{ marginBottom: 18 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111", margin: "0 0 4px" }}>🏡 Hosting Guide</h2>
                    <p style={{ fontSize: 13, color: "#696969", margin: 0 }}>
                      Everything you need to plan, run, and follow up on an Ai Salon.
                    </p>
                  </div>
                  <HostingGuide />
                </div>
              )}
              {leadTab === "chapter-lead-guide" && (
                <div>
                  <div style={{ marginBottom: 18 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111", margin: "0 0 4px" }}>🗺️ Chapter Lead Guide</h2>
                    <p style={{ fontSize: 13, color: "#696969", margin: 0 }}>
                      Building and growing your local Ai Salon chapter.
                    </p>
                  </div>
                  <ChapterLeadGuide />
                </div>
              )}
              {leadTab === "guide" && (
                <SuperadminChapterGuide allChapters={allChapters} />
              )}

              {/* Stats below tabs */}
              <CommunityStats token={token} />
            </>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div style={{ position: "sticky", top: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Upload CTA */}
          <a
            href="/upload"
            style={{
              display: "block",
              background: "#fff",
              borderRadius: 12,
              border: "2px solid #56a1d2",
              padding: "18px 16px",
              textDecoration: "none",
              transition: "box-shadow 0.15s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 4px 16px rgba(86,161,210,0.18)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.boxShadow = "none")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 20 }}>🎤</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#111" }}>Upload Your Last Conversation</span>
            </div>
            <p style={{ fontSize: 12, color: "#696969", margin: "0 0 12px", lineHeight: 1.5 }}>
              Turn your recording into a published article automatically.
            </p>
            <span
              style={{
                display: "inline-block",
                fontSize: 12,
                fontWeight: 700,
                color: "#fff",
                background: "#56a1d2",
                padding: "6px 14px",
                borderRadius: 6,
              }}
            >
              Upload Now →
            </span>
          </a>

          {/* Invite — for chapter leads and superadmins */}
          {(isChapterLead || isSuperadmin) && <InviteCard />}

          {/* Quick Links */}
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #ede9d8",
              padding: "18px 14px 12px",
            }}
          >
            <SectionLabel>Quick Links</SectionLabel>
            <QuickLink href="https://aisalon.substack.com" emoji="📰" label="Substack Archive" />
            <QuickLink href="https://lu.ma/Ai-salon" emoji="🗓️" label="Luma Calendar" />
            <QuickLink href="/host" emoji="📝" label="Hosting Interest Form" />
            <QuickLink href="https://photos.app.goo.gl/27GC3nktVkvDL11x8" emoji="📷" label="Photo Album" />
          </div>

          {/* Our Values */}
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #ede9d8",
              padding: "18px 14px 12px",
            }}
          >
            <SectionLabel>Our Values</SectionLabel>
            <ValueRow emoji="🧘" title="Give Space and Take Space" desc="Foster respect through active listening and thoughtful contribution." />
            <ValueRow emoji="🔭" title="Seek the Truth" desc="Engage with curiosity and rigor; ground points in facts." />
            <ValueRow emoji="🚀" title="Encourage Exploration" desc="Welcome all angles via free-flowing dialogue." />
            <ValueRow emoji="🤝" title="Find Strength in Community" desc="Come together to support one another and have fun." />
            <ValueRow emoji="🫴" title="Promote Positive Impact" desc="Convert ideas into positive projects and partnerships." />
          </div>

          {/* Connect */}
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #ede9d8",
              padding: "18px 14px 12px",
            }}
          >
            <SectionLabel>Connect</SectionLabel>
            {chapterLeads.filter((l) => l.scheduling_url).map((l) => (
              <QuickLink key={l.id} href={l.scheduling_url!} emoji="📅" label={`1:1 with ${l.name}`} />
            ))}
            {chapterLeads.filter((l) => l.scheduling_url).length === 0 && (
              <QuickLink href="https://cal.com/ianeisenberg/ai-salon-coordination" emoji="📅" label="1:1 with Ian" />
            )}
            <QuickLink href="https://www.linkedin.com/company/92632727/" emoji="💼" label="LinkedIn" />
            <QuickLink href="https://x.com/TheAISalonSF" emoji="𝕏" label="X / Twitter" />
          </div>
        </div>
      </div>
    </div>
  );
}
