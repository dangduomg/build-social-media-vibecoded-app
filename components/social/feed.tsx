'use client'

import { useActionState, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { addComment, createPost, recordShare, toggleLike } from '@/app/actions/posts'
import type { ComposerState } from '@/app/actions/posts'
import { authClient } from '@/lib/auth-client'
import type { FeedPost, FeedUser, SocialComment } from '@/lib/social-types'
import {
  ArrowUpRight,
  Camera,
  Check,
  Heart,
  ImagePlus,
  LogOut,
  MessageCircle,
  Send,
  Sparkles,
  X,
} from 'lucide-react'

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
}

function Avatar({ name, image, size = 'normal' }: { name: string; image: string | null; size?: 'normal' | 'small' }) {
  return (
    <span className={`avatar avatar-${size}`} aria-hidden="true">
      {image ? <img src={image} alt="" /> : initials(name)}
    </span>
  )
}

function timeAgo(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value))
}

function Composer({ user }: { user: FeedUser }) {
  const [state, action, pending] = useActionState<ComposerState, FormData>(createPost, { error: null, formKey: 0 })
  const [preview, setPreview] = useState<string | null>(null)

  function selectImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current)
      return file ? URL.createObjectURL(file) : null
    })
  }

  return (
    <form className="composer-card" action={action} key={state.formKey}>
      <div className="composer-main">
        <Avatar name={user.name} image={user.image} />
        <div className="composer-input-wrap">
          <label className="sr-only" htmlFor="post-content">Write a post</label>
          <textarea
            id="post-content"
            name="content"
            maxLength={2000}
            placeholder="What&apos;s on your mind?"
            rows={3}
          />
          {preview && (
            <div className="composer-preview">
              <img src={preview} alt="Selected image preview" />
              <button
                className="remove-image"
                type="button"
                onClick={() => {
                  setPreview(null)
                  const input = document.getElementById('post-image') as HTMLInputElement | null
                  if (input) input.value = ''
                }}
                aria-label="Remove selected image"
              >
                <X aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <div className="composer-footer">
        <label className="attach-button" htmlFor="post-image">
          <ImagePlus aria-hidden="true" />
          <span>Photo</span>
        </label>
        <input
          id="post-image"
          className="sr-only"
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={selectImage}
        />
        <span className="composer-hint">A thought, a moment, anything.</span>
        <button className="button-primary button-post" type="submit" disabled={pending}>
          {pending ? 'Posting…' : 'Post'}
          <ArrowUpRight aria-hidden="true" />
        </button>
      </div>
    </form>
  )
}

function CommentRow({ comment }: { comment: SocialComment }) {
  return (
    <div className="comment-row">
      <Avatar name={comment.authorName} image={comment.authorImage} size="small" />
      <div className="comment-bubble">
        <p><strong>{comment.authorName}</strong><span>{timeAgo(comment.createdAt)}</span></p>
        <div>{comment.content}</div>
      </div>
    </div>
  )
}

function ShareButton({ postId }: { postId: string }) {
  const [pending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)

  function share() {
    startTransition(async () => {
      const url = `${window.location.origin}/#post-${postId}`
      try {
        if (navigator.share) {
          await navigator.share({ title: 'A post on The Common', url })
        } else {
          await navigator.clipboard.writeText(url)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1800)
        }
        await recordShare(postId)
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1800)
            await recordShare(postId)
          } catch {
            setCopied(false)
          }
        }
      }
    })
  }

  return (
    <button className="post-action" type="button" onClick={share} disabled={pending} aria-label="Share post">
      {copied ? <Check aria-hidden="true" /> : <Send aria-hidden="true" />}
      <span>{copied ? 'Copied' : 'Share'}</span>
    </button>
  )
}

function PostCard({ post, currentUser }: { post: FeedPost; currentUser: FeedUser | null }) {
  return (
    <article className="post-card" id={`post-${post.id}`}>
      <div className="post-head">
        <Avatar name={post.authorName} image={post.authorImage} />
        <div className="post-byline">
          <strong>{post.authorName}</strong>
          <time dateTime={post.createdAt}>{timeAgo(post.createdAt)}</time>
        </div>
        <span className="post-dot" aria-hidden="true">·</span>
        <span className="post-community-label">in the open</span>
      </div>

      {post.content && <p className="post-copy">{post.content}</p>}
      {post.imageUrl && (
        <img className="post-image" src={post.imageUrl} alt={`Image shared by ${post.authorName}`} loading="lazy" />
      )}

      <div className="post-stats" aria-label="Post engagement">
        <span>{post.likeCount > 0 ? `${post.likeCount} ${post.likeCount === 1 ? 'heart' : 'hearts'}` : 'Be the first to heart this'}</span>
        <span>{post.commentCount} {post.commentCount === 1 ? 'reply' : 'replies'}</span>
        <span>{post.shareCount} {post.shareCount === 1 ? 'share' : 'shares'}</span>
      </div>
      <div className="post-actions">
        {currentUser ? (
          <form action={toggleLike.bind(null, post.id)}>
            <button className={`post-action ${post.likedByMe ? 'post-action-liked' : ''}`} type="submit" aria-pressed={post.likedByMe}>
              <Heart aria-hidden="true" fill={post.likedByMe ? 'currentColor' : 'none'} />
              <span>{post.likedByMe ? 'Hearted' : 'Heart'}</span>
            </button>
          </form>
        ) : (
          <Link className="post-action" href="/sign-in"><Heart aria-hidden="true" /><span>Heart</span></Link>
        )}
        <a className="post-action" href={`#comments-${post.id}`}>
          <MessageCircle aria-hidden="true" /><span>Comment</span>
        </a>
        {currentUser ? (
          <ShareButton postId={post.id} />
        ) : (
          <Link className="post-action" href="/sign-in"><Send aria-hidden="true" /><span>Share</span></Link>
        )}
      </div>
      <div className="comments-area" id={`comments-${post.id}`}>
        {post.comments.map((comment) => <CommentRow key={comment.id} comment={comment} />)}
        {currentUser ? (
          <form className="comment-form" action={addComment.bind(null, post.id)}>
            <Avatar name={currentUser.name} image={currentUser.image} size="small" />
            <label className="sr-only" htmlFor={`comment-${post.id}`}>Write a comment</label>
            <input id={`comment-${post.id}`} name="content" maxLength={500} placeholder="Leave a kind thought…" required />
            <button type="submit" aria-label="Send comment"><ArrowUpRight aria-hidden="true" /></button>
          </form>
        ) : (
          <p className="comment-signin"><Link href="/sign-in">Sign in</Link> to join the conversation.</p>
        )}
      </div>
    </article>
  )
}

function TopBar({ currentUser }: { currentUser: FeedUser | null }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <header className="site-topbar">
      <Link className="brand-wordmark" href="/" aria-label="The Common home">
        <span className="brand-mark" aria-hidden="true">c</span> the common
      </Link>
      <div className="topbar-right">
        <span className="topbar-tag"><span className="live-dot" /> Open to everyone</span>
        {currentUser ? (
          <div className="topbar-user">
            <Avatar name={currentUser.name} image={currentUser.image} size="small" />
            <span className="topbar-name">{currentUser.name}</span>
            <button
              className="icon-button"
              type="button"
              disabled={pending}
              aria-label="Sign out"
              onClick={() => startTransition(async () => {
                await authClient.signOut()
                router.refresh()
              })}
            ><LogOut aria-hidden="true" /></button>
          </div>
        ) : (
          <div className="topbar-auth">
            <Link className="topbar-signin" href="/sign-in">Sign in</Link>
            <Link className="button-primary button-small" href="/sign-up">Join the conversation</Link>
          </div>
        )}
      </div>
    </header>
  )
}

export function Feed({ posts, currentUser }: { posts: FeedPost[]; currentUser: FeedUser | null }) {
  return (
    <main className="site-shell">
      <TopBar currentUser={currentUser} />
      <div className="site-layout">
        <aside className="left-rail">
          <p className="rail-label">YOUR SPACE</p>
          <nav className="rail-nav" aria-label="Main navigation">
            <a className="rail-link rail-link-active" href="#feed"><Sparkles aria-hidden="true" /><span>The open feed</span></a>
            <a className="rail-link" href="#about"><MessageCircle aria-hidden="true" /><span>How this works</span></a>
          </nav>
          <div className="rail-note" id="about">
            <span className="rail-note-icon"><Heart aria-hidden="true" /></span>
            <p className="rail-note-title">A little more human.</p>
            <p>One shared feed. No follows to keep up with. Just people, being people.</p>
          </div>
          <p className="rail-footnote">Made for the in-between moments.</p>
        </aside>

        <section className="feed-column" id="feed" aria-labelledby="feed-title">
          <div className="feed-heading">
            <div>
              <p className="eyebrow"><span className="eyebrow-dash" /> A SHARED SPACE</p>
              <h1 id="feed-title">The open feed<span className="heading-period">.</span></h1>
              <p className="feed-intro">Little updates from all kinds of people. Yours belong here, too.</p>
            </div>
            <div className="feed-mode"><span className="live-dot" /> Latest</div>
          </div>

          {currentUser ? (
            <Composer user={currentUser} />
          ) : (
            <section className="guest-composer" aria-label="Join the conversation">
              <div className="guest-icon"><Camera aria-hidden="true" /></div>
              <div className="guest-copy"><strong>Have something to share?</strong><span>Every good conversation starts somewhere.</span></div>
              <Link className="guest-join" href="/sign-up">Join in <ArrowUpRight aria-hidden="true" /></Link>
            </section>
          )}

          <div className="feed-list">
            {posts.length > 0 ? posts.map((post) => <PostCard key={post.id} post={post} currentUser={currentUser} />) : (
              <section className="empty-feed">
                <div className="empty-art" aria-hidden="true"><span className="empty-art-circle" /><MessageCircle /></div>
                <p className="eyebrow">A FRESH PAGE</p>
                <h2>It&apos;s quiet in here.<br /><em>For now.</em></h2>
                <p className="empty-copy">This is the beginning of an open conversation. Leave the first little note, photo, or thought.</p>
                {!currentUser && <Link className="button-primary" href="/sign-up">Be the first to post <ArrowUpRight aria-hidden="true" /></Link>}
              </section>
            )}
          </div>
        </section>

        <aside className="right-rail" aria-label="Community notes">
          <div className="right-note-card">
            <p className="eyebrow">A NOTE FROM US</p>
            <h2>Good things<br />travel <em>better</em><br />together.</h2>
            <p>See something you like? Leave a heart, add a thought, or pass it along.</p>
            <span className="right-note-decoration" aria-hidden="true">✳</span>
          </div>
          <div className="community-guidelines">
            <span className="guideline-kicker"><Sparkles aria-hidden="true" /> THE COMMON WAY</span>
            <p>Make room for someone else&apos;s point of view. That&apos;s how a community feels like one.</p>
          </div>
        </aside>
      </div>
      <footer className="site-footer"><span>the common</span><span>A little space for all of us.</span></footer>
    </main>
  )
}
