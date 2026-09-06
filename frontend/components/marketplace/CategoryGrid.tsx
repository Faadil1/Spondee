import type { BootstrapResponse } from "@/lib/api/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { CategoryCard } from "./CategoryCard";

type CategoryGridProps = {
  bootstrap: BootstrapResponse;
};

export function CategoryGrid({ bootstrap }: CategoryGridProps) {
  return (
    <section className="content-section" id="marketplace">
      <SectionHeader
        eyebrow="Marketplace"
        title="Four task paths, one promise-first model"
        copy="Each category starts with a bounded task, then produces the same proof chain: Promise Card, activation state, receipt, replay and evidence when the runtime store has it."
      />

      {bootstrap.categories.length > 0 ? (
        <div className="category-grid">
          {bootstrap.categories.map((entry) => (
            <CategoryCard
              key={entry.presentation.slug}
              entry={entry}
              featured={entry.category === bootstrap.product.hero_category}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">The backend returned no categories.</div>
      )}
    </section>
  );
}
