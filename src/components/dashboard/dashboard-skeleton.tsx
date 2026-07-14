export function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" aria-busy="true" aria-label="Loading dashboard">
      <div className="skeleton skeleton-title" />
      <div className="skeleton-metrics">{Array.from({ length: 4 }, (_, index) => <div className="skeleton skeleton-card" key={index} />)}</div>
      <div className="skeleton skeleton-chart" />
      <span className="sr-only">Loading dashboard</span>
    </div>
  );
}
