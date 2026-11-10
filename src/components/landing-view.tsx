import Image from "next/image";
import Link from "next/link";
import {
  Building2,
  CalendarCheck,
  ChartColumn,
  GraduationCap,
  Users,
  Wallet,
} from "lucide-react";
import { DemoRequestButton } from "@/components/demo-request-form";
import { SiteHeader } from "@/components/site-header";

const AUDIENCES = [
  {
    id: "estudio",
    eyebrow: "Estudio",
    title: "Sucursales, profesores y alumnos en un solo lugar.",
    text: "Armá sedes con horarios y cupo, asigná profesores, cobrá planes y mirá la agenda de la semana sin planillas.",
    points: [
      {
        icon: Building2,
        label: "Multi-sede",
        detail: "Gimnasio, pilates o ambos, con equipamiento real.",
      },
      {
        icon: CalendarCheck,
        label: "Agenda con cupo",
        detail: "Turnos fijos, por semana o por mes, lista de espera y recuperos.",
      },
      {
        icon: Wallet,
        label: "Cuentas",
        detail: "Planes de pago, vencimientos y avisos de cuota.",
      },
      {
        icon: ChartColumn,
        label: "Estadísticas",
        detail: "Ingresos y alumnos por mes, filtrados por sucursal.",
      },
    ],
    image: "/machines/functional.jpg",
    imageAlt: "Sala de entrenamiento funcional",
  },
  {
    id: "profesor",
    eyebrow: "Profesor",
    title: "Tu agenda. El turno de ahora.",
    text: "Ves quién entra en cada franja, marcás asistencia, cargás el plan de tus alumnos y pedís cambios de horario o licencias.",
    points: [
      {
        icon: CalendarCheck,
        label: "Turno en vivo",
        detail: "Alumnos del slot, ausencias avisadas y próximas clases.",
      },
      {
        icon: GraduationCap,
        label: "Planes",
        detail: "Cargá o editá el entrenamiento de cada alumno asignado.",
      },
      {
        icon: Building2,
        label: "Sucursales",
        detail: "Definí tus horas dentro de la apertura de cada sede.",
      },
    ],
    image: "/landing/agenda.jpg",
    imageAlt: "Agenda semanal de Enforma con turnos y cupos",
  },
  {
    id: "alumno",
    eyebrow: "Alumno",
    title: "Hoy entrenás a las…",
    text: "Entrá con tu código, mirá la agenda, avisá si no vas, usá créditos de recupero y seguí el plan que te armó el profesor — o generá el tuyo.",
    points: [
      {
        icon: CalendarCheck,
        label: "Agenda y avisos",
        detail: "Hoy no voy, al final sí, lista de espera y créditos.",
      },
      {
        icon: GraduationCap,
        label: "Plan con fecha",
        detail: "Sesión de hoy, semana completa y check-ins que reajustan.",
      },
      {
        icon: Users,
        label: "Nutrición y mente",
        detail: "Menú alineado al entreno y minutos para la cabeza.",
      },
    ],
    image: "/pilates/reformer.jpg",
    imageAlt: "Reformer de pilates",
  },
] as const;

export function LandingView() {
  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />

      <section className="relative isolate min-h-[min(92svh,52rem)] overflow-hidden">
        <Image
          src="/landing/gym-floor.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(180deg,oklch(0.18_0.02_50/0.45)_0%,oklch(0.18_0.02_50/0.78)_58%,oklch(0.965_0.012_85)_100%)]"
          aria-hidden
        />
        <div className="relative mx-auto flex min-h-[min(92svh,52rem)] w-full max-w-5xl flex-col justify-center px-4 pb-28 pt-24 sm:pb-36">
          <p className="font-heading text-5xl tracking-tight text-white italic sm:text-7xl animate-in fade-in slide-in-from-bottom-3 duration-700">
            Enforma
          </p>
          <h1 className="mt-4 max-w-xl font-heading text-3xl leading-tight tracking-tight text-white sm:text-4xl animate-in fade-in slide-in-from-bottom-3 duration-700 delay-150">
            Gimnasio, profesores y alumnos — con agenda de verdad.
          </h1>
          <p className="mt-4 max-w-lg text-base text-white/85 sm:text-lg animate-in fade-in slide-in-from-bottom-3 duration-700 delay-300">
            Enforma sirve para administrar el día a día de un gimnasio o estudio
            de pilates: sucursales, turnos con cupo, profesores, alumnos, planes
            de entrenamiento y cobro de cuotas — sin planillas.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 animate-in fade-in slide-in-from-bottom-3 duration-700 delay-500">
            <DemoRequestButton />
            <Link
              href="#caracteristicas"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/40 bg-white/10 px-5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/18"
            >
              Ver características
            </Link>
          </div>
        </div>
      </section>

      <main>
        <section className="border-t border-foreground/8">
          <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-14 sm:py-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <p className="text-sm font-medium tracking-wide text-primary uppercase">
                Para qué sirve
              </p>
              <h2 className="mt-3 font-heading text-3xl tracking-tight italic sm:text-4xl">
                Del turno de ahora al cobro de la cuota.
              </h2>
              <p className="mt-4 max-w-xl text-muted-foreground">
                Reemplaza WhatsApp, Excel y agendas sueltas. El estudio arma
                sedes y cupos, el profesor marca asistencia y carga planes, y el
                alumno ve cuándo entrena, avisa si no va y sigue su plan.
              </p>
            </div>
            <div className="lg:justify-self-end">
              <DemoRequestButton />
            </div>
          </div>
        </section>

        <section
          id="caracteristicas"
          className="scroll-mt-16 border-t border-foreground/8"
        >
          {AUDIENCES.map((audience, index) => (
            <article
              key={audience.id}
              id={audience.id}
              className="scroll-mt-16 border-b border-foreground/8"
            >
              <div
                className={`mx-auto grid w-full max-w-5xl items-center gap-10 px-4 py-16 sm:py-24 lg:grid-cols-2 lg:gap-16 ${
                  index % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
                }`}
              >
                <div>
                  <p className="text-sm font-medium tracking-wide text-primary uppercase">
                    {audience.eyebrow}
                  </p>
                  <h2 className="mt-3 font-heading text-4xl tracking-tight italic sm:text-5xl">
                    {audience.title}
                  </h2>
                  <p className="mt-4 max-w-md text-muted-foreground">
                    {audience.text}
                  </p>
                  <ul className="mt-8 space-y-5">
                    {audience.points.map((point) => (
                      <li key={point.label} className="flex gap-3">
                        <point.icon className="mt-0.5 size-5 shrink-0 text-primary" />
                        <div>
                          <p className="font-medium">{point.label}</p>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {point.detail}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-muted">
                  <Image
                    src={audience.image}
                    alt={audience.imageAlt}
                    fill
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    className="object-cover"
                  />
                </div>
              </div>
            </article>
          ))}
        </section>
      </main>

      <footer className="border-t border-foreground/8">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground">
          <span className="font-heading text-base italic text-foreground">
            Enforma
          </span>
          <span>Gimnasio · pilates · plan con fecha</span>
        </div>
      </footer>
    </div>
  );
}
