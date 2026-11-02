"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";

type User = {
  id: string;
  username: string;
  role: "admin" | "user";
  createdAt?: string;
};

type LoginFormProps = {
  error: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loginError, setLoginError] = useState("");
  const [userError, setUserError] = useState("");
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
    if (user?.role !== "admin") return;
    fetch("/api/users")
      .then((response) => response.json())
      .then((data) => setUsers(data.users ?? []));
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
          </section>
        ) : (
          <section className="welcome-panel">
            <span className="welcome-icon">✓</span>
            <div>
              <h2>Dein Zugang ist aktiv</h2>
              <p className="muted">
                Die AboShare-Verwaltung steht dir zur Verfügung.
              </p>
            </div>
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
