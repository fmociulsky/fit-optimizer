import {
  boolean,
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
  TurnPlan,
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
    /** Contrato Enforma (cuentas role=studio): si está apagado, nadie del gimnasio entra. */
    serviceActive: boolean("service_active").notNull().default(true),
    serviceStartsOn: text("service_starts_on").notNull().default(""),
    serviceEndsOn: text("service_ends_on").notNull().default(""),
    serviceFeeAmount: integer("service_fee_amount"),
    /** Máximo de sucursales que puede dar de alta el gimnasio. */
    maxBranches: integer("max_branches").notNull().default(1),
    /** Cobro del contrato Enforma (cuentas role=studio). */
    servicePaymentStatus: text("service_payment_status")
      .$type<"current" | "overdue">()
      .notNull()
      .default("current"),
    serviceLastPaidOn: text("service_last_paid_on").notNull().default(""),
    /** Contacto comercial / responsable del gimnasio contratado. */
    contactName: text("contact_name").notNull().default(""),
    contactPhone: text("contact_phone").notNull().default(""),
    contactEmail: text("contact_email").notNull().default(""),
    /** Logo del gimnasio (cuentas role=studio), data URL. */
    logoData: text("logo_data").notNull().default(""),
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
    /** Horas de anticipación para que un aviso devuelva un crédito. */
    cancelNoticeHours: integer("cancel_notice_hours").notNull().default(12),
    /** Avisos con crédito permitidos en el mes de la clase. */
    maxCancelsPerMonth: integer("max_cancels_per_month").notNull().default(4),
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
    /** fixed: solo cancela. week: recupera esa semana. month: cualquier día del mes. */
    turnPlan: text("turn_plan").$type<TurnPlan>().notNull().default("month"),
    assignedTeacherUserId: text("assigned_teacher_user_id"),
    displayName: text("display_name").notNull().default(""),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    birthDate: text("birth_date").notNull().default(""),
    photoData: text("photo_data").notNull().default(""),
    emergencyName: text("emergency_name").notNull().default(""),
    emergencyPhone: text("emergency_phone").notNull().default(""),
    activities: jsonb("activities").$type<StudioKind[]>().notNull().default(["gym"]),
    paymentStatus: text("payment_status")
      .$type<ClientPaymentStatus>()
      .notNull()
      .default("current"),
    /** El alumno avisó que pagó y el estudio todavía no lo confirmó. */
    paymentClaimedAt: timestamp("payment_claimed_at", { withTimezone: true }),
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
    active: boolean("active").notNull().default(true),
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

/** Clase concreta de un mes, generada desde el horario fijo semanal. */
export const studioMonthTurns = pgTable(
  "studio_month_turns",
  {
    id: text("id").primaryKey(),
    studioId: text("studio_id").notNull(),
    clientUserId: text("client_user_id").notNull(),
    occursOn: text("occurs_on").notNull(),
    weekday: integer("weekday").notNull(),
    slotStart: text("slot_start").notNull(),
    teacherUserId: text("teacher_user_id"),
    /** fixed: sale del horario semanal. recovery queda para cuando exista el crédito. */
    source: text("source").$type<"fixed" | "recovery">().notNull().default("fixed"),
    /** absent: el alumno ya avisó que no va ese día. */
    status: text("status")
      .$type<"scheduled" | "absent">()
      .notNull()
      .default("scheduled"),
    /** Asistencia marcada por el profesor cuando el turno ya pasó. */
    attendance: text("attendance").$type<"present" | "absent">(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("studio_month_turns_client_slot").on(
      table.studioId,
      table.clientUserId,
      table.occursOn,
      table.slotStart
    ),
    index("studio_month_turns_studio_day_idx").on(table.studioId, table.occursOn),
    index("studio_month_turns_client_idx").on(table.clientUserId),
  ]
);

export type ShiftRequestStatus = "pending" | "approved" | "rejected";

export type ProposedTeacherShift = {
  weekday: number;
  startHour: string;
  endHour: string;
  capacityPerSlot?: number;
};

/** Avisos de ausencia de un alumno para una fecha concreta (libera cupo ese día). */
export const studioAbsences = pgTable(
  "studio_absences",
  {
    id: text("id").primaryKey(),
    studioId: text("studio_id").notNull(),
    clientUserId: text("client_user_id").notNull(),
    absentOn: text("absent_on").notNull(),
    weekday: integer("weekday").notNull(),
    slotStart: text("slot_start").notNull(),
    /** credit: avisó a tiempo y dentro del tope. notice: avisó tarde o sin crédito. */
    outcome: text("outcome")
      .$type<"credit" | "notice">()
      .notNull()
      .default("notice"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("studio_absences_client_day").on(
      table.studioId,
      table.clientUserId,
      table.absentOn
    ),
    index("studio_absences_studio_day_idx").on(table.studioId, table.absentOn),
  ]
);

/** Lista de espera de un horario lleno. El orden es el de createdAt. */
export const studioWaitlist = pgTable(
  "studio_waitlist",
  {
    id: text("id").primaryKey(),
    studioId: text("studio_id").notNull(),
    clientUserId: text("client_user_id").notNull(),
    occursOn: text("occurs_on").notNull(),
    weekday: integer("weekday").notNull(),
    slotStart: text("slot_start").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("studio_waitlist_client_slot").on(
      table.studioId,
      table.clientUserId,
      table.occursOn,
      table.slotStart
    ),
    index("studio_waitlist_slot_idx").on(
      table.studioId,
      table.occursOn,
      table.slotStart,
      table.createdAt
    ),
  ]
);

/** Pedidos de cambio de horario del profesor, pendientes de aprobación del estudio. */
export const studioShiftRequests = pgTable(
  "studio_shift_requests",
  {
    id: text("id").primaryKey(),
    studioId: text("studio_id").notNull(),
    teacherUserId: text("teacher_user_id").notNull(),
    proposedShifts: jsonb("proposed_shifts")
      .$type<ProposedTeacherShift[]>()
      .notNull()
      .default([]),
    status: text("status")
      .$type<ShiftRequestStatus>()
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    index("studio_shift_requests_studio_idx").on(table.studioId),
    index("studio_shift_requests_teacher_idx").on(table.teacherUserId),
    index("studio_shift_requests_status_idx").on(table.status),
  ]
);
