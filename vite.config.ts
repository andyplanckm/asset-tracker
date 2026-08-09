import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function validateSupabaseEnvironment(mode: string): void {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim()
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY?.trim()

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('构建失败：请配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY')
  }

  try {
    const url = new URL(supabaseUrl)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('invalid protocol')
  } catch {
    throw new Error('构建失败：VITE_SUPABASE_URL 必须是有效的 HTTP(S) 地址')
  }
}

export default defineConfig(({ command, mode }) => {
  if (command === 'build') validateSupabaseEnvironment(mode)

  return {
    plugins: [react(), tailwindcss()],
  }
})
