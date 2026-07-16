export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <section className="state-card" aria-live="polite" aria-busy="true">
      <div style={{ width: "min(100%, 420px)" }}>
        <div className="skeleton" style={{ height: 24, width: "48%" }} />
        <div className="skeleton" style={{ height: 14, marginTop: 14 }} />
        <div className="skeleton" style={{ height: 14, marginTop: 9, width: "78%" }} />
        <span className="sr-only">{label}</span>
      </div>
    </section>
  );
}
