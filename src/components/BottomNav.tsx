import { Link } from "@tanstack/react-router";
import { Bookmark, Compass, Home, Search, UsersRound } from "lucide-react";

export function BottomNav() {
  const navClass = "nav-item";
  const activeClass = { className: "nav-item is-active" };

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      <Link to="/" search={{ tab: "trending" }} className={navClass} activeProps={activeClass} activeOptions={{ exact: true }}>
        <Home aria-hidden="true" />Home
      </Link>
      <Link to="/me" className={navClass} activeProps={activeClass}>
        <Bookmark aria-hidden="true" />My List
      </Link>
      <Link to="/section/$name" params={{ name: "Trending Anime" }} className={navClass} activeProps={activeClass}>
        <Compass aria-hidden="true" />For You
      </Link>
      <Link to="/search" search={{ q: "" }} className={navClass} activeProps={activeClass}>
        <Search aria-hidden="true" />Search
      </Link>
      <Link to="/anime-library" className={navClass} activeProps={activeClass}>
        <UsersRound aria-hidden="true" />Community
      </Link>
    </nav>
  );
}
