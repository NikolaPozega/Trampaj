import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const blockedUsersTable = pgTable("blocked_users", {
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  blockedUserId: text("blocked_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.blockedUserId] })]);
