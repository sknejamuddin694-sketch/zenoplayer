import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, UserRound } from "lucide-react";
import { loginAccount, readSession, registerAccount, useGuest } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Login — ZenoPlayer" }] }),
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete this request.");
    }
  };

  const guestMode = () => {
    useGuest();
    router.navigate({ to: "/me" });
  };

  return (
    <div className="min-h-screen px-4 pb-10 pt-6">
      <Link to="/me" className="mb-8 inline-flex items-center gap-2 text-muted-foreground"><ArrowLeft className="h-5 w-5" />Back to Me</Link>
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary"><UserRound className="h-8 w-8" /></div>
          <h1 className="font-display text-3xl font-bold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your watch history and list stay connected on this device.</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl bg-card p-5">
          {mode === "register" && <label className="block"><span className="mb-1 block text-sm text-muted-foreground">Name</span><input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border bg-background px-3 py-3" placeholder="Your name" required /></label>}
          <label className="block"><span className="mb-1 block text-sm text-muted-foreground">Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border bg-background px-3 py-3" placeholder="you@example.com" required /></label>
          <label className="block"><span className="mb-1 block text-sm text-muted-foreground">Password</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border bg-background px-3 py-3" placeholder="At least 6 characters" minLength={6} required /></label>
          {error && <p className="rounded-lg bg-destructive/15 px-3 py-2 text-sm text-destructive">{error}</p>}
          {message && <p className="rounded-lg bg-primary/15 px-3 py-2 text-sm text-primary">{message}</p>}
          <button type="submit" className="btn-primary w-full justify-center rounded-lg py-3">{mode === "login" ? "Log in" : "Create account"}</button>
        </form>

        <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} className="mt-5 w-full text-center text-sm text-primary">
          {mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}
        </button>
        <button onClick={guestMode} className="mt-5 w-full rounded-lg border border-border py-3 text-sm text-muted-foreground">Continue as Guest</button>
        <p className="mt-5 text-center text-xs text-muted-foreground">Guest mode is always available. Accounts are stored locally on this device.</p>
      </div>
    </div>
  );
}
