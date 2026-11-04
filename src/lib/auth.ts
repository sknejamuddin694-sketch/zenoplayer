export type Session = {
  mode: "guest" | "account";
  name: string;
  email?: string | undefined;
};

type Account = Session & { passwordHash: string };

const SESSION_KEY = "moviebox-session";
const ACCOUNTS_KEY = "moviebox-accounts";
const guest: Session = { mode: "guest", name: "Guest" };

function readAccounts(): Account[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]") as Account[]; } catch { return []; }
}

async function hashPassword(password: string) {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const bytes = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  return btoa(password);
}

export function readSession(): Session {
  if (typeof window === "undefined") return guest;
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY) || "null") as Session | null;
    return value?.mode === "account" && value.email ? value : guest;
  } catch { return guest; }
}

export function useGuest() {
  if (typeof window !== "undefined") localStorage.setItem(SESSION_KEY, JSON.stringify(guest));
  return guest;
}

export async function registerAccount(name: string, email: string, password: string): Promise<Session> {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  if (cleanName.length < 2) throw new Error("Name must be at least 2 characters.");
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) throw new Error("Enter a valid email address.");
  if (password.length < 6) throw new Error("Password must be at least 6 characters.");
  if (readAccounts().some((x) => x.email === cleanEmail)) throw new Error("This email is already registered on this device.");
  const account: Account = { mode: "account", name: cleanName, email: cleanEmail, passwordHash: await hashPassword(password) };
  if (typeof window !== "undefined") {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...readAccounts(), account]));
    localStorage.setItem(SESSION_KEY, JSON.stringify({ mode: account.mode, name: account.name, email: account.email }));
  }
  return { mode: account.mode, name: account.name, email: account.email };
}

export async function loginAccount(email: string, password: string): Promise<Session> {
  const cleanEmail = email.trim().toLowerCase();
  const account = readAccounts().find((x) => x.email === cleanEmail);
  if (!account || account.passwordHash !== await hashPassword(password)) throw new Error("Email or password is incorrect.");
  const session: Session = { mode: "account", name: account.name, email: account.email };
  if (typeof window !== "undefined") localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}
