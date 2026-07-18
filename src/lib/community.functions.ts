import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { enforceRateLimit } from "./rate-limit.server";
import { isEmailVerified } from "./reports-store.functions";

const facets = ["character", "vocation", "love", "shadow", "gift"] as const;
const houses = ["ember", "loam", "aether", "tide"] as const;

const identitySchema = z.object({
  authorTitle: z.string().trim().min(1).max(80),
  authorHouseKey: z.enum(houses),
});

const createPostSchema = identitySchema.extend({
  facet: z.enum(facets),
  bodyText: z.string().trim().min(1).max(1200),
  imagePaths: z.array(z.string().trim().min(1).max(240)).max(4).default([]),
});

const createCommentSchema = identitySchema.extend({
  postId: z.string().uuid(),
  parentId: z.string().uuid().optional().nullable(),
  bodyText: z.string().trim().min(1).max(600),
});

const pageSchema = z.object({
  cursor: z.string().datetime().optional().nullable(),
  limit: z.number().int().min(1).max(30).default(12),
});

const deleteSchema = z.object({ id: z.string().uuid() });
const likeSchema = z
  .object({ postId: z.string().uuid().optional(), commentId: z.string().uuid().optional() })
  .refine((v) => Boolean(v.postId) !== Boolean(v.commentId), "like_target_required");

export type CommunityComment = {
  id: string;
  postId: string;
  parentId: string | null;
  userId: string;
  createdAt: number;
  authorTitle: string;
  authorHouseKey: string;
  text: string;
  hearts: number;
  likedByMe: boolean;
};

export type CommunityPost = {
  id: string;
  userId: string;
  createdAt: number;
  authorTitle: string;
  authorHouseKey: string;
  facet: string;
  text: string;
  imageUrls: string[];
  imagePaths: string[];
  hearts: number;
  likedByMe: boolean;
  comments: CommunityComment[];
};

function createPublicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

function assertVerified(context: { claims: unknown }) {
  if (!isEmailVerified(context.claims)) throw new Error("email_not_verified");
}

function normalizePath(userId: string, path: string) {
  const p = path.replace(/^\/+/, "");
  if (!p.startsWith(`${userId}/`)) throw new Error("invalid_image_path");
  if (!/\.(jpe?g|png|webp)$/i.test(p)) throw new Error("invalid_image_type");
  return p;
}

async function signImagePaths(paths: string[]) {
  if (paths.length === 0) return [];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage.from("community").createSignedUrls(paths, 60 * 20);
  return paths.map((_, i) => data?.[i]?.signedUrl ?? "").filter(Boolean);
}

async function hydratePosts(rawPosts: unknown[], viewerId: string | null): Promise<CommunityPost[]> {
  const posts = rawPosts as Array<{
    id: string;
    user_id: string;
    facet: string;
    body_text: string;
    author_title: string;
    author_house_key: string;
    image_paths: string[] | null;
    created_at: string;
  }>;
  if (posts.length === 0) return [];
  const ids = posts.map((p) => p.id);
  const sb = createPublicClient() as unknown as { from: (t: string) => any };
  const [{ data: comments }, { data: likes }] = await Promise.all([
    sb
      .from("community_comments")
      .select("id, post_id, parent_id, user_id, body_text, author_title, author_house_key, created_at")
      .in("post_id", ids)
      .order("created_at", { ascending: true }),
    sb.from("community_likes").select("user_id, post_id, comment_id").or(`post_id.in.(${ids.join(",")})`),
  ]);
  const allLikes = (likes ?? []) as Array<{ user_id: string; post_id: string | null; comment_id: string | null }>;
  const postLikes = new Map<string, number>();
  const commentLikes = new Map<string, number>();
  const likedPost = new Set<string>();
  const likedComment = new Set<string>();
  for (const l of allLikes) {
    if (l.post_id) {
      postLikes.set(l.post_id, (postLikes.get(l.post_id) ?? 0) + 1);
      if (viewerId && l.user_id === viewerId) likedPost.add(l.post_id);
    }
    if (l.comment_id) {
      commentLikes.set(l.comment_id, (commentLikes.get(l.comment_id) ?? 0) + 1);
      if (viewerId && l.user_id === viewerId) likedComment.add(l.comment_id);
    }
  }
  const commentsByPost = new Map<string, CommunityComment[]>();
  for (const c of (comments ?? []) as Array<{
    id: string;
    post_id: string;
    parent_id: string | null;
    user_id: string;
    body_text: string;
    author_title: string;
    author_house_key: string;
    created_at: string;
  }>) {
    const item: CommunityComment = {
      id: c.id,
      postId: c.post_id,
      parentId: c.parent_id,
      userId: c.user_id,
      createdAt: new Date(c.created_at).getTime(),
      authorTitle: c.author_title,
      authorHouseKey: c.author_house_key,
      text: c.body_text,
      hearts: commentLikes.get(c.id) ?? 0,
      likedByMe: likedComment.has(c.id),
    };
    commentsByPost.set(c.post_id, [...(commentsByPost.get(c.post_id) ?? []), item]);
  }
  return Promise.all(
    posts.map(async (p) => {
      const imagePaths = p.image_paths ?? [];
      return {
        id: p.id,
        userId: p.user_id,
        createdAt: new Date(p.created_at).getTime(),
        authorTitle: p.author_title,
        authorHouseKey: p.author_house_key,
        facet: p.facet,
        text: p.body_text,
        imagePaths,
        imageUrls: await signImagePaths(imagePaths),
        hearts: postLikes.get(p.id) ?? 0,
        likedByMe: likedPost.has(p.id),
        comments: commentsByPost.get(p.id) ?? [],
      };
    }),
  );
}

export const listCommunityPosts = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => pageSchema.parse(d ?? {}))
  .handler(async ({ data }): Promise<{ posts: CommunityPost[]; nextCursor: string | null }> => {
    const sb = createPublicClient() as unknown as { from: (t: string) => any };
    let q = sb
      .from("community_posts")
      .select("id, user_id, facet, body_text, author_title, author_house_key, image_paths, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(data.limit + 1);
    if (data.cursor) q = q.lt("created_at", data.cursor);
    const { data: rows, error } = await q;
    if (error) throw new Error("community_load_failed");
    const slice = (rows ?? []).slice(0, data.limit);
    const posts = await hydratePosts(slice, null);
    return { posts, nextCursor: (rows ?? []).length > data.limit ? slice.at(-1)?.created_at ?? null : null };
  });

export const createCommunityPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createPostSchema.parse(d))
  .handler(async ({ data, context }): Promise<CommunityPost> => {
    assertVerified(context);
    enforceRateLimit(`community-post:${context.userId}`, 6, 60_000, "community posts");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const imagePaths = data.imagePaths.map((p) => normalizePath(context.userId, p));
    const { data: row, error } = await supabaseAdmin
      .from("community_posts")
      .insert({
        user_id: context.userId,
        facet: data.facet,
        body_text: data.bodyText,
        author_title: data.authorTitle,
        author_house_key: data.authorHouseKey,
        image_paths: imagePaths,
      } as never)
      .select("id, user_id, facet, body_text, author_title, author_house_key, image_paths, created_at")
      .single();
    if (error || !row) throw new Error("community_post_failed");
    return (await hydratePosts([row], context.userId))[0];
  });

export const createCommunityComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createCommentSchema.parse(d))
  .handler(async ({ data, context }): Promise<CommunityComment> => {
    assertVerified(context);
    enforceRateLimit(`community-comment:${context.userId}`, 12, 60_000, "community comments");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("community_comments")
      .insert({
        post_id: data.postId,
        parent_id: data.parentId ?? null,
        user_id: context.userId,
        body_text: data.bodyText,
        author_title: data.authorTitle,
        author_house_key: data.authorHouseKey,
      } as never)
      .select("id, post_id, parent_id, user_id, body_text, author_title, author_house_key, created_at")
      .single();
    if (error || !row) throw new Error("community_comment_failed");
    const r = row as unknown as {
      id: string;
      post_id: string;
      parent_id: string | null;
      user_id: string;
      body_text: string;
      author_title: string;
      author_house_key: string;
      created_at: string;
    };
    return {
      id: r.id,
      postId: r.post_id,
      parentId: r.parent_id,
      userId: r.user_id,
      createdAt: new Date(r.created_at).getTime(),
      authorTitle: r.author_title,
      authorHouseKey: r.author_house_key,
      text: r.body_text,
      hearts: 0,
      likedByMe: false,
    };
  });

export const toggleCommunityLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => likeSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ liked: boolean }> => {
    assertVerified(context);
    enforceRateLimit(`community-like:${context.userId}`, 60, 60_000, "community likes");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("community_likes").select("id").eq("user_id", context.userId).limit(1);
    q = data.postId ? q.eq("post_id", data.postId) : q.eq("comment_id", data.commentId!);
    const { data: existing } = await q.maybeSingle();
    if (existing) {
      await supabaseAdmin.from("community_likes").delete().eq("id", (existing as { id: string }).id).eq("user_id", context.userId);
      return { liked: false };
    }
    await supabaseAdmin
      .from("community_likes")
      .insert({ user_id: context.userId, post_id: data.postId ?? null, comment_id: data.commentId ?? null } as never);
    return { liked: true };
  });

export const deleteCommunityPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deleteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("community_posts")
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error("community_delete_failed");
    return { ok: true };
  });

export const deleteCommunityComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deleteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("community_comments")
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error("community_delete_failed");
    return { ok: true };
  });