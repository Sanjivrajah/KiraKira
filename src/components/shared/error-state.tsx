import { CircleAlert } from "lucide-react";

export function ErrorState({
  title = "Something went wrong",
  description,
}: {
  title?: string;
  description: string;
}) {
  return (
    <section className="state-card" role="alert">
      <div>
        <CircleAlert aria-hidden="true" color="var(--danger)" size={30} />
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </section>
  );
}
