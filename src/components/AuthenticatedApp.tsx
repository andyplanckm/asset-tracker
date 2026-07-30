import Layout from './Layout'
import Home from '../pages/Home'
import { PrivacyProvider } from '../contexts/PrivacyContext'
import { ToastProvider } from './ui/Toast'

export default function AuthenticatedApp({ userId }: { userId: string }) {
  return (
    <ToastProvider>
      <PrivacyProvider>
        <Layout>
          <Home key={userId} userId={userId} />
        </Layout>
      </PrivacyProvider>
    </ToastProvider>
  )
}
