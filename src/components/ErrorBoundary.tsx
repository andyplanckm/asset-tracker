import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  private handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <section
          role="alert"
          className="w-full max-w-md rounded-3xl border border-white/80 bg-white/90 p-7 text-center shadow-xl shadow-slate-300/25 backdrop-blur-xl"
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-xl text-amber-600" aria-hidden="true">
            !
          </div>
          <h1 className="text-lg font-semibold text-slate-900">页面遇到了一点问题</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            你的数据不会受到影响。重新加载页面通常可以恢复。
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-6 cursor-pointer rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700"
          >
            重新加载
          </button>
        </section>
      </main>
    )
  }
}
