'use server'

import { put, del } from '@vercel/blob'
import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { comments, likes, posts, shares } from '@/lib/db/schema'

async function requireUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Sign in to join the conversation.')
  return session.user.id
}

async function requirePost(postId: string) {
  if (!postId || postId.length > 100) throw new Error('This post is unavailable.')
  const [post] = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId)).limit(1)
  if (!post) throw new Error('This post is unavailable.')
}

export type ComposerState = { error: string | null; formKey: number }

export async function createPost(
  state: ComposerState,
  formData: FormData,
): Promise<ComposerState> {
  const content = String(formData.get('content') ?? '').trim()
  const fileEntry = formData.get('image')
  const image = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null

  if (content.length > 2000) return { ...state, error: 'Keep your post under 2,000 characters.' }
  if (image && image.size > 5 * 1024 * 1024) {
    return { ...state, error: 'Images need to be smaller than 5 MB.' }
  }
  if (image && !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(image.type)) {
    return { ...state, error: 'Choose a JPG, PNG, WebP, or GIF image.' }
  }
  if (!content && !image) return { ...state, error: 'Add a thought or an image before posting.' }

  const userId = await requireUserId()
  let imageUrl: string | null = null

  try {
    if (image) {
      const extension = image.type.split('/')[1].replace('jpeg', 'jpg')
      const blob = await put(`posts/${userId}/${crypto.randomUUID()}.${extension}`, image, {
        access: 'public',
        addRandomSuffix: true,
        contentType: image.type,
        cacheControlMaxAge: 60 * 60 * 24 * 365,
      })
      imageUrl = blob.url
    }

    await db.insert(posts).values({
      id: crypto.randomUUID(),
      userId,
      content,
      imageUrl,
    })
    revalidatePath('/')
    return { error: null, formKey: state.formKey + 1 }
  } catch (error) {
    if (imageUrl) await del(imageUrl).catch(() => undefined)
    console.error('Unable to publish post:', error)
    return { ...state, error: 'Your post could not be published. Please try again.' }
  }
}

export async function toggleLike(postId: string) {
  const userId = await requireUserId()
  await requirePost(postId)
  const [added] = await db
    .insert(likes)
    .values({ postId, userId })
    .onConflictDoNothing()
    .returning({ postId: likes.postId })

  if (!added) {
    await db.delete(likes).where(and(eq(likes.postId, postId), eq(likes.userId, userId)))
  }
  revalidatePath('/')
}

export async function addComment(postId: string, formData: FormData) {
  const userId = await requireUserId()
  await requirePost(postId)
  const content = String(formData.get('content') ?? '').trim()
  if (content.length < 1 || content.length > 500) return

  await db.insert(comments).values({
    id: crypto.randomUUID(),
    postId,
    userId,
    content,
  })
  revalidatePath('/')
}

export async function recordShare(postId: string) {
  const userId = await requireUserId()
  await requirePost(postId)
  await db.insert(shares).values({ postId, userId }).onConflictDoNothing()
  revalidatePath('/')
}
