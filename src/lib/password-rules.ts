export const PASSWORD_HINT =
  "Mínimo 8 caracteres, con letras y números.";

export function passwordClientError(raw: string): string | null {
  if (raw.length < 8) {
    return "La contraseña tiene que tener al menos 8 caracteres.";
  }
  if (raw.length > 72) return "La contraseña es demasiado larga.";
  if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(raw) || !/\d/.test(raw)) {
    return "La contraseña tiene que incluir letras y números.";
  }
  return null;
}
