import { ArrowRight, CheckSquare, FileCheck, Play, SlidersHorizontal, TimerReset } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";

const steps = [
  { label: "Configure", icon: SlidersHorizontal },
  { label: "Promise", icon: FileCheck },
  { label: "Activate", icon: Play },
  { label: "Receipt", icon: TimerReset },
  { label: "Compare", icon: CheckSquare },
];

export function Mechanism() {
  return (
    <section className="mechanism-section" id="mechanism">
      <SectionHeader
        eyebrow="Mechanism"
        title="Promise first. Authority second. Evidence after."
        copy="Configure the task, freeze the agent's Promise, grant only the bounded activation path, inspect the Outcome Receipt, then compare against the same-window without-agent baseline when observed evidence exists."
      />

      <ol className="mechanism-flow">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <li key={step.label}>
              <span>
                <Icon aria-hidden="true" size={22} />
              </span>
              <strong>{step.label}</strong>
              {index < steps.length - 1 ? <ArrowRight aria-hidden="true" className="flow-arrow" size={18} /> : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
