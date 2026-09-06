import { Activity, Bot, Gauge, LineChart, RefreshCw, Sprout } from "lucide-react";
import Link from "next/link";
import type { CategoryEntry, CategoryName } from "@/lib/api/types";
import { StatusPill } from "@/components/ui/StatusPill";

type CategoryCardProps = {
  entry: CategoryEntry;
  featured?: boolean;
};

const categoryIcons: Record<CategoryName, typeof Activity> = {
  "Health Factor Monitoring": Gauge,
  "Grid Trading": LineChart,
  Rebalancing: RefreshCw,
  "Yield Optimisation": Sprout,
};

export function CategoryCard({ entry, featured = false }: CategoryCardProps) {
  const Icon = categoryIcons[entry.category] ?? Bot;
  const agent = entry.reference_agent;

  return (
    <article className={`category-card ${featured ? "category-card-featured" : ""}`}>
      <div className="category-card-top">
        <span className="category-icon">
          <Icon aria-hidden="true" size={24} />
        </span>
        <StatusPill tone={agent.activatable ? "good" : "warn"}>
          {agent.activatable ? "Activatable path verified" : "Discovery only"}
        </StatusPill>
      </div>

      <div>
        <p className="eyebrow">{entry.presentation.short_label}</p>
        <h3>{entry.category}</h3>
        <p>{entry.presentation.promise_question}</p>
      </div>

      <dl>
        <div>
          <dt>Reference agent</dt>
          <dd>{agent.name}</dd>
        </div>
        <div>
          <dt>Receipt focus</dt>
          <dd>{entry.presentation.receipt_focus}</dd>
        </div>
      </dl>

      <Link className="text-link card-action" href={`/category/${entry.presentation.slug}`}>
        Open category
      </Link>
    </article>
  );
}
