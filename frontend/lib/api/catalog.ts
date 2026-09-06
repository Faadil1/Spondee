import type { AgentRecord, BootstrapResponse, CategoryEntry, CategoryName, SpondeeTask } from "./types";

export function categorySlugFor(category: CategoryName) {
  switch (category) {
    case "Health Factor Monitoring":
      return "health-factor";
    case "Grid Trading":
      return "grid";
    case "Rebalancing":
      return "rebalancing";
    case "Yield Optimisation":
      return "yield";
  }
}

export function categoryForTask(task: SpondeeTask): CategoryName {
  switch (task.schema) {
    case "spondee.health-factor.task.v1":
      return "Health Factor Monitoring";
    case "spondee.grid.task.v1":
      return "Grid Trading";
    case "spondee.rebalancing.task.v1":
      return "Rebalancing";
    case "spondee.yield.task.v1":
      return "Yield Optimisation";
  }
}

export function findCategoryBySlug(bootstrap: BootstrapResponse, slug: string): CategoryEntry | undefined {
  return bootstrap.categories.find((entry) => entry.presentation.slug === slug || categorySlugFor(entry.category) === slug);
}

export function controlledAgentsForCategory(bootstrap: BootstrapResponse, category: CategoryName): AgentRecord[] {
  return bootstrap.agents.filter((agent) => agent.category === category && agent.identity.source === "SPONDEE");
}

export function findAgent(bootstrap: BootstrapResponse, agentId: string): AgentRecord | undefined {
  return bootstrap.agents.find((agent) => agent.agent_id === agentId);
}

export function demoTaskForCategory(bootstrap: BootstrapResponse, category: CategoryName): SpondeeTask | undefined {
  return bootstrap.demo_tasks.find((task) => categoryForTask(task) === category);
}
