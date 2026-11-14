import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { loginAccount, readSession, registerAccount, setGuestSession } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Connect your tracker — ZenoPlayer" }] }),
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const session = readSession();
    if (session.mode === "account") {
      setName(session.name);
      setEmail(session.email ?? "");
    }
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      if (mode === "register") await registerAccount(name, email, password);
      else await loginAccount(email, password);
      setMessage(mode === "register" ? "Account created. Your guest data stays on this device." : "Logged in successfully.");
      setTimeout(() => router.navigate({ to: "/me" }), 350);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not complete this request.");
    }
  };

  const guestMode = () => {
    setGuestSession();
    router.navigate({ to: "/me" });
  };

  return (
    <div className="app-page">
      <Header />
      <main className="app-content">
        <Link to="/me" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"><ArrowLeft className="h-4 w-4" />Back to tracker</Link>
        <div className="mx-auto max-w-md">
          <section className="profile-route-hero mb-4 text-center">
            <div className="tracker-avatar mx-auto mb-3"><Sparkles className="h-7 w-7" /></div>
            <p className="page-kicker">KEEP YOUR COLLECTION CLOSE</p>
            <h1 className="font-display text-3xl font-black tracking-tight">{mode === "login" ? "Welcome back" : "Join your tracker"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">Your watch history and list stay connected on this device.</p>
          </section>

          <form onSubmit={submit} className="route-panel space-y-4">
            {mode === "register" && <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Name</span><input value={name} onChange={(event) => setName(event.target.value)} className="field-focus w-full px-3 py-3 outline-none" placeholder="Your name" required /></label>}
            <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="field-focus w-full px-3 py-3 outline-none" placeholder="you@example.com" required /></label>
            <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="field-focus w-full px-3 py-3 outline-none" placeholder="At least 6 characters" minLength={6} required /></label>
            {error && <p className="rounded-xl bg-destructive/15 px-3 py-2 text-sm text-destructive">{error}</p>}
            {message && <p className="rounded-xl bg-primary/15 px-3 py-2 text-sm text-primary">{message}</p>}
            <button type="submit" className="btn-primary w-full py-3">{mode === "login" ? "Log in" : "Create account"}</button>
          </form>

          <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} className="mt-5 w-full text-center text-sm font-bold text-primary">
            {mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}
          </button>
          <button onClick={guestMode} className="btn-ghost mt-3 w-full justify-center py-3">Continue as Guest</button>
          <p className="mt-4 text-center text-xs text-muted-foreground">Guest mode is always available. Account and tracker data are stored locally on this device.</p>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
