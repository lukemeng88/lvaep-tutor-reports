export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <div className="mb-8 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-primary">LVAEP</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">Tutor Reports</h1>
        <p className="mt-2 text-sm text-gray-600">
          Literacy Volunteers of America, Essex/Passaic County
        </p>
      </div>
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {children}
      </div>
    </div>
  );
}
