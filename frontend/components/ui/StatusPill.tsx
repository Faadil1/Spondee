import { CheckCircle2, CircleAlert, CircleSlash, RadioTower } from "lucide-react";

type Tone = "good" | "warn" | "bad" | "neutral";

type StatusPillProps = {
  children: React.ReactNode;
  tone?: Tone;
};

const iconByTone = {
  good: CheckCircle2,
  warn: CircleAlert,
  bad: CircleSlash,
  neutral: RadioTower,
};

export function StatusPill({ children, tone = "neutral" }: StatusPillProps) {
  const Icon = iconByTone[tone];

  return (
    <span className={`status-pill status-pill-${tone}`}>
      <Icon aria-hidden="true" size={14} />
      {children}
    </span>
  );
}
