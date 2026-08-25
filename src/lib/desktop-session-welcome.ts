export const DESKTOP_WELCOME_STORAGE_PREFIX = "neuronex:desktop-entry-welcome";

const DESKTOP_WELCOME_PENDING_PREFIX = "pending:";
const DESKTOP_WELCOME_SEEN_PREFIX = "seen:";

type SessionStorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export const DESKTOP_WELCOME_TEMPLATES = [
  "Bem-vindo de volta, {name}.",
  "Que bom ter você aqui, {name}.",
  "Seu espaço está pronto, {name}.",
  "Vamos cuidar do essencial, {name}.",
  "Um novo dia começa, {name}.",
  "Sua rotina clínica espera por você, {name}.",
  "Respire. Estamos de volta, {name}.",
  "Tudo pronto para hoje, {name}.",
  "Bom reencontrar você, {name}.",
  "Seu consultório digital está pronto, {name}.",
  "Clareza para o dia, {name}.",
  "Vamos organizar o cuidado, {name}.",
  "Presença para o que importa, {name}.",
  "O dia está começando, {name}.",
  "Seu trabalho continua daqui, {name}.",
  "Bem-vindo ao seu espaço, {name}.",
  "Cuidar começa com clareza, {name}.",
  "Há um dia inteiro pela frente, {name}.",
  "Vamos preparar um bom dia, {name}.",
  "De volta ao que importa, {name}.",
] as const;

const hashText = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const localDayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const getDesktopWelcomeStorageKey = (userId: string) =>
  `${DESKTOP_WELCOME_STORAGE_PREFIX}:${userId}`;

const createDesktopWelcomeEntryId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const getBrowserSessionStorage = (): SessionStorageLike | null => {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
};

/**
 * Queues a new desktop welcome after a successful professional login. The
 * entry identifier prevents a prior, already dismissed greeting in the same
 * browser tab from suppressing the new login's greeting.
 */
export const queueDesktopWelcomeForLogin = (
  userId: string,
  storage: SessionStorageLike | null = getBrowserSessionStorage(),
) => {
  if (!storage) return null;

  const entryId = createDesktopWelcomeEntryId();
  storage.setItem(
    getDesktopWelcomeStorageKey(userId),
    `${DESKTOP_WELCOME_PENDING_PREFIX}${entryId}`,
  );
  return entryId;
};

/**
 * Claims the greeting for the current desktop app entry. A missing or legacy
 * marker is intentionally treated as a fresh entry, so users receive the
 * welcome once after this feature ships. A current "seen" marker prevents it
 * from appearing again during internal navigation.
 */
export const claimDesktopWelcomeForEntry = (
  userId: string,
  storage: SessionStorageLike | null = getBrowserSessionStorage(),
) => {
  if (!storage) return null;

  const storageKey = getDesktopWelcomeStorageKey(userId);
  const storedValue = storage.getItem(storageKey);

  if (storedValue?.startsWith(DESKTOP_WELCOME_SEEN_PREFIX)) return null;

  const pendingEntryId = storedValue?.startsWith(DESKTOP_WELCOME_PENDING_PREFIX)
    ? storedValue.slice(DESKTOP_WELCOME_PENDING_PREFIX.length)
    : "initial-entry";
  const entryId = pendingEntryId || "initial-entry";

  storage.setItem(storageKey, `${DESKTOP_WELCOME_SEEN_PREFIX}${entryId}`);
  return entryId;
};

export const getDailyDesktopWelcomeMessage = ({
  userId,
  firstName,
  date = new Date(),
}: {
  userId: string;
  firstName: string;
  date?: Date;
}) => {
  const normalizedName = firstName.trim() || "profissional";
  const index = hashText(`${userId}:${localDayKey(date)}`) % DESKTOP_WELCOME_TEMPLATES.length;
  return DESKTOP_WELCOME_TEMPLATES[index].replace("{name}", normalizedName);
};
