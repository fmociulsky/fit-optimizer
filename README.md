# Enforma

Aplicación web para quien va al gimnasio y quiere un plan con fecha, no una rutina genérica.

1. Cuentas edad, peso, altura, antecedentes, material y días reales.
2. Eliges un objetivo a **corto** (6 semanas), **mediano** (16) o **largo** (36) plazo.
3. Enforma arma un plan semanal y, cada semana, pide un check-in para reajustar volumen, intensidad o cardio.

Los datos viven en el navegador (`localStorage`). No hay cuenta ni servidor. No sustituye consejo médico.

## Cómo arrancarla

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — desarrollo
- `npm run build` — build de producción
- `npm start` — servir el build
- `npm run lint` — ESLint

## Qué hay en esta versión

- Onboarding en 5 pasos (perfil, cuerpo, salud, entrenamiento, objetivo)
- Plan generado según experiencia, material (gimnasio / mancuernas / peso corporal) y antecedentes
- Sesión de hoy, semana completa y registro de esfuerzo
- Check-in semanal (peso, energía, sueño, sesiones, dolor) con reajuste automático
- Gráfico de peso e historial de cambios del plan
