export type SocialComment = {
  id: string
  authorId: string
  authorName: string
  authorImage: string | null
  content: string
  createdAt: string
}

export type FeedPost = {
  id: string
  authorId: string
  authorName: string
  authorImage: string | null
  content: string
  imageUrl: string | null
  createdAt: string
  likeCount: number
  commentCount: number
  shareCount: number
  likedByMe: boolean
  comments: SocialComment[]
}

export type FeedUser = {
  id: string
  name: string
  image: string | null
}
