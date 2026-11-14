import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Play } from "lucide-react";
import type { Item } from "@/lib/api";

export function Poster({ item }: { item: Item }) {
  return (
    <Link to="/title/$slug" params={{ slug: item.slug }} className="poster group">
      <div className="poster-frame">
        <img src={item.poster_url} alt={item.name} loading="lazy" />
        {item.badge ? <span className="poster-badge">{item.badge}</span> : null}
        <span className="poster-play" aria-hidden="true"><Play className="h-4 w-4 fill-current" /></span>
      </div>
      <p className="poster-title">{item.name}</p>
    </Link>
  );
}

export function Row({ title, items, section }: { title: string; items: Item[]; section?: string }) {
  if (!items?.length) return null;
  return (
    <section className="poster-row">
      <div className="poster-row-heading">
        <h2>{title}</h2>
        <Link to="/section/$name" params={{ name: section ?? title }} className="section-link">View all <ArrowUpRight className="h-4 w-4" /></Link>
      </div>
      <div className="row-scroll">
        {items.map((item) => (
          <div key={item.slug} className="w-[32%] max-w-44 shrink-0">
            <Poster item={item} />
          </div>
        ))}
      </div>
    </section>
  );
}
