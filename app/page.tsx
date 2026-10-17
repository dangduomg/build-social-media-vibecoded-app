import { and, count, desc, eq, inArray } from 'drizzle-orm'
import { headers } from 'next/headers'
import { Feed } from '@/components/social/feed'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { comments, likes, posts, shares, user } from '@/lib/db/schema'
import type { FeedPost, FeedUser, SocialComment } from '@/lib/social-types'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  const currentUser: FeedUser | null = session?.user
    ? { id: session.user.id, name: session.user.name, image: session.user.image ?? null }
    : null

  const rows = await db
    .select({
      id: posts.id,
      authorId: posts.userId,
      authorName: user.name,
      authorImage: user.image,
      content: posts.content,
      imageUrl: posts.imageUrl,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .innerJoin(user, eq(posts.userId, user.id))
    .orderBy(desc(posts.createdAt))
    .limit(40)

  const postIds = rows.map((post) => post.id)
  let feedPosts: FeedPost[] = []

  if (postIds.length > 0) {
    const [likeCounts, commentCounts, shareCounts, myLikes, recentComments] = await Promise.all([
      db.select({ postId: likes.postId, total: count() }).from(likes).where(inArray(likes.postId, postIds)).groupBy(likes.postId),
      db.select({ postId: comments.postId, total: count() }).from(comments).where(inArray(comments.postId, postIds)).groupBy(comments.postId),
      db.select({ postId: shares.postId, total: count() }).from(shares).where(inArray(shares.postId, postIds)).groupBy(shares.postId),
      currentUser
        ? db.select({ postId: likes.postId }).from(likes).where(and(inArray(likes.postId, postIds), eq(likes.userId, currentUser.id)))
        : Promise.resolve([]),
      db
        .select({
          id: comments.id,
          postId: comments.postId,
          authorId: comments.userId,
          authorName: user.name,
          authorImage: user.image,
          content: comments.content,
          createdAt: comments.createdAt,
        })
        .from(comments)
        .innerJoin(user, eq(comments.userId, user.id))
        .where(inArray(comments.postId, postIds))
        .orderBy(desc(comments.createdAt))
        .limit(120),
    ])

    const countByPost = (items: { postId: string; total: number }[]) =>
      new Map(items.map((item) => [item.postId, Number(item.total)]))
    const likedIds = new Set(myLikes.map((like) => like.postId))
    const commentsByPost = new Map<string, SocialComment[]>()

    for (const comment of recentComments) {
      const list = commentsByPost.get(comment.postId) ?? []
      if (list.length < 2) {
        list.push({
          id: comment.id,
          authorId: comment.authorId,
          authorName: comment.authorName,
          authorImage: comment.authorImage,
          content: comment.content,
          createdAt: comment.createdAt.toISOString(),
        })
        commentsByPost.set(comment.postId, list)
      }
    }

    const likeCountByPost = countByPost(likeCounts)
    const commentCountByPost = countByPost(commentCounts)
    const shareCountByPost = countByPost(shareCounts)

    feedPosts = rows.map((post) => ({
      ...post,
      createdAt: post.createdAt.toISOString(),
      likeCount: likeCountByPost.get(post.id) ?? 0,
      commentCount: commentCountByPost.get(post.id) ?? 0,
      shareCount: shareCountByPost.get(post.id) ?? 0,
      likedByMe: likedIds.has(post.id),
      comments: commentsByPost.get(post.id) ?? [],
    }))
  }

  return <Feed posts={feedPosts} currentUser={currentUser} />
}
