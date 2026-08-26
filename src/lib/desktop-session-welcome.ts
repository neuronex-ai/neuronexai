export const DESKTOP_WELCOME_STORAGE_PREFIX = "neuronex:desktop-entry-welcome";

const DESKTOP_WELCOME_PENDING_PREFIX = "pending:";
const DESKTOP_WELCOME_SEEN_PREFIX = "seen:";

type SessionStorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export const DESKTOP_WELCOME_TEMPLATES = [
  "A agenda abriu para você.",
  "Ah, {nome}. Bem-vindo de volta.",
  "Algo novo no prontuário.",
  "Amanhã, um dia mais leve.",
  "Ao que importa.",
  "Aqui com você.",
  "Bora pro que importa.",
  "Já deu uma olhada na agenda?",
  "Já pegou seu café?",
  "Lembrete: anotação pendente.",
  "NeuroVision atualizou o caso.",
  "O cuidado começa agora.",
  "O que vamos explorar?",
  "Ouvindo, {nome}.",
  "Paciente das 14h confirmou.",
  "Pode começar quando quiser.",
  "Quer que eu abra o prontuário?",
  "Seu dia está pronto.",
  "Sua clínica já te ouve.",
  "Tudo certo por aí?",
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

export const resolveDesktopWelcomeTemplate = (
  template: string,
  firstName: string,
) => {
  const normalizedName = firstName.trim().split(/\s+/u)[0] || "profissional";

  return template
    .replace(/\{(?:nome|name)\}/giu, normalizedName)
    .replace(/\bnome\b/giu, normalizedName);
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
  const index = getDailyDesktopWelcomeIndex({ userId, date });
  return resolveDesktopWelcomeTemplate(DESKTOP_WELCOME_TEMPLATES[index], firstName);
};

export const getDailyDesktopWelcomeIndex = ({
  userId,
  date = new Date(),
}: {
  userId: string;
  date?: Date;
}) => hashText(`${userId}:${localDayKey(date)}`) % DESKTOP_WELCOME_TEMPLATES.length;
