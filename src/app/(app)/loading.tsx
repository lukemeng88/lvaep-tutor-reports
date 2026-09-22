export default function AppLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-56 animate-pulse rounded bg-gray-200" />
      <div className="h-24 animate-pulse rounded-lg bg-gray-200" />
      <div className="h-40 animate-pulse rounded-lg bg-gray-200" />
    </div>
  );
}
