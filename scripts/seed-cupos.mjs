import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { neon } from "@neondatabase/serverless";
import {
  afternoonShift,
  planAfternoonStudents,
} from "./cupos-afternoon.mjs";

const scryptAsync = promisify(scrypt);
const PASSWORD = "1234";
const OWNER_USERNAME = "cupos";
const DAYS = [1, 2, 3, 4, 5, 6];
const MORNING_HOURS = ["08:00", "09:00", "10:00", "11:00"];
const AFTERNOON_HOURS = [
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
];
const HOURS = [...MORNING_HOURS, ...AFTERNOON_HOURS];
const OPEN_FROM = "08:00";
const OPEN_TO = "20:00";
const DAY_NAME = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const PLANS = ["fixed", "week", "month"];

const BRANCHES = [
  {
    key: "norte",
    name: "Cupos Norte",
    address: "Av. Cabildo 1840",
    phone: "11 4701-1001",
    teachers: [
      ["Renata Paz", "renata.paz.norte"],
      ["Omar Luna", "omar.luna.norte"],
      ["Vera Gil", "vera.gil.norte"],
      ["Teo Rivas", "teo.rivas.norte"],
      ["Noa Beltrán", "noa.beltran.norte"],
    ],
  },
  {
    key: "centro",
    name: "Cupos Centro",
    address: "Av. Corrientes 2240",
    phone: "11 4372-1002",
    teachers: [
      ["Inés Cano", "ines.cano.centro"],
      ["Pedro Ruiz", "pedro.ruiz.centro"],
      ["Lara Soto", "lara.soto.centro"],
      ["Gael Mora", "gael.mora.centro"],
      ["Delfina Cruz", "delfina.cruz.centro"],
    ],
  },
  {
    key: "sur",
    name: "Cupos Sur",
    address: "Av. Rivadavia 8420",
    phone: "11 4633-1003",
    teachers: [
      ["Bautista León", "bautista.leon.sur"],
      ["Alma Vidal", "alma.vidal.sur"],
      ["Iván Paredes", "ivan.paredes.sur"],
      ["Zoe Campos", "zoe.campos.sur"],
      ["Thiago Núñez", "thiago.nunez.sur"],
    ],
  },
];

const FIRST = [
  "Martina",
  "Felipe",
  "Sofía",
  "Agustín",
  "Julieta",
  "Franco",
  "Emilia",
  "Lautaro",
  "Catalina",
  "Matías",
  "Paula",
  "Diego",
  "Micaela",
  "Bruno",
  "Antonella",
  "Ignacio",
  "Carolina",
  "Facundo",
  "Daniela",
  "Ramiro",
  "Luciana",
  "Gonzalo",
  "Valeria",
  "Esteban",
  "Rocío",
  "Andrés",
  "Pilar",
  "Nicolás",
  "Abril",
  "Simón",
];
const LAST = [
  "Alonso",
  "Benítez",
  "Cabrera",
  "Domínguez",
  "Escobar",
  "Figueroa",
  "Giménez",
  "Herrera",
  "Ibarra",
  "Juárez",
  "Ledesma",
  "Molina",
  "Navarro",
  "Ortiz",
  "Peralta",
  "Quiroga",
  "Roldán",
  "Sosa",
  "Toledo",
  "Uribe",
  "Vega",
  "Wolff",
  "Yáñez",
  "Zabala",
  "Acosta",
  "Blanco",
  "Costa",
  "Duarte",
  "Ferreyra",
  "Gallo",
];

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

function planStudents() {
  const students = FIRST.map((first, index) => ({
    index,
    first,
    last: LAST[index],
    plan: PLANS[index % 3],
    picks: [],
  }));
  const count = new Map();
  const at = (day, hour) => count.get(`${day}|${hour}`) ?? 0;
  function place(student, day, hour) {
    student.picks.push({ weekday: day, slotStart: hour });
    const key = `${day}|${hour}`;
    count.set(key, (count.get(key) ?? 0) + 1);
  }
  function take(day, hour, need) {
    for (let n = 0; n < need; n += 1) {
      const candidate = students
        .filter(
          (student) =>
            student.picks.length < 3 &&
            !student.picks.some((pick) => pick.weekday === day)
        )
        .sort(
          (a, b) => a.picks.length - b.picks.length || a.index - b.index
        )[0];
      if (!candidate) {
        throw new Error(`Faltan alumnos para ${DAY_NAME[day]} ${hour}.`);
      }
      place(candidate, day, hour);
    }
  }

  const targets = [
    [1, "09:00", 4],
    [2, "10:00", 4],
    [3, "09:00", 4],
    [4, "11:00", 4],
    [5, "08:00", 4],
    [6, "10:00", 4],
    [1, "10:00", 3],
    [2, "09:00", 3],
    [3, "11:00", 3],
    [5, "10:00", 3],
    [1, "08:00", 2],
    [4, "09:00", 2],
    [6, "08:00", 2],
    [6, "11:00", 2],
    [2, "08:00", 1],
    [3, "08:00", 1],
    [4, "08:00", 1],
    [5, "11:00", 1],
  ];
  for (const [day, hour, need] of targets) take(day, hour, need);

  for (const [day, hour, need] of targets) {
    if (at(day, hour) !== need) {
      throw new Error(
        `${DAY_NAME[day]} ${hour} quedó en ${at(day, hour)}, esperaba ${need}.`
      );
    }
  }
  for (const day of DAYS) {
    for (const hour of HOURS) {
      if (at(day, hour) > 4) {
        throw new Error(`${DAY_NAME[day]} ${hour} supera el cupo.`);
      }
    }
  }
  if (students.some((student) => student.picks.length < 1)) {
    throw new Error("Hay un alumno sin turnos.");
  }
  return students;
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

const students = [...planStudents(), ...planAfternoonStudents()];
const url = process.env.DATABASE_URL;
if (!url) throw new Error("Falta DATABASE_URL");
const sql = neon(url);
const now = new Date();
const passwordHash = await hashPassword(PASSWORD);

const [owner] = await sql`
  SELECT user_id FROM accounts WHERE username = ${OWNER_USERNAME} LIMIT 1
`;
if (owner) {
  const owned = await sql`
    SELECT id FROM studios WHERE owner_user_id = ${owner.user_id}
  `;
  const studioIds = owned.map((row) => row.id);
  if (studioIds.length) {
    await sql`DELETE FROM studio_waitlist WHERE studio_id = ANY(${studioIds})`;
    await sql`DELETE FROM studio_absences WHERE studio_id = ANY(${studioIds})`;
    await sql`DELETE FROM studio_month_turns WHERE studio_id = ANY(${studioIds})`;
    await sql`DELETE FROM studio_reservations WHERE studio_id = ANY(${studioIds})`;
    await sql`DELETE FROM studio_payments WHERE studio_id = ANY(${studioIds})`;
    await sql`DELETE FROM studio_shift_requests WHERE studio_id = ANY(${studioIds})`;
    await sql`DELETE FROM studio_teacher_shifts WHERE studio_id = ANY(${studioIds})`;
    await sql`DELETE FROM studio_invites WHERE studio_id = ANY(${studioIds})`;
    await sql`DELETE FROM studio_memberships WHERE studio_id = ANY(${studioIds})`;
    await sql`DELETE FROM studios WHERE id = ANY(${studioIds})`;
  }
  await sql`DELETE FROM gym_teachers WHERE owner_user_id = ${owner.user_id}`;
}
const previousPeople = await sql`
  SELECT user_id FROM accounts
  WHERE username = ${OWNER_USERNAME} OR email LIKE '%@cupos.test'
`;
const previousIds = previousPeople.map((row) => row.user_id);
if (previousIds.length) {
  await sql`DELETE FROM studio_memberships WHERE user_id = ANY(${previousIds})`;
  await sql`DELETE FROM gym_teachers WHERE user_id = ANY(${previousIds})`;
  await sql`DELETE FROM accounts WHERE user_id = ANY(${previousIds})`;
}

const ownerId = uid();
await sql`
  INSERT INTO accounts (
    user_id, role, name, email, username, password_hash, code,
    max_branches, service_active, created_at, updated_at
  ) VALUES (
    ${ownerId}, 'studio', 'Estudio Cupos', 'estudio@cupos.test',
    ${OWNER_USERNAME}, ${passwordHash}, 'EST-CUPOS', 3, true, ${now}, ${now}
  )
`;

const dayHours = DAYS.map((weekday) => ({
  weekday,
  openFrom: OPEN_FROM,
  openTo: OPEN_TO,
  gymCapacity: 4,
  pilatesCapacity: 4,
}));
const machines = [
  "dumbbells",
  "barbell",
  "bench",
  "squat_rack",
  "cable_tower",
  "lat_pulldown",
  "treadmill",
  "bike",
  "mats",
];

const createdBranches = [];
for (const branch of BRANCHES) {
  const studioId = uid();
  const code = `CUP-${branch.key.toUpperCase()}`;
  await sql`
    INSERT INTO studios (
      id, owner_user_id, name, kinds, kind, code, pilates_items, gym_machines,
      day_hours, address, phone, open_weekdays, open_from, open_to,
      capacity_per_slot, cancel_notice_hours, max_cancels_per_month,
      created_at, updated_at
    ) VALUES (
      ${studioId}, ${ownerId}, ${branch.name}, ${JSON.stringify(["gym"])}::jsonb,
      'gym', ${code}, '[]'::jsonb, ${JSON.stringify(machines)}::jsonb,
      ${JSON.stringify(dayHours)}::jsonb, ${branch.address}, ${branch.phone},
      ${JSON.stringify(DAYS)}::jsonb, ${OPEN_FROM}, ${OPEN_TO}, 4, 12, 4, ${now}, ${now}
    )
  `;
  const teachers = [];
  for (const [name, username] of branch.teachers) {
    const userId = uid();
    const email = `${username}@cupos.test`;
    await sql`
      INSERT INTO accounts (
        user_id, role, name, email, username, password_hash, code,
        created_at, updated_at
      ) VALUES (
        ${userId}, 'professional', ${name}, ${email}, ${username},
        ${passwordHash}, ${`PRO-${uid().slice(0, 6).toUpperCase()}`}, ${now}, ${now}
      )
    `;
    await sql`
      INSERT INTO gym_teachers (
        id, owner_user_id, user_id, display_name, phone, sex, active, created_at
      ) VALUES (
        ${uid()}, ${ownerId}, ${userId}, ${name}, ${branch.phone}, 'other', true, ${now}
      )
    `;
    await sql`
      INSERT INTO studio_memberships (
        id, studio_id, user_id, role, display_name, phone, email, created_at
      ) VALUES (
        ${uid()}, ${studioId}, ${userId}, 'teacher', ${name}, ${branch.phone},
        ${email}, ${now}
      )
    `;
    for (const weekday of DAYS) {
      const morning =
        teachers.length % 5 === 1
          ? ["08:00", "10:00"]
          : teachers.length % 5 === 2
            ? ["10:00", "12:00"]
            : teachers.length % 5 === 3
              ? weekday <= 3
                ? ["08:00", "12:00"]
                : null
              : teachers.length % 5 === 4
                ? weekday >= 4
                  ? ["08:00", "12:00"]
                  : null
                : ["08:00", "12:00"];
      const windows = [morning, afternoonShift(teachers.length, weekday)].filter(
        Boolean
      );
      for (const window of windows) {
        await sql`
          INSERT INTO studio_teacher_shifts (
            id, studio_id, teacher_user_id, weekday, start_hour, end_hour, capacity_per_slot
          ) VALUES (
            ${uid()}, ${studioId}, ${userId}, ${weekday}, ${window[0]}, ${window[1]}, 4
          )
        `;
      }
    }
    teachers.push({ userId, name, username });
  }
  const anchor = teachers[0];
  for (const student of students) {
    const name = `${student.first} ${student.last}`;
    const username = `${slug(student.first)}.${slug(student.last)}.${branch.key}`;
    const email = `${username}@cupos.test`;
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
        ${uid()}, ${studioId}, ${userId}, 'client', ${student.picks.length},
        ${student.plan}, ${anchor.userId}, ${name}, ${branch.phone}, ${email},
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
          ${uid()}, ${studioId}, ${userId}, ${pick.weekday}, ${pick.slotStart},
          ${anchor.userId}, ${now}
        )
      `;
    }
  }
  createdBranches.push({ studioId, name: branch.name, teachers });
}

await sql`
  INSERT INTO studio_memberships (
    id, studio_id, user_id, role, display_name, created_at
  ) VALUES (
    ${uid()}, ${createdBranches[0].studioId}, ${ownerId}, 'owner',
    'Estudio Cupos', ${now}
  )
`;

const occupancy = await sql`
  SELECT s.name, r.weekday, r.slot_start, count(*)::int AS taken
  FROM studio_reservations r
  JOIN studios s ON s.id = r.studio_id
  WHERE s.owner_user_id = ${ownerId}
  GROUP BY s.name, r.weekday, r.slot_start
  ORDER BY s.name, r.weekday, r.slot_start
`;
const plans = await sql`
  SELECT s.name, m.turn_plan, count(*)::int AS students
  FROM studio_memberships m
  JOIN studios s ON s.id = m.studio_id
  WHERE s.owner_user_id = ${ownerId} AND m.role = 'client'
  GROUP BY s.name, m.turn_plan
  ORDER BY s.name, m.turn_plan
`;
const headcount = await sql`
  SELECT
    (SELECT count(*)::int FROM studios WHERE owner_user_id = ${ownerId}) AS branches,
    (SELECT count(*)::int FROM gym_teachers WHERE owner_user_id = ${ownerId}) AS teachers,
    (SELECT count(*)::int FROM studio_memberships m
      JOIN studios s ON s.id = m.studio_id
      WHERE s.owner_user_id = ${ownerId} AND m.role = 'client') AS students
`;

console.log("Estudio Cupos listo.");
console.log(
  `Sucursales ${headcount[0].branches} · profesores ${headcount[0].teachers} · alumnos ${headcount[0].students}`
);
console.log(`Entrar al estudio: ${OWNER_USERNAME} / ${PASSWORD}`);
for (const branch of createdBranches) {
  console.log(`\n${branch.name}`);
  console.log(
    `Profes: ${branch.teachers.map((item) => `${item.name} (${item.username})`).join(", ")}`
  );
  console.log(`        ${HOURS.map((hour) => hour.slice(0, 2)).join("  ")}`);
  for (const day of DAYS) {
    const cells = HOURS.map((hour) => {
      const row = occupancy.find(
        (item) =>
          item.name === branch.name &&
          item.weekday === day &&
          item.slot_start === hour
      );
      return String(row?.taken ?? 0).padStart(3, " ");
    });
    console.log(`${DAY_NAME[day].padEnd(6, " ")}${cells.join(" ")}`);
  }
}
console.log("\nPlanes por sucursal:");
for (const row of plans) {
  console.log(`- ${row.name}: ${row.turn_plan} ${row.students}`);
}
const samples = students
  .filter((student) =>
    student.picks.some((pick) => pick.weekday === 1 && pick.slotStart === "09:00")
  )
  .map(
    (student) =>
      `${student.first} ${student.last} · ${student.plan} · ${slug(student.first)}.${slug(student.last)}.norte`
  );
console.log("\nLunes 09:00 lleno (4/4) en cada sucursal. En Norte:");
for (const line of samples) console.log(`- ${line}`);
