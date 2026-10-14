import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { neon } from "@neondatabase/serverless";

const scryptAsync = promisify(scrypt);
const OWNER_ID = "demo-studio";
const OWNER_CODE = "EST-123456";
const TEACHER_PASSWORD = "1234";
const STUDENT_PASSWORD = "1234";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const PILATES = ["mat", "circle", "ball", "reformer", "bands"];
const MACHINES = [
  "dumbbells",
  "barbell",
  "bench",
  "squat_rack",
  "cable_tower",
  "lat_pulldown",
  "seated_row",
  "leg_press",
  "treadmill",
  "bike",
  "mats",
];

const BRANCHES = [
  {
    name: "Palermo",
    address: "Av. Santa Fe 3253",
    phone: "11 4807-2210",
    kinds: ["gym", "pilates"],
    openFrom: "07:00",
    openTo: "22:00",
    weekdays: [1, 2, 3, 4, 5, 6],
  },
  {
    name: "Belgrano",
    address: "Av. Cabildo 2202",
    phone: "11 4783-4418",
    kinds: ["gym", "pilates"],
    openFrom: "08:00",
    openTo: "21:00",
    weekdays: [1, 2, 3, 4, 5, 6],
  },
  {
    name: "Caballito",
    address: "Av. Rivadavia 5100",
    phone: "11 4901-7733",
    kinds: ["gym"],
    openFrom: "07:00",
    openTo: "21:00",
    weekdays: [1, 2, 3, 4, 5],
  },
  {
    name: "Núñez",
    address: "Av. del Libertador 6900",
    phone: "11 4702-1188",
    kinds: ["pilates", "gym"],
    openFrom: "08:00",
    openTo: "20:00",
    weekdays: [1, 2, 3, 4, 5, 6],
  },
];

const TEACHERS = [
  { name: "Lucía Fernández", username: "lucia.fernandez", phone: "11 5551-2001" },
  { name: "Martín Gómez", username: "martin.gomez", phone: "11 5551-2002" },
  { name: "Valentina Ruiz", username: "valentina.ruiz", phone: "11 5551-2003" },
  { name: "Santiago López", username: "santiago.lopez", phone: "11 5551-2004" },
  { name: "Camila Torres", username: "camila.torres", phone: "11 5551-2005" },
  { name: "Nicolás Díaz", username: "nicolas.diaz", phone: "11 5551-2006" },
  { name: "Florencia Castro", username: "florencia.castro", phone: "11 5551-2007" },
  { name: "Tomás Herrera", username: "tomas.herrera", phone: "11 5551-2008" },
];

const STUDENTS = [
  { name: "Martina Álvarez", email: "martina.alvarez@example.com", phone: "11 4410-3101" },
  { name: "Felipe Romero", email: "felipe.romero@example.com", phone: "11 4410-3102" },
  { name: "Sofía Benítez", email: "sofia.benitez@example.com", phone: "11 4410-3103" },
  { name: "Agustín Morales", email: "agustin.morales@example.com", phone: "11 4410-3104" },
  { name: "Julieta Navarro", email: "julieta.navarro@example.com", phone: "11 4410-3105" },
  { name: "Franco Acosta", email: "franco.acosta@example.com", phone: "11 4410-3106" },
  { name: "Emilia Vargas", email: "emilia.vargas@example.com", phone: "11 4410-3107" },
  { name: "Lautaro Medina", email: "lautaro.medina@example.com", phone: "11 4410-3108" },
  { name: "Catalina Rojas", email: "catalina.rojas@example.com", phone: "11 4410-3109" },
  { name: "Matías Suárez", email: "matias.suarez@example.com", phone: "11 4410-3110" },
  { name: "Paula Ibarra", email: "paula.ibarra@example.com", phone: "11 4410-3111" },
  { name: "Diego Molina", email: "diego.molina@example.com", phone: "11 4410-3112" },
  { name: "Micaela Ponce", email: "micaela.ponce@example.com", phone: "11 4410-3113" },
  { name: "Bruno Aguilar", email: "bruno.aguilar@example.com", phone: "11 4410-3114" },
  { name: "Antonella Vega", email: "antonella.vega@example.com", phone: "11 4410-3115" },
  { name: "Ignacio Ríos", email: "ignacio.rios@example.com", phone: "11 4410-3116" },
  { name: "Carolina Méndez", email: "carolina.mendez@example.com", phone: "11 4410-3117" },
  { name: "Facundo Silva", email: "facundo.silva@example.com", phone: "11 4410-3118" },
  { name: "Daniela Ortiz", email: "daniela.ortiz@example.com", phone: "11 4410-3119" },
  { name: "Ramiro Castro", email: "ramiro.castro@example.com", phone: "11 4410-3120" },
];

const SHIFT_WINDOWS = [
  ["07:00", "12:00"],
  ["08:00", "13:00"],
  ["09:00", "14:00"],
  ["12:00", "17:00"],
  ["14:00", "19:00"],
  ["16:00", "21:00"],
  ["17:00", "22:00"],
];

function uid() {
  return crypto.randomUUID();
}

function makeCode(prefix) {
  let body = "";
  for (let i = 0; i < 6; i += 1) {
    body += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `${prefix}-${body}`;
}

function slugEmail(email) {
  return email.split("@")[0];
}

function shuffle(list) {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function pickN(list, n) {
  return shuffle(list).slice(0, n);
}

function pickActivities(kinds) {
  const options = Array.isArray(kinds) ? kinds.filter(Boolean) : [];
  if (options.length <= 1) return options.length ? options : ["gym"];
  const roll = Math.random();
  if (roll < 0.4) return [options[0]];
  if (roll < 0.7) return [options[1] ?? options[0]];
  return options;
}

function parseHour(value) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function formatHour(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function hourSlots(openFrom, openTo) {
  const start = parseHour(openFrom);
  const end = parseHour(openTo);
  const slots = [];
  for (let t = start; t + 60 <= end; t += 60) slots.push(formatHour(t));
  return slots;
}

function hourCovers(startHour, endHour, slot) {
  const at = parseHour(slot);
  return at >= parseHour(startHour) && at < parseHour(endHour);
}

function clipWindow(window, openFrom, openTo) {
  const start = Math.max(parseHour(window[0]), parseHour(openFrom));
  const end = Math.min(parseHour(window[1]), parseHour(openTo));
  if (end - start < 120) return null;
  return [formatHour(start), formatHour(end)];
}

function randomBirth() {
  const year = 1986 + Math.floor(Math.random() * 18);
  const month = 1 + Math.floor(Math.random() * 12);
  const day = 1 + Math.floor(Math.random() * 28);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

async function fillCaballitoWednesday(branches, teachersByBranch, clients) {
  const cabo = branches.find((item) => item.name === "Caballito");
  if (!cabo) return;
  const wed = cabo.dayHours.find((item) => item.weekday === 3);
  const gymCapacity = Number(wed?.gymCapacity ?? 8) || 8;
  const teacher = teachersByBranch.get(cabo.id)?.[0];
  if (!teacher) return;
  const need = gymCapacity;
  let caboClients = clients.filter((item) => item.branchId === cabo.id);
  const others = clients.filter((item) => item.branchId !== cabo.id);
  while (caboClients.length < need + 1 && others.length) {
    const mover = others.shift();
    await sql`DELETE FROM studio_reservations WHERE client_user_id = ${mover.userId}`;
    await sql`
      UPDATE studio_memberships
      SET studio_id = ${cabo.id},
          assigned_teacher_user_id = ${teacher.userId},
          activities = ${JSON.stringify(["gym"])}::jsonb,
          sessions_per_week = GREATEST(sessions_per_week, 2)
      WHERE user_id = ${mover.userId} AND role = 'client'
    `;
    mover.branchId = cabo.id;
    mover.teacherUserId = teacher.userId;
    caboClients.push(mover);
  }
  const fillers = caboClients.slice(0, need);
  const spare = caboClients.slice(need);
  for (const client of fillers) {
    const existing = await sql`
      SELECT id FROM studio_reservations
      WHERE studio_id = ${cabo.id} AND client_user_id = ${client.userId} AND weekday = 3
      LIMIT 1
    `;
    if (existing[0]) {
      await sql`
        UPDATE studio_reservations
        SET slot_start = '17:00', teacher_user_id = ${client.teacherUserId}
        WHERE id = ${existing[0].id}
      `;
    } else {
      await sql`
        INSERT INTO studio_reservations (
          id, studio_id, client_user_id, weekday, slot_start, teacher_user_id, created_at
        ) VALUES (
          ${uid()}, ${cabo.id}, ${client.userId}, 3, '17:00', ${client.teacherUserId}, ${now}
        )
      `;
      await sql`
        UPDATE studio_memberships
        SET sessions_per_week = (
          SELECT count(*)::int FROM studio_reservations
          WHERE studio_id = ${cabo.id} AND client_user_id = ${client.userId}
        )
        WHERE user_id = ${client.userId} AND studio_id = ${cabo.id}
      `;
    }
  }
  for (const client of spare) {
    const movedOff = await sql`
      UPDATE studio_reservations
      SET slot_start = '10:00'
      WHERE studio_id = ${cabo.id}
        AND client_user_id = ${client.userId}
        AND weekday = 3
        AND slot_start = '17:00'
      RETURNING id
    `;
    const remaining = await sql`
      SELECT id FROM studio_reservations
      WHERE studio_id = ${cabo.id} AND client_user_id = ${client.userId}
      LIMIT 1
    `;
    if (!movedOff.length && !remaining.length) {
      await sql`
        INSERT INTO studio_reservations (
          id, studio_id, client_user_id, weekday, slot_start, teacher_user_id, created_at
        ) VALUES (
          ${uid()}, ${cabo.id}, ${client.userId}, 2, '10:00', ${client.teacherUserId}, ${now}
        )
      `;
      await sql`
        UPDATE studio_memberships
        SET sessions_per_week = 1
        WHERE user_id = ${client.userId} AND studio_id = ${cabo.id}
      `;
    }
  }
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Falta DATABASE_URL");
const sql = neon(url);
const now = new Date();

await sql`DELETE FROM studio_reservations`;
await sql`DELETE FROM studio_teacher_shifts`;
await sql`DELETE FROM studio_invites`;
await sql`DELETE FROM studio_memberships`;
await sql`DELETE FROM gym_teachers`;
await sql`DELETE FROM studios`;
await sql`DELETE FROM coach_requests`;
await sql`DELETE FROM user_states`;
await sql`DELETE FROM accounts WHERE role IN ('professional', 'client')`;
await sql`DELETE FROM accounts WHERE role = 'studio' AND user_id <> ${OWNER_ID}`;

await sql`
  INSERT INTO accounts (user_id, role, name, code, linked_professional_id, password_hash, created_at, updated_at)
  VALUES (${OWNER_ID}, 'studio', 'Enforma', ${OWNER_CODE}, NULL, '', ${now}, ${now})
  ON CONFLICT (user_id) DO UPDATE SET
    role = 'studio',
    name = 'Enforma',
    code = ${OWNER_CODE},
    updated_at = ${now}
`;

const branches = [];
for (const branch of BRANCHES) {
  const id = uid();
  const dayHours = branch.weekdays.map((weekday) => ({
    weekday,
    openFrom: branch.openFrom,
    openTo: branch.openTo,
    gymCapacity: branch.kinds.includes("gym") ? 8 : 0,
    pilatesCapacity: branch.kinds.includes("pilates") ? 6 : 0,
  }));
  const pilates = branch.kinds.includes("pilates") ? PILATES : [];
  const machines = branch.kinds.includes("gym") ? MACHINES : [];
  const code = makeCode("EST");
  await sql`
    INSERT INTO studios (
      id, owner_user_id, name, kinds, kind, code, pilates_items, gym_machines,
      day_hours, address, phone, open_weekdays, open_from, open_to,
      capacity_per_slot, created_at, updated_at
    ) VALUES (
      ${id}, ${OWNER_ID}, ${branch.name}, ${JSON.stringify(branch.kinds)}::jsonb,
      ${branch.kinds[0]}, ${code}, ${JSON.stringify(pilates)}::jsonb,
      ${JSON.stringify(machines)}::jsonb, ${JSON.stringify(dayHours)}::jsonb,
      ${branch.address}, ${branch.phone}, ${JSON.stringify(branch.weekdays)}::jsonb,
      ${branch.openFrom}, ${branch.openTo}, 8, ${now}, ${now}
    )
  `;
  branches.push({ id, ...branch, dayHours });
}

await sql`
  INSERT INTO studio_memberships (
    id, studio_id, user_id, role, display_name, phone, email, birth_date, created_at
  ) VALUES (
    ${uid()}, ${branches[0].id}, ${OWNER_ID}, 'owner', 'Enforma', '', '', '', ${now}
  )
`;

const teacherPasswordHash = await hashPassword(TEACHER_PASSWORD);
const studentPasswordHash = await hashPassword(STUDENT_PASSWORD);
const teachers = [];
for (const teacher of TEACHERS) {
  const userId = uid();
  const code = makeCode("ENF");
  await sql`
    INSERT INTO accounts (
      user_id, role, name, username, password_hash, code, created_at, updated_at
    ) VALUES (
      ${userId}, 'professional', ${teacher.name}, ${teacher.username},
      ${teacherPasswordHash}, ${code}, ${now}, ${now}
    )
  `;
  await sql`
    INSERT INTO gym_teachers (id, owner_user_id, user_id, display_name, phone, created_at)
    VALUES (${uid()}, ${OWNER_ID}, ${userId}, ${teacher.name}, ${teacher.phone}, ${now})
  `;
  teachers.push({ userId, ...teacher, branches: [] });
}

const teachersByBranch = new Map(branches.map((item) => [item.id, []]));
for (const teacher of teachers) {
  const count = 1 + Math.floor(Math.random() * 3);
  teacher.branches = pickN(branches, count);
  for (const branch of teacher.branches) {
    teachersByBranch.get(branch.id).push(teacher);
  }
}
for (const branch of branches) {
  const assigned = teachersByBranch.get(branch.id);
  if (assigned.length) continue;
  const teacher = pick(teachers);
  teacher.branches.push(branch);
  assigned.push(teacher);
}

const shiftsByTeacherBranch = new Map();
for (const teacher of teachers) {
  for (const branch of teacher.branches) {
    await sql`
      INSERT INTO studio_memberships (
        id, studio_id, user_id, role, display_name, phone, email, birth_date, created_at
      ) VALUES (
        ${uid()}, ${branch.id}, ${teacher.userId}, 'teacher', ${teacher.name},
        ${teacher.phone}, '', '', ${now}
      )
    `;
    const window = clipWindow(pick(SHIFT_WINDOWS), branch.openFrom, branch.openTo)
      ?? [branch.openFrom, branch.openTo];
    const days = pickN(branch.weekdays, 3 + Math.floor(Math.random() * 3));
    const shifts = [];
    for (const weekday of days) {
      await sql`
        INSERT INTO studio_teacher_shifts (
          id, studio_id, teacher_user_id, weekday, start_hour, end_hour, capacity_per_slot
        ) VALUES (
          ${uid()}, ${branch.id}, ${teacher.userId}, ${weekday}, ${window[0]}, ${window[1]}, 8
        )
      `;
      shifts.push({ weekday, startHour: window[0], endHour: window[1] });
    }
    shiftsByTeacherBranch.set(`${teacher.userId}:${branch.id}`, shifts);
  }
}

let studentIndex = 0;
const perBranch = Math.floor(STUDENTS.length / branches.length);
const leftover = STUDENTS.length % branches.length;
const studentTargets = branches.flatMap((branch, index) =>
  Array.from(
    { length: perBranch + (index < leftover ? 1 : 0) },
    () => branch
  )
);
shuffle(studentTargets);
const seededClients = [];

for (const student of STUDENTS) {
  const branch = studentTargets[studentIndex] ?? pick(branches);
  studentIndex += 1;
  const candidates = teachersByBranch.get(branch.id);
  const teacher = pick(candidates);
  const shifts = shiftsByTeacherBranch.get(`${teacher.userId}:${branch.id}`) ?? [];
  const sessions = Math.min(
    shifts.length,
    2 + Math.floor(Math.random() * 3)
  );
  const chosen = pickN(shifts, sessions);
  const picks = [];
  for (const shift of chosen) {
    const slots = hourSlots(branch.openFrom, branch.openTo).filter((slot) =>
      hourCovers(shift.startHour, shift.endHour, slot)
    );
    if (!slots.length) continue;
    picks.push({ weekday: shift.weekday, slotStart: pick(slots) });
  }
  const userId = uid();
  const username = slugEmail(student.email);
  const code = makeCode("ALU");
  await sql`
    INSERT INTO accounts (
      user_id, role, name, email, username, password_hash, code, created_at, updated_at
    ) VALUES (
      ${userId}, 'client', ${student.name}, ${student.email}, ${username},
      ${studentPasswordHash}, ${code}, ${now}, ${now}
    )
  `;
  await sql`
    INSERT INTO studio_memberships (
      id, studio_id, user_id, role, sessions_per_week, assigned_teacher_user_id,
      display_name, phone, email, birth_date, activities, created_at
    ) VALUES (
      ${uid()}, ${branch.id}, ${userId}, 'client', ${picks.length || sessions},
      ${teacher.userId}, ${student.name}, ${student.phone}, ${student.email},
      ${randomBirth()}, ${JSON.stringify(pickActivities(branch.kinds))}::jsonb,
      ${now}
    )
  `;
  for (const pickRow of picks) {
    await sql`
      INSERT INTO studio_reservations (
        id, studio_id, client_user_id, weekday, slot_start, teacher_user_id, created_at
      ) VALUES (
        ${uid()}, ${branch.id}, ${userId}, ${pickRow.weekday}, ${pickRow.slotStart},
        ${teacher.userId}, ${now}
      )
    `;
  }
  seededClients.push({
    userId,
    name: student.name,
    branchId: branch.id,
    teacherUserId: teacher.userId,
  });
}

await fillCaballitoWednesday(branches, teachersByBranch, seededClients);

const counts = await sql`
  SELECT
    (SELECT count(*)::int FROM studios) AS studios,
    (SELECT count(*)::int FROM accounts WHERE role = 'professional') AS teachers,
    (SELECT count(*)::int FROM accounts WHERE role = 'client') AS students
`;
console.log("Gimnasio Enforma listo.");
console.log(`Sucursales ${counts[0].studios} · profesores ${counts[0].teachers} · alumnos ${counts[0].students}`);
console.log("Entrar al gimnasio: 2222 / 2222");
console.log(`Alumnos: email o usuario, contraseña ${STUDENT_PASSWORD}`);
console.log(`Profesores (contraseña ${TEACHER_PASSWORD}):`);
for (const teacher of TEACHERS) {
  const assigned = teachers.find((item) => item.username === teacher.username);
  const names = (assigned?.branches ?? []).map((item) => item.name).join(", ");
  console.log(`- ${teacher.name} · ${teacher.username} · ${names}`);
}
