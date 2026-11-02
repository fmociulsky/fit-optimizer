const PLANS = ["fixed", "week", "month"];
const DAYS = [1, 2, 3, 4, 5, 6];
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
const DAY_NAME = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const FIRST = [
  "Bianca",
  "Ciro",
  "Delfina",
  "Elías",
  "Florencia",
  "Gael",
  "Helena",
  "Iván",
  "Jimena",
  "Kevin",
  "Lola",
  "Máximo",
  "Nadia",
  "Octavio",
  "Paloma",
  "Quimey",
  "Renzo",
  "Selena",
  "Tomás",
  "Uma",
  "Vicente",
  "Wanda",
  "Xavier",
  "Yamila",
  "Zoe",
  "Benicio",
  "Clara",
  "Dante",
  "Elena",
  "Fausto",
  "Greta",
  "Hugo",
  "Iris",
  "Joaquín",
  "Kiara",
  "León",
];
const LAST = [
  "Pereyra",
  "Ramos",
  "Salinas",
  "Torres",
  "Urrutia",
  "Villalba",
  "Waisman",
  "Zarate",
  "Aguirre",
  "Bustos",
  "Cáceres",
  "Delgado",
  "Espinosa",
  "Funes",
  "Godoy",
  "Hurtado",
  "Iglesias",
  "Jerez",
  "Kessler",
  "Lagos",
  "Mansilla",
  "Nieva",
  "Ocampo",
  "Pinto",
  "Quinteros",
  "Reynoso",
  "Segovia",
  "Taborda",
  "Ulloa",
  "Villanueva",
  "Aranda",
  "Barrios",
  "Correa",
  "Díaz",
  "Paz",
  "Luna",
];

/** Cupo de cada hora de la tarde. Hay llenos, medios y sueltos. */
const TARGETS = [
  [1, "12:00", 4],
  [2, "13:00", 4],
  [3, "14:00", 4],
  [4, "15:00", 4],
  [5, "16:00", 4],
  [6, "17:00", 4],
  [1, "18:00", 4],
  [2, "19:00", 4],
  [3, "12:00", 3],
  [4, "13:00", 3],
  [5, "14:00", 3],
  [6, "15:00", 3],
  [1, "16:00", 3],
  [2, "17:00", 3],
  [3, "18:00", 3],
  [4, "19:00", 3],
  [5, "12:00", 2],
  [6, "13:00", 2],
  [1, "14:00", 2],
  [2, "15:00", 2],
  [3, "16:00", 2],
  [4, "17:00", 2],
  [5, "18:00", 2],
  [6, "19:00", 2],
  [2, "12:00", 1],
  [3, "13:00", 1],
  [4, "14:00", 1],
  [5, "15:00", 1],
  [6, "16:00", 1],
  [1, "17:00", 1],
  [2, "18:00", 1],
  [3, "19:00", 1],
  [1, "13:00", 1],
  [1, "15:00", 1],
  [1, "19:00", 1],
  [2, "14:00", 1],
  [2, "16:00", 1],
  [3, "15:00", 1],
  [3, "17:00", 1],
  [4, "12:00", 1],
  [4, "16:00", 1],
  [4, "18:00", 1],
  [5, "13:00", 1],
  [5, "17:00", 1],
  [5, "19:00", 1],
  [6, "12:00", 1],
  [6, "14:00", 1],
  [6, "18:00", 1],
];

export function afternoonShift(teacherIndex, weekday) {
  if (teacherIndex % 5 === 1) return ["12:00", "16:00"];
  if (teacherIndex % 5 === 2) return ["16:00", "20:00"];
  if (teacherIndex % 5 === 3) return weekday <= 3 ? ["12:00", "20:00"] : null;
  if (teacherIndex % 5 === 4) return weekday >= 4 ? ["12:00", "20:00"] : null;
  return ["12:00", "20:00"];
}

export function planAfternoonStudents() {
  const students = FIRST.map((first, index) => ({
    index: 30 + index,
    first,
    last: LAST[index],
    plan: PLANS[(30 + index) % 3],
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
        .sort((a, b) => a.picks.length - b.picks.length || a.index - b.index)[0];
      if (!candidate) {
        throw new Error(`Faltan alumnos de tarde para ${DAY_NAME[day]} ${hour}.`);
      }
      place(candidate, day, hour);
    }
  }

  for (const [day, hour, need] of TARGETS) take(day, hour, need);

  for (const [day, hour, need] of TARGETS) {
    if (at(day, hour) !== need) {
      throw new Error(
        `${DAY_NAME[day]} ${hour} quedó en ${at(day, hour)}, esperaba ${need}.`
      );
    }
  }
  for (const day of DAYS) {
    for (const hour of AFTERNOON_HOURS) {
      if (at(day, hour) < 1) {
        throw new Error(`${DAY_NAME[day]} ${hour} quedó vacío.`);
      }
      if (at(day, hour) > 4) {
        throw new Error(`${DAY_NAME[day]} ${hour} supera el cupo.`);
      }
    }
  }
  if (students.some((student) => student.picks.length < 1)) {
    throw new Error("Hay un alumno de la tarde sin turnos.");
  }
  return students;
}
