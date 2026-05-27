import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { conversationsTable } from "./conversations";
import { usersTable } from "./users";

export const escrowDepositsTable = pgTable("escrow_deposits", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversationsTable.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  checkoutSessionId: text("checkout_session_id"),
  paymentIntentId: text("payment_intent_id"),
  amount: integer("amount").notNull().default(500),
  currency: text("currency").notNull().default("eur"),
  // pending → held → confirmed → released | captured
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
});

export type EscrowDepositRow = typeof escrowDepositsTable.$inferSelect;
