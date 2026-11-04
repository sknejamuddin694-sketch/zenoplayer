import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { Item } from "@/lib/api";

export function Poster({ item }: { item: Item }) {
  return (
    <Link to="/title/$slug" params={{ slug: item.slug }} className="poster group">
      <div className="poster-frame">
        <img src={item.poster_url} alt={item.name} loading="lazy" />
        {item.badge ? <span className="poster-badge">{item.badge}</span> : null}
      </div>
      <p className="line-clamp-2 min-h-[3.25rem] px-2 py-2 text-sm leading-5 text-foreground/85">{item.name}</p>
    </Link>
  );
}

export function Row({ title, items, section }: { title: string; items: Item[]; section?: string }) {
  if (!items?.length) return null;
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between px-4">
        <h2 className="text-lg font-extrabold">{title}</h2>
        <Link to="/section/$name" params={{ name: section ?? title }} className="flex items-center text-sm text-muted-foreground">
          All <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="row-scroll">
        {items.map((m) => (
          <div key={m.slug} className="w-[30%] max-w-44 shrink-0">
            <Poster item={m} />
          </div>
        ))}
      </div>
    </section>
  );
}
