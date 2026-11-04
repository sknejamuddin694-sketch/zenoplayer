import { Link } from "@tanstack/react-router";
import { Download, Home, User } from "lucide-react";

export function BottomNav() {
  const cls = "flex flex-col items-center gap-1 text-xs text-muted-foreground";
  const on = { className: "flex flex-col items-center gap-1 text-xs text-foreground [&_svg]:text-primary [&_svg]:fill-primary/30" };
  return (
    <nav className="bottom-nav">
      <Link to="/" className={cls} activeProps={on} activeOptions={{ exact: true }}><Home className="h-6 w-6" />Home</Link>
      <Link to="/downloads" className={cls} activeProps={on}><Download className="h-6 w-6" />Downloads</Link>
      <Link to="/me" className={cls} activeProps={on}><User className="h-6 w-6" />Me</Link>
    </nav>
  );
}
