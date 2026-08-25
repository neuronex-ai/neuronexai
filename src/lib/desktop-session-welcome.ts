export const DESKTOP_WELCOME_STORAGE_PREFIX = "neuronex:desktop-entry-welcome";

const DESKTOP_WELCOME_PENDING_PREFIX = "pending:";
const DESKTOP_WELCOME_SEEN_PREFIX = "seen:";

type SessionStorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export const DESKTOP_WELCOME_TEMPLATES = [
  "Bem-vindo de volta, {name}.",
  "Já posso te ouvir, {name}.",
  "Sua clínica acordou, {name}.",
  "Tudo pronto, {name}.",
  "Vamos começar, {name}.",
  "O dia chama, {name}.",
  "Te escuto, {name}.",
  "Estou com você, {name}.",
  "Seu espaço respira, {name}.",
  "Sua agenda espera, {name}.",
  "O cuidado começa, {name}.",
  "Seu consultório desperta, {name}.",
  "Pronto para hoje, {name}.",
  "Vamos cuidar, {name}.",
  "Aqui com você, {name}.",
  "Sua clínica responde, {name}.",
  "Ouvindo você, {name}.",
  "Hora de começar, {name}.",
  "Seu dia está pronto, {name}.",
  "Vamos ao essencial, {name}.",
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
 * Claims the greeting that was explicitly queued by a successful login. Once
 * claimed, navigation inside the desktop app cannot present the same greeting
 * again.
 */
export const claimDesktopWelcomeForEntry = (
  userId: string,
  storage: SessionStorageLike | null = getBrowserSessionStorage(),
) => {
  if (!storage) return null;

  const storageKey = getDesktopWelcomeStorageKey(userId);
  const storedValue = storage.getItem(storageKey);

  if (!storedValue?.startsWith(DESKTOP_WELCOME_PENDING_PREFIX)) return null;

  const entryId = storedValue.slice(DESKTOP_WELCOME_PENDING_PREFIX.length);
  if (!entryId) return null;

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
