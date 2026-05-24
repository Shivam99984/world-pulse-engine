import { Link } from "@tanstack/react-router";
import { Globe2 } from "lucide-react";
import { Threads } from "@/components/rb/Threads";

export function SiteFooter() {
  return (
    <footer className="relative mt-24 overflow-hidden border-t border-border bg-card/30">
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <Threads className="absolute inset-0 h-full w-full" count={4} />
      </div>
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div>
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-glow">
              <Globe2 className="h-4 w-4" />
            </div>
            <span className="text-base font-semibold tracking-tight">GeoPulse AI</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Real-time global intelligence — AI-powered news, impact mapping, and forecasts.
          </p>
        </div>

        <FooterCol title="Product">
          <FooterLink to="/feed">Live Feed</FooterLink>
          <FooterLink to="/globe">World Map</FooterLink>
          <FooterLink to="/storylines">Storylines</FooterLink>
          <FooterLink to="/social">Social Intel</FooterLink>
          <FooterLink to="/dashboard">Dashboard</FooterLink>
        </FooterCol>

        <FooterCol title="Account">
          <FooterLink to="/signup">Create account</FooterLink>
          <FooterLink to="/login">Sign in</FooterLink>
        </FooterCol>

        <FooterCol title="Legal">
          <span className="text-sm text-muted-foreground">Privacy</span>
          <span className="text-sm text-muted-foreground">Terms</span>
          <span className="text-sm text-muted-foreground">© {new Date().getFullYear()} GeoPulse AI</span>
        </FooterCol>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-foreground">{title}</div>
      <div className="mt-3 flex flex-col gap-2">{children}</div>
    </div>
  );
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      {children}
    </Link>
  );
}
