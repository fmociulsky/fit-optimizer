import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import type {
  AccountRole,
  CoachRequestStatus,
  PersistedUser,
  StudioDayHours,
  StudioInviteRole,
  ClientPaymentStatus,
  Sex,
  StudioKind,
  StudioMemberRole,
} from "@/lib/types";

export const userStates = pgTable("user_states", {
  userId: text("user_id").primaryKey(),
  payload: jsonb("payload").$type<PersistedUser>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id").primaryKey(),
    role: text("role").$type<AccountRole>().notNull(),
    name: text("name").notNull().default(""),
    email: text("email").unique(),
    username: text("username").unique(),
    clerkUserId: text("clerk_user_id").unique(),
    passwordHash: text("password_hash").notNull().default(""),
    code: text("code").unique(),
    linkedProfessionalId: text("linked_professional_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("accounts_linked_professional_idx").on(table.linkedProfessionalId),
  ]
);

export const coachRequests = pgTable(
  "coach_requests",
  {
    clientUserId: text("client_user_id").primaryKey(),
    professionalUserId: text("professional_user_id").notNull(),
    status: text("status").$type<CoachRequestStatus>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("coach_requests_professional_idx").on(table.professionalUserId),
  ]
);

export const studios = pgTable(
  "studios",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    name: text("name").notNull(),
    kinds: jsonb("kinds").$type<StudioKind[]>().notNull().default(["pilates"]),
    code: text("code").notNull().unique(),
    pilatesItems: jsonb("pilates_items").$type<string[]>().notNull().default([]),
    gymMachines: jsonb("gym_machines").$type<string[]>().notNull().default([]),
    dayHours: jsonb("day_hours").$type<StudioDayHours[]>().notNull().default([]),
    address: text("address").notNull().default(""),
    phone: text("phone").notNull().default(""),
    kind: text("kind").$type<StudioKind>().notNull().default("pilates"),
    openWeekdays: jsonb("open_weekdays").$type<number[]>().notNull().default([1, 2, 3, 4, 5, 6]),
    openFrom: text("open_from").notNull().default("08:00"),
    openTo: text("open_to").notNull().default("21:00"),
    capacityPerSlot: integer("capacity_per_slot").notNull().default(8),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("studios_owner_idx").on(table.ownerUserId)]
);

export const studioMemberships = pgTable(
  "studio_memberships",
  {
    id: text("id").primaryKey(),
    studioId: text("studio_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role").$type<StudioMemberRole>().notNull(),
    sessionsPerWeek: integer("sessions_per_week"),
    assignedTeacherUserId: text("assigned_teacher_user_id"),
    displayName: text("display_name").notNull().default(""),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    birthDate: text("birth_date").notNull().default(""),
    activities: jsonb("activities").$type<StudioKind[]>().notNull().default(["gym"]),
    paymentStatus: text("payment_status")
      .$type<ClientPaymentStatus>()
      .notNull()
      .default("current"),
    serviceEndsOn: text("service_ends_on").notNull().default(""),
    lastPaidOn: text("last_paid_on").notNull().default(""),
    planName: text("plan_name").notNull().default(""),
    feeAmount: integer("fee_amount"),
    billingNotes: text("billing_notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("studio_memberships_studio_user_unique").on(
      table.studioId,
      table.userId
    ),
    index("studio_memberships_studio_idx").on(table.studioId),
    index("studio_memberships_user_idx").on(table.userId),
  ]
);

export const studioInvites = pgTable(
  "studio_invites",
  {
    code: text("code").primaryKey(),
    studioId: text("studio_id").notNull(),
    role: text("role").$type<StudioInviteRole>().notNull(),
    sessionsPerWeek: integer("sessions_per_week"),
    assignedTeacherUserId: text("assigned_teacher_user_id"),
    displayName: text("display_name").notNull().default(""),
    phone: text("phone").notNull().default(""),
    usedByUserId: text("used_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("studio_invites_studio_idx").on(table.studioId)]
);

export const gymTeachers = pgTable(
  "gym_teachers",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    userId: text("user_id").notNull(),
    displayName: text("display_name").notNull(),
    phone: text("phone").notNull().default(""),
    sex: text("sex").$type<Sex>().notNull().default("other"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("gym_teachers_owner_user_unique").on(table.ownerUserId, table.userId),
    index("gym_teachers_owner_idx").on(table.ownerUserId),
  ]
);

export const studioTeacherShifts = pgTable(
  "studio_teacher_shifts",
  {
    id: text("id").primaryKey(),
    studioId: text("studio_id").notNull(),
    teacherUserId: text("teacher_user_id").notNull(),
    weekday: integer("weekday").notNull(),
    startHour: text("start_hour").notNull(),
    endHour: text("end_hour").notNull(),
    capacityPerSlot: integer("capacity_per_slot").notNull().default(8),
  },
  (table) => [
    index("studio_teacher_shifts_studio_idx").on(table.studioId),
    index("studio_teacher_shifts_teacher_idx").on(table.teacherUserId),
  ]
);

export const studioReservations = pgTable(
  "studio_reservations",
  {
    id: text("id").primaryKey(),
    studioId: text("studio_id").notNull(),
    clientUserId: text("client_user_id").notNull(),
    weekday: integer("weekday").notNull(),
    slotStart: text("slot_start").notNull(),
    teacherUserId: text("teacher_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("studio_reservations_client_day").on(
      table.studioId,
      table.clientUserId,
      table.weekday
    ),
    index("studio_reservations_slot_idx").on(
      table.studioId,
      table.weekday,
      table.slotStart
    ),
  ]
);

/** Cobros registrados de alumnos (para estadísticas de ingresos). */
export const studioPayments = pgTable(
  "studio_payments",
  {
    id: text("id").primaryKey(),
    studioId: text("studio_id").notNull(),
    clientUserId: text("client_user_id").notNull(),
    amount: integer("amount").notNull(),
    paidOn: text("paid_on").notNull(),
    planName: text("plan_name").notNull().default(""),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("studio_payments_studio_idx").on(table.studioId),
    index("studio_payments_paid_on_idx").on(table.paidOn),
    index("studio_payments_client_idx").on(table.clientUserId),
  ]
);
