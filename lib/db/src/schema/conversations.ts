import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { listingsTable } from "./listings";

export const conversationsTable = pgTable("conversations", {
  id: text("id").primaryKey(),
  listingId: text("listing_id").notNull().references(() => listingsTable.id, { onDelete: "cascade" }),
  initiatorId: text("initiator_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  ownerId: text("owner_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  dealShown: boolean("deal_shown").notNull().default(false),
  disclaimerAccepted: boolean("disclaimer_accepted").notNull().default(false),
  deliveryMethod: text("delivery_method"),
  escrowActive: boolean("escrow_active").notNull().default(false),
  initiatorLastReadAt: timestamp("initiator_last_read_at"),
  ownerLastReadAt: timestamp("owner_last_read_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
