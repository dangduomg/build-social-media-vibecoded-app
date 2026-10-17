import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { AuthForm } from '@/components/social/auth-form'
import { auth } from '@/lib/auth'

export default async function SignUpPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect('/')

  return (
    <main className="auth-shell">
      <Link className="brand-wordmark auth-brand" href="/" aria-label="The Common home">
        <span className="brand-mark" aria-hidden="true">c</span> the common
      </Link>
      <section className="auth-card">
        <p className="eyebrow">A place for everyone</p>
        <h1>Pull up a chair.</h1>
        <p className="auth-intro">Make an account and add your voice to the conversation.</p>
        <AuthForm mode="sign-up" />
        <p className="auth-switch">Already have a seat? <Link href="/sign-in">Sign in</Link></p>
      </section>
      <p className="auth-footer">No follows. No noise. Just a shared space.</p>
    </main>
  )
}
