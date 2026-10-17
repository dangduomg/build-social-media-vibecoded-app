'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, LoaderCircle } from 'lucide-react'
import { authClient } from '@/lib/auth-client'

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const isSignUp = mode === 'sign-up'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setPending(true)
    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') ?? '').trim()
    const password = String(formData.get('password') ?? '')

    try {
      const result = isSignUp
        ? await authClient.signUp.email({
            name: String(formData.get('name') ?? '').trim(),
            email,
            password,
          })
        : await authClient.signIn.email({ email, password })

      if (result.error) {
        setError(isSignUp ? 'We couldn’t create your account. Check your details and try again.' : 'Those details didn’t match. Please try again.')
        return
      }
      router.push('/')
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again in a moment.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {isSignUp && (
        <label className="auth-field">
          <span>Your name</span>
          <input name="name" type="text" autoComplete="name" maxLength={80} placeholder="How people will know you" required />
        </label>
      )}
      <label className="auth-field">
        <span>Email address</span>
        <input name="email" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" required />
      </label>
      <label className="auth-field">
        <span>Password</span>
        <input name="password" type="password" autoComplete={isSignUp ? 'new-password' : 'current-password'} minLength={8} maxLength={128} placeholder="At least 8 characters" required />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button-primary auth-submit" type="submit" disabled={pending}>
        {pending ? <><LoaderCircle className="spin" aria-hidden="true" /> One moment…</> : <>{isSignUp ? 'Create your account' : 'Sign in'} <ArrowUpRight aria-hidden="true" /></>}
      </button>
    </form>
  )
}
