export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <footer className="footer-public" id="public-footer">
        <div
          style={{
            maxWidth: 1140,
            margin: "0 auto",
            padding: "0 30px",
            display: "flex",
            flexWrap: "wrap",
            gap: 40,
            paddingBottom: 40,
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {/* Brand */}
          <div style={{ flex: "1 1 220px", maxWidth: 280 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/logo-2-300w.png"
              alt="Ai Salon"
              style={{ height: 50, width: "auto", marginBottom: 15, filter: "brightness(0) invert(1)" }}
            />
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "rgba(255,255,255,0.6)" }}>
              Conversations on the meaning and impact of AI
            </p>
          </div>

          {/* Quick Links */}
          <div style={{ flex: "1 1 160px" }}>
            <h4 style={{ color: "#fff", fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 20 }}>
              Quick Links
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {[
                ["Home", "/"],
                ["Events", "https://lu.ma/Ai-salon"],
                ["Insights", "/insights"],
                ["Host a Chapter", "/host"],
                ["Newsletter", "https://aisalon.substack.com"],
                ["Member Sign In", "/login"],
              ].map(([label, href]) => (
                <li key={label} style={{ marginBottom: 12 }}>
                  <a href={href} style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div style={{ flex: "1 1 220px" }}>
            <h4 style={{ color: "#fff", fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 20 }}>
              Stay Connected
            </h4>
            <p style={{ marginBottom: 15, color: "rgba(255,255,255,0.7)", fontSize: 14 }}>
              Join 6,000+ readers exploring AI&apos;s impact
            </p>
            <a
              href="https://aisalon.substack.com/subscribe"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
              style={{ display: "inline-block", fontSize: 13, padding: "10px 20px" }}
            >
              Subscribe to Newsletter
            </a>
          </div>

          {/* Social */}
          <div style={{ flex: "1 1 160px" }}>
            <h4 style={{ color: "#fff", fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 20 }}>
              Follow Us
            </h4>
            <div style={{ display: "flex", gap: 12 }}>
              {[
                { icon: "fa-twitter", href: "https://x.com/TheAISalonSF", title: "Twitter" },
                { icon: "fa-linkedin", href: "https://www.linkedin.com/company/the-ai-salon", title: "LinkedIn" },
                { icon: "fa-newspaper-o", href: "https://aisalon.substack.com", title: "Substack" },
                { icon: "fa-envelope", href: "mailto:contact@aisalon.xyz", title: "Email" },
              ].map(({ icon, href, title }) => (
                <a key={title} href={href} target="_blank" rel="noopener noreferrer" title={title} className="footer-social-link">
                  <i className={`fa ${icon}`} />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div style={{ textAlign: "center", padding: "25px 30px" }}>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
            © 2025 Ai Salon. All rights reserved.
          </p>
        </div>
      </footer>
    </>
  );
}
