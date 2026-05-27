import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { listingsTable } from "./listings";

export const savedListingsTable = pgTable("saved_listings", {
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  listingId: text("listing_id").notNull().references(() => listingsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.listingId] })]);
