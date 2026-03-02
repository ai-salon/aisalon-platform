"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

  // Superadmins need the chapter list
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

// ─── Main export ──────────────────────────────────────────────────────────────

export default function WelcomeDashboard({
  userName,
  userEmail,
  userRole,
  userChapter,
}: {
  userName: string;
  userEmail: string;
  userRole: string;
  userChapter?: { code: string; name: string };
}) {
  const [activeTab, setActiveTab] = useState<"hosting" | "chapter">("hosting");
  const showBothGuides = userRole === "chapter_lead" || userRole === "superadmin";
  // host role only sees the hosting guide (showBothGuides = false for hosts)

  return (
    <div style={{ maxWidth: 1140, margin: "0 auto", padding: "32px 28px" }}>
      {/* ── Hero header ── */}
      <div
        style={{
          background: "linear-gradient(135deg, #56a1d2 0%, #3d7fb8 100%)",
          borderRadius: 14,
          padding: "26px 32px",
          marginBottom: 28,
          color: "#fff",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* decorative circles */}
        <div
          style={{
            position: "absolute",
            top: -30,
            right: 40,
            width: 160,
            height: 160,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.07)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -40,
            right: -20,
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.05)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative" }}>
          <p style={{ fontSize: 12, opacity: 0.75, marginBottom: 4, letterSpacing: 0.5, margin: "0 0 4px" }}>
            Welcome back
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em" }}>
            {userName || userEmail}
          </h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 11px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.2)",
                textTransform: "capitalize",
                letterSpacing: 0.5,
              }}
            >
              {userRole === "chapter_lead" ? "Chapter Lead" : userRole === "host" ? "Host" : "Super Admin"}
            </span>
            {userChapter && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 11px",
                  borderRadius: 12,
                  background: "rgba(210, 179, 86, 0.3)",
                  color: "#fde68a",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                {userChapter.name}
              </span>
            )}
            <span style={{ fontSize: 12, opacity: 0.65 }}>{userEmail}</span>
          </div>
        </div>
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
        {/* Main column */}
        <div>
          {/* Tab switcher */}
          {showBothGuides && (
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
              {(
                [
                  { id: "hosting", label: "🏡 Hosting Guide" },
                  { id: "chapter", label: "🗺️ Chapter Lead Guide" },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 7,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 700,
                    background: activeTab === id ? "#fff" : "transparent",
                    color: activeTab === id ? "#111" : "#696969",
                    boxShadow: activeTab === id ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.15s",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Hosting Guide */}
          {(!showBothGuides || activeTab === "hosting") && (
            <div>
              <div style={{ marginBottom: 18 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111", margin: "0 0 4px" }}>
                  🏡 Hosting Guide
                </h2>
                <p style={{ fontSize: 13, color: "#696969", margin: 0 }}>
                  Everything you need to plan, run, and follow up on an Ai Salon.
                </p>
              </div>
              <HostingGuide />
            </div>
          )}

          {/* Chapter Lead Guide */}
          {showBothGuides && activeTab === "chapter" && (
            <div>
              <div style={{ marginBottom: 18 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111", margin: "0 0 4px" }}>
                  🗺️ Chapter Lead Guide
                </h2>
                <p style={{ fontSize: 13, color: "#696969", margin: 0 }}>
                  How to build a thriving local chapter and connect with the global Ai Salon community.
                </p>
              </div>
              <ChapterLeadGuide />
            </div>
          )}
        </div>

        {/* Sidebar */}
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

          {/* Invite CTA — for chapter leads and superadmins */}
          {(userRole === "chapter_lead" || userRole === "superadmin") && <InviteCard />}

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
            <QuickLink href="https://aisalon.xyz/" emoji="🌐" label="Ai Salon Website" />
            <QuickLink href="https://aisalon.substack.com" emoji="📰" label="Substack Archive" />
            <QuickLink href="https://lu.ma/Ai-salon" emoji="🗓️" label="Luma Calendar" />
            <QuickLink href="/host" emoji="📝" label="Hosting Interest Form" />
            <QuickLink href="/upload" emoji="🎤" label="Submit Recording" />
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
            <ValueRow
              emoji="🧘"
              title="Give Space and Take Space"
              desc="Foster respect through active listening and thoughtful contribution."
            />
            <ValueRow
              emoji="🔭"
              title="Seek the Truth"
              desc="Engage with curiosity and rigor; ground points in facts."
            />
            <ValueRow
              emoji="🚀"
              title="Encourage Exploration"
              desc="Welcome all angles via free-flowing dialogue."
            />
            <ValueRow
              emoji="🤝"
              title="Find Strength in Community"
              desc="Come together to support one another and have fun."
            />
            <ValueRow
              emoji="🫴"
              title="Promote Positive Impact"
              desc="Convert ideas into positive projects and partnerships."
            />
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
            <QuickLink href="https://cal.com/ianeisenberg/ai-salon-coordination" emoji="📅" label="1:1 with Ian" />
            <QuickLink href="https://www.linkedin.com/company/92632727/" emoji="💼" label="LinkedIn" />
            <QuickLink href="https://x.com/TheAISalonSF" emoji="𝕏" label="X / Twitter" />
          </div>
        </div>
      </div>
    </div>
  );
}
