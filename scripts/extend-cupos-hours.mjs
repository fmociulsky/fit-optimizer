import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { neon } from "@neondatabase/serverless";
import {
  afternoonShift,
  planAfternoonStudents,
} from "./cupos-afternoon.mjs";

const scryptAsync = promisify(scrypt);
const PASSWORD = "1234";
const OPEN_FROM = "08:00";
const OPEN_TO = "20:00";
const DAYS = [1, 2, 3, 4, 5, 6];
const TEACHERS = {
  norte: [
    "renata.paz.norte",
    "omar.luna.norte",
    "vera.gil.norte",
    "teo.rivas.norte",
    "noa.beltran.norte",
  ],
  centro: [
    "ines.cano.centro",
    "pedro.ruiz.centro",
    "lara.soto.centro",
    "gael.mora.centro",
    "delfina.cruz.centro",
  ],
  sur: [
    "bautista.leon.sur",
    "alma.vidal.sur",
    "ivan.paredes.sur",
    "zoe.campos.sur",
    "thiago.nunez.sur",
  ],
};

function uid() {
  return crypto.randomUUID();
}

function slug(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Falta DATABASE_URL");
const sql = neon(url);
const now = new Date();
const students = planAfternoonStudents();
const passwordHash = await hashPassword(PASSWORD);

const branches = await sql`
  SELECT s.id, s.name, s.code, s.phone, s.day_hours, s.open_from, s.open_to
  FROM studios s
  JOIN accounts a ON a.user_id = s.owner_user_id
  WHERE a.username = 'cupos'
  ORDER BY s.name
`;
if (branches.length !== 3) {
  throw new Error(`Esperaba 3 sucursales de Cupos y hay ${branches.length}.`);
}

for (const branch of branches) {
  const key = branch.code.replace("CUP-", "").toLowerCase();
  const current = Array.isArray(branch.day_hours) ? branch.day_hours : [];
  const dayHours = DAYS.map((weekday) => {
    const existing = current.find((item) => item.weekday === weekday) ?? {};
    return {
      ...existing,
      weekday,
      openFrom: OPEN_FROM,
      openTo: OPEN_TO,
      gymCapacity: existing.gymCapacity ?? 4,
      pilatesCapacity: existing.pilatesCapacity ?? 4,
    };
  });
  await sql`
    UPDATE studios
    SET open_from = ${OPEN_FROM},
        open_to = ${OPEN_TO},
        day_hours = ${JSON.stringify(dayHours)}::jsonb,
        updated_at = ${now}
    WHERE id = ${branch.id}
  `;
  branch.key = key;
  branch.dayHours = dayHours;
}

const teacherRows = await sql`
  SELECT m.studio_id, m.user_id, a.username
  FROM studio_memberships m
  JOIN accounts a ON a.user_id = m.user_id
  WHERE m.role = 'teacher'
    AND m.studio_id = ANY(${branches.map((branch) => branch.id)})
`;
const teachersByStudio = new Map(branches.map((branch) => [branch.id, []]));
for (const branch of branches) {
  const order = TEACHERS[branch.key];
  if (!order) throw new Error(`Sucursal desconocida: ${branch.code}`);
  const rows = teacherRows.filter((row) => row.studio_id === branch.id);
  const ordered = order.map((username) => {
    const row = rows.find((item) => item.username === username);
    if (!row) throw new Error(`Falta el profe ${username}.`);
    return row;
  });
  teachersByStudio.set(branch.id, ordered);
}

const existingShifts = await sql`
  SELECT studio_id, teacher_user_id, weekday, start_hour, end_hour
  FROM studio_teacher_shifts
  WHERE studio_id = ANY(${branches.map((branch) => branch.id)})
`;
const shiftKey = (row) =>
  `${row.studio_id}|${row.teacher_user_id}|${row.weekday}|${row.start_hour}|${row.end_hour}`;
const shiftKeys = new Set(existingShifts.map(shiftKey));
let shiftsAdded = 0;
for (const branch of branches) {
  const teachers = teachersByStudio.get(branch.id);
  for (const [index, teacher] of teachers.entries()) {
    for (const weekday of DAYS) {
      const window = afternoonShift(index, weekday);
      if (!window) continue;
      const row = {
        studio_id: branch.id,
        teacher_user_id: teacher.user_id,
        weekday,
        start_hour: window[0],
        end_hour: window[1],
      };
      if (shiftKeys.has(shiftKey(row))) continue;
      await sql`
        INSERT INTO studio_teacher_shifts (
          id, studio_id, teacher_user_id, weekday, start_hour, end_hour, capacity_per_slot
        ) VALUES (
          ${uid()}, ${branch.id}, ${teacher.user_id}, ${weekday},
          ${window[0]}, ${window[1]}, 4
        )
      `;
      shiftKeys.add(shiftKey(row));
      shiftsAdded += 1;
    }
  }
}

const emails = branches.flatMap((branch) =>
  students.map(
    (student) =>
      `${slug(student.first)}.${slug(student.last)}.${branch.key}@cupos.test`
  )
);
const existingAccounts = await sql`
  SELECT email FROM accounts WHERE email = ANY(${emails})
`;
const existingEmails = new Set(existingAccounts.map((row) => row.email));
let studentsAdded = 0;
let turnsAdded = 0;
for (const branch of branches) {
  const anchor = teachersByStudio.get(branch.id)[0];
  for (const student of students) {
    const name = `${student.first} ${student.last}`;
    const username = `${slug(student.first)}.${slug(student.last)}.${branch.key}`;
    const email = `${username}@cupos.test`;
    if (existingEmails.has(email)) continue;
    if (username.length > 32) {
      throw new Error(`Usuario demasiado largo: ${username}`);
    }
    const userId = uid();
    await sql`
      INSERT INTO accounts (
        user_id, role, name, email, username, password_hash, code,
        created_at, updated_at
      ) VALUES (
        ${userId}, 'client', ${name}, ${email}, ${username}, ${passwordHash},
        ${`ALU-${uid().slice(0, 6).toUpperCase()}`}, ${now}, ${now}
      )
    `;
    await sql`
      INSERT INTO studio_memberships (
        id, studio_id, user_id, role, sessions_per_week, turn_plan,
        assigned_teacher_user_id, display_name, phone, email, birth_date,
        activities, payment_status, plan_name, fee_amount, last_paid_on,
        service_ends_on, created_at
      ) VALUES (
        ${uid()}, ${branch.id}, ${userId}, 'client', ${student.picks.length},
        ${student.plan}, ${anchor.user_id}, ${name}, ${branch.phone}, ${email},
        ${`199${student.index % 10}-0${(student.index % 8) + 1}-15`},
        ${JSON.stringify(["gym"])}::jsonb, 'current', 'mensual', 18000,
        '2026-10-01', '2026-12-31', ${now}
      )
    `;
    for (const pick of student.picks) {
      await sql`
        INSERT INTO studio_reservations (
          id, studio_id, client_user_id, weekday, slot_start, teacher_user_id, created_at
        ) VALUES (
          ${uid()}, ${branch.id}, ${userId}, ${pick.weekday}, ${pick.slotStart},
          ${anchor.user_id}, ${now}
        )
      `;
      turnsAdded += 1;
    }
    existingEmails.add(email);
    studentsAdded += 1;
  }
}

const occupancy = await sql`
  SELECT s.name, r.slot_start, count(*)::int AS taken
  FROM studio_reservations r
  JOIN studios s ON s.id = r.studio_id
  WHERE s.id = ANY(${branches.map((branch) => branch.id)})
    AND r.slot_start >= '12:00'
  GROUP BY s.name, r.slot_start
  ORDER BY s.name, r.slot_start
`;
const headcount = await sql`
  SELECT s.name, s.open_from, s.open_to, count(m.id)::int AS students
  FROM studios s
  JOIN studio_memberships m ON m.studio_id = s.id AND m.role = 'client'
  WHERE s.id = ANY(${branches.map((branch) => branch.id)})
  GROUP BY s.name, s.open_from, s.open_to
  ORDER BY s.name
`;

console.log(`Turnos de profe nuevos: ${shiftsAdded}`);
console.log(`Alumnos nuevos: ${studentsAdded}`);
console.log(`Reservas nuevas: ${turnsAdded}`);
for (const row of headcount) {
  console.log(`${row.name}: ${row.open_from}–${row.open_to}, ${row.students} alumnos`);
}
console.log("Ocupación de la tarde:");
for (const row of occupancy) {
  console.log(`- ${row.name} ${row.slot_start}: ${row.taken}`);
}
