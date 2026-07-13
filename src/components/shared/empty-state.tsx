import { Inbox } from "lucide-react";

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="state-card">
      <div>
        <Inbox aria-hidden="true" color="var(--brand-700)" size={30} />
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </section>
  );
}
