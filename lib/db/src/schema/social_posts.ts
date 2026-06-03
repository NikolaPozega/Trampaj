import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const socialPostsTable = pgTable("social_posts", {
  id: text("id").primaryKey(),
  platform: text("platform").notNull(), // 'facebook' | 'instagram'
  postId: text("post_id").notNull(),
  listingId: text("listing_id"),
  listingTitle: text("listing_title").notNull().default(""),
  caption: text("caption").notNull().default(""),
  imageUrl: text("image_url"),
  status: text("status").notNull().default("published"), // 'published' | 'deleted' | 'error'
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SocialPost = typeof socialPostsTable.$inferSelect;
