export default function LoadingScreen({ message = '加载中' }: { message?: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-4 text-center">
        <span
          className="h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600"
          aria-hidden="true"
        />
        <p className="text-sm font-medium text-slate-500">{message}...</p>
      </div>
    </main>
  )
}
