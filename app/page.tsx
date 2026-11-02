"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";

type User = {
  id: string;
  username: string;
  role: "admin" | "user";
  createdAt?: string;
};

type Subscription = {
  id: string;
  name: string;
  assignments: { userId: string; username: string; price: number }[];
};

type LoginFormProps = {
  error: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loginError, setLoginError] = useState("");
  const [userError, setUserError] = useState("");
  const [subscriptionError, setSubscriptionError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data) => {
        setUser(data.user);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.role === "admin") {
      fetch("/api/users")
        .then((response) => response.json())
        .then((data) => setUsers(data.users ?? []));
    }
    fetch("/api/subscriptions")
      .then((response) => response.json())
      .then((data) => setSubscriptions(data.subscriptions ?? []));
  }, [user]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: form.get("username"),
        password: form.get("password"),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setLoginError(data.error);
      return;
    }
    setUser(data.user);
    event.currentTarget.reset();
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUserError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: form.get("username"),
        password: form.get("password"),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setUserError(data.error);
      return;
    }
    setUsers(data.users);
    event.currentTarget.reset();
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setUsers([]);
    setSubscriptions([]);
  }

  async function handleCreateSubscription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubscriptionError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.get("name") }),
    });
    const data = await response.json();
    if (!response.ok) return setSubscriptionError(data.error);
    setSubscriptions(data.subscriptions);
    event.currentTarget.reset();
  }

  async function handleAssignSubscription(
    event: FormEvent<HTMLFormElement>,
    subscriptionId: string,
  ) {
    event.preventDefault();
    setSubscriptionError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/subscriptions/${subscriptionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: form.get("userId"),
        price: form.get("price"),
      }),
    });
    const data = await response.json();
    if (!response.ok) return setSubscriptionError(data.error);
    setSubscriptions(data.subscriptions);
  }

  if (loading) {
    return (
      <main className="screen">
        <div className="loading">Wird geladen ...</div>
      </main>
    );
  }
  if (!user) {
    return (
      <main className="screen">
        <LoginForm error={loginError} onSubmit={handleLogin} />
      </main>
    );
  }

  return (
    <main className="screen dashboard">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">A</span>
          <span>AboShare</span>
        </div>
        <button className="text-button" onClick={handleLogout}>
          Abmelden
        </button>
      </header>
      <section className="content">
        <div className="intro">
          <p className="eyebrow">Persönlicher Bereich</p>
          <h1>Willkommen, {user.username}.</h1>
          <p className="muted">Du bist erfolgreich angemeldet.</p>
        </div>
        {user.role === "admin" ? (
          <section className="admin-panel">
            <div>
              <p className="eyebrow">Administration</p>
              <h2>Nutzerkonten</h2>
              <p className="muted">
                Lege Zugänge für deine AboShare-Nutzer an.
              </p>
            </div>
            <form className="user-form" onSubmit={handleCreateUser}>
              <label>
                Benutzername
                <input name="username" required autoComplete="off" />
              </label>
              <label>
                Passwort
                <input
                  name="password"
                  type="password"
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
              </label>
              <button className="primary-button" type="submit">
                Konto anlegen
              </button>
              {userError && <p className="error">{userError}</p>}
            </form>
            <div className="user-list">
              <div className="list-heading">
                <span>Benutzer</span>
                <span>{users.length} Konten</span>
              </div>
              {users.length === 0 ? (
                <p className="empty">Noch keine Nutzerkonten angelegt.</p>
              ) : (
                users.map((account) => (
                  <div className="user-row" key={account.id}>
                    <span>{account.username}</span>
                    <span className="status">Aktiv</span>
                  </div>
                ))
              )}
            </div>
            <div className="subscription-area">
              <div>
                <p className="eyebrow">Aboverwaltung</p>
                <h2>Abos erstellen</h2>
                <p className="muted">
                  Lege ein Abo an und trage pro Nutzer den individuellen
                  Monatsbeitrag ein.
                </p>
              </div>
              <form
                className="subscription-create"
                onSubmit={handleCreateSubscription}
              >
                <label>
                  Abo-Name
                  <input
                    name="name"
                    placeholder="z. B. Netflix Premium"
                    required
                  />
                </label>
                <button className="primary-button" type="submit">
                  Abo erstellen <span>+</span>
                </button>
              </form>
              {subscriptions.length === 0 ? (
                <p className="empty">Noch keine Abos angelegt.</p>
              ) : (
                <div className="subscription-list">
                  {subscriptions.map((subscription) => (
                    <div className="subscription-card" key={subscription.id}>
                      <div className="subscription-heading">
                        <div className="subscription-title">
                          <span className="subscription-icon">↗</span>
                          <div>
                            <h3>{subscription.name}</h3>
                            <p>Individuelle Nutzerpreise</p>
                          </div>
                        </div>
                        <span className="assignment-count">
                          {subscription.assignments.length} Zuweisungen
                        </span>
                      </div>
                      <form
                        className="assign-form"
                        onSubmit={(event) =>
                          handleAssignSubscription(event, subscription.id)
                        }
                      >
                        <label>
                          Nutzer
                          <select name="userId" required defaultValue="">
                            <option value="" disabled>
                              {" "}
                              Nutzer auswählen{" "}
                            </option>
                            {users.map((account) => (
                              <option value={account.id} key={account.id}>
                                {account.username}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Preis / Monat
                          <input
                            name="price"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0,00"
                            required
                          />
                        </label>
                        <button className="secondary-button" type="submit">
                          Zuweisen
                        </button>
                      </form>
                      {subscription.assignments.length > 0 && (
                        <div className="assignment-list">
                          {subscription.assignments.map((assignment) => (
                            <div
                              className="assignment-row"
                              key={assignment.userId}
                            >
                              <span>{assignment.username}</span>
                              <strong>
                                {assignment.price.toFixed(2).replace(".", ",")}{" "}
                                € / Monat
                              </strong>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {subscriptionError && (
                <p className="error">{subscriptionError}</p>
              )}
            </div>
          </section>
        ) : (
          <section className="member-area">
            <div className="welcome-panel">
              <span className="welcome-icon">✦</span>
              <div>
                <h2>Deine Abos</h2>
                <p className="muted">
                  Hier findest du deine persönlichen Monatsbeiträge.
                </p>
              </div>
            </div>
            {subscriptions.length === 0 ? (
              <p className="empty member-empty">
                Dir wurde noch kein Abo zugewiesen.
              </p>
            ) : (
              <div className="member-subscriptions">
                {subscriptions.map((subscription) => (
                  <div className="member-subscription" key={subscription.id}>
                    <div className="member-subscription-name">
                      <span className="subscription-icon">↗</span>
                      <span>{subscription.name}</span>
                    </div>
                    <strong>
                      {subscription.assignments[0]?.price
                        .toFixed(2)
                        .replace(".", ",")}{" "}
                      € <small>/ Monat</small>
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  );
}

function LoginForm({ error, onSubmit }: LoginFormProps) {
  return (
    <section className="login-card">
      <div className="brand">
        <span className="brand-mark">A</span>
        <span>AboShare</span>
      </div>
      <p className="eyebrow">Mitgliederbereich</p>
      <h1>Schön, dich zu sehen.</h1>
      <p className="muted">Melde dich an, um fortzufahren.</p>
      <form onSubmit={onSubmit}>
        <label>
          Benutzername
          <input name="username" required autoComplete="username" />
        </label>
        <label>
          Passwort
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </label>
        <button className="primary-button" type="submit">
          Anmelden <span>→</span>
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </section>
  );
}
