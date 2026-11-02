import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const SESSION_COOKIE = "aboshare_session";
const SESSION_DURATION = 1000 * 60 * 60 * 24 * 7;
const dataPath = path.join(process.cwd(), "data", "users.json");
type StoredUser = {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
};
type StoredSession = { token: string; userId: string; expiresAt: number };
export type SubscriptionAssignment = { userId: string; price: number };
export type StoredSubscription = {
  id: string;
  name: string;
  assignments: SubscriptionAssignment[];
  createdAt: string;
};
type UserStore = {
  users: StoredUser[];
  sessions: StoredSession[];
  subscriptions: StoredSubscription[];
};
export type AuthUser = { id: string; username: string; role: "admin" | "user" };

function adminUsername() {
  return process.env.ADMIN_USERNAME?.trim() || "admin";
}
function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
async function writeStore(store: UserStore) {
  await mkdir(path.dirname(dataPath), { recursive: true });
  await writeFile(dataPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}
async function readStore(): Promise<UserStore> {
  await mkdir(path.dirname(dataPath), { recursive: true });
  try {
    const store = JSON.parse(
      await readFile(dataPath, "utf8"),
    ) as Partial<UserStore>;
    return {
      users: store.users ?? [],
      sessions: store.sessions ?? [],
      subscriptions: store.subscriptions ?? [],
    };
  } catch {
    const emptyStore: UserStore = {
      users: [],
      sessions: [],
      subscriptions: [],
    };
    await writeStore(emptyStore);
    return emptyStore;
  }
}
function toAuthUser(user: StoredUser, role: AuthUser["role"]): AuthUser {
  return { id: user.id, username: user.username, role };
}

export async function authenticate(username: string, password: string) {
  const store = await readStore();
  const normalizedUsername = username.trim();
  const isAdmin = normalizedUsername === adminUsername();
  const valid = isAdmin
    ? Boolean(process.env.ADMIN_PASSWORD) &&
      password === process.env.ADMIN_PASSWORD
    : store.users.some(
        (user) =>
          user.username === normalizedUsername &&
          verifyPassword(password, user.passwordHash),
      );
  if (!valid) return null;
  const user = isAdmin
    ? {
        id: "admin",
        username: adminUsername(),
        passwordHash: "",
        createdAt: "",
      }
    : store.users.find(
        (candidate) => candidate.username === normalizedUsername,
      )!;
  const session = {
    token: randomBytes(32).toString("hex"),
    userId: user.id,
    expiresAt: Date.now() + SESSION_DURATION,
  };
  store.sessions = store.sessions.filter(
    (candidate) => candidate.expiresAt > Date.now(),
  );
  store.sessions.push(session);
  await writeStore(store);
  return {
    token: session.token,
    user: toAuthUser(user, isAdmin ? "admin" : "user"),
  };
}
export async function getUserForSession(token: string | undefined) {
  if (!token) return null;
  const store = await readStore();
  const session = store.sessions.find(
    (candidate) =>
      candidate.token === token && candidate.expiresAt > Date.now(),
  );
  if (!session) return null;
  if (session.userId === "admin")
    return { id: "admin", username: adminUsername(), role: "admin" as const };
  const user = store.users.find((candidate) => candidate.id === session.userId);
  return user ? toAuthUser(user, "user") : null;
}
export async function deleteSession(token: string | undefined) {
  if (!token) return;
  const store = await readStore();
  store.sessions = store.sessions.filter((session) => session.token !== token);
  await writeStore(store);
}
export async function createUser(username: string, password: string) {
  const store = await readStore();
  const normalizedUsername = username.trim();
  if (!normalizedUsername || normalizedUsername === adminUsername())
    throw new Error("Dieser Benutzername ist nicht verfügbar.");
  if (password.length < 8)
    throw new Error("Das Passwort muss mindestens 8 Zeichen haben.");
  if (store.users.some((user) => user.username === normalizedUsername))
    throw new Error("Dieser Benutzername existiert bereits.");
  store.users.push({
    id: randomUUID(),
    username: normalizedUsername,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  });
  await writeStore(store);
}
export async function listUsers() {
  const store = await readStore();
  return store.users.map(({ id, username, createdAt }) => ({
    id,
    username,
    createdAt,
  }));
}

export async function listSubscriptions(userId?: string) {
  const store = await readStore();
  return store.subscriptions
    .filter(
      (subscription) =>
        !userId ||
        subscription.assignments.some(
          (assignment) => assignment.userId === userId,
        ),
    )
    .map((subscription) => ({
      id: subscription.id,
      name: subscription.name,
      createdAt: subscription.createdAt,
      assignments: subscription.assignments
        .filter((assignment) => !userId || assignment.userId === userId)
        .map((assignment) => ({
          userId: assignment.userId,
          username:
            store.users.find((candidate) => candidate.id === assignment.userId)
              ?.username ?? "Unbekannt",
          price: assignment.price,
        })),
    }));
}

export async function createSubscription(name: string) {
  const store = await readStore();
  const normalizedName = name.trim();
  if (!normalizedName)
    throw new Error("Bitte gib einen Namen für das Abo ein.");
  if (
    store.subscriptions.some(
      (subscription) =>
        subscription.name.toLowerCase() === normalizedName.toLowerCase(),
    )
  ) {
    throw new Error("Dieses Abo existiert bereits.");
  }
  store.subscriptions.push({
    id: randomUUID(),
    name: normalizedName,
    assignments: [],
    createdAt: new Date().toISOString(),
  });
  await writeStore(store);
}

export async function assignSubscription(
  subscriptionId: string,
  userId: string,
  price: number,
) {
  const store = await readStore();
  const subscription = store.subscriptions.find(
    (candidate) => candidate.id === subscriptionId,
  );
  if (!subscription || !store.users.some((user) => user.id === userId))
    throw new Error("Abo oder Nutzer nicht gefunden.");
  if (!Number.isFinite(price) || price < 0)
    throw new Error("Der Preis muss eine positive Zahl sein.");
  const existing = subscription.assignments.find(
    (assignment) => assignment.userId === userId,
  );
  if (existing) existing.price = price;
  else subscription.assignments.push({ userId, price });
  await writeStore(store);
}
