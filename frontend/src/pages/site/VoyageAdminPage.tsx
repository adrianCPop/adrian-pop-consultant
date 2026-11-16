import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { Copy, KeyRound, Loader2, LogOut, PauseCircle, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatCoord } from "@/lib/geo";
import { useCrewOnlyPage } from "@/lib/useCrewOnlyPage";
import {
  adminLogin,
  adminLogout,
  ApiError,
  createKey,
  deleteEntry,
  deletePosition,
  deletePositionsInPeriod,
  fetchAdminState,
  revokeKey,
  saveSettings,
  setFrozen,
  type AdminState,
  type VoyageSettings,
} from "@/lib/voyageApi";
import { cn } from "@/lib/utils";

/** Shore-side controls for the voyage page. The only part of it behind a password. */

const TOKEN_STORE = "voyage-admin-token";

interface SettingsForm {
  eyebrow: string;
  boatName: string;
  originName: string;
  originLat: string;
  originLon: string;
  destinationName: string;
  destinationLat: string;
  destinationLon: string;
  departure: string;
  arrived: string;
  route: string;
}

/** Shown as a starting point until the real voyage is saved. Nothing here is public. */
const SUGGESTED: SettingsForm = {
  eyebrow: "Atlantic crossing · 2026",
  boatName: "",
  originName: "Las Palmas",
  originLat: "28.13",
  originLon: "-15.43",
  destinationName: "Saint Lucia",
  destinationLat: "14.08",
  destinationLon: "-60.95",
  departure: "",
  arrived: "",
  route: ["28.13, -15.43", "25.5, -18.5", "22.5, -23.0", "20.5, -28.0", "19.0, -34.0", "17.8, -41.0", "16.6, -48.0", "15.4, -55.0", "14.08, -60.95"].join("\n"),
};

/** ISO time to the value of a datetime-local field, kept in UTC. */
const toField = (iso: string | null) => (iso ? iso.slice(0, 16) : "");
const fromField = (value: string) => (value ? `${value}:00Z` : null);

const toForm = (settings: VoyageSettings): SettingsForm => ({
  eyebrow: settings.eyebrow,
  boatName: settings.boat_name,
  originName: settings.origin.name,
  originLat: String(settings.origin.lat),
  originLon: String(settings.origin.lon),
  destinationName: settings.destination.name,
  destinationLat: String(settings.destination.lat),
  destinationLon: String(settings.destination.lon),
  departure: toField(settings.departure),
  arrived: toField(settings.arrived_at),
  route: settings.planned_route.map(([lat, lon]) => `${lat}, ${lon}`).join("\n"),
});

const fromForm = (form: SettingsForm): VoyageSettings | string => {
  const numbers = [form.originLat, form.originLon, form.destinationLat, form.destinationLon].map(Number);
  if (numbers.some((value) => Number.isNaN(value))) {
    return "Latitude and longitude have to be numbers, for example 28.13 and -15.43";
  }
  const route: [number, number][] = [];
  for (const line of form.route.split("\n").map((text) => text.trim()).filter(Boolean)) {
    const parts = line.split(/[,;\s]+/).map(Number);
    if (parts.length !== 2 || parts.some((value) => Number.isNaN(value))) {
      return `Route line "${line}" should be a latitude and a longitude, for example 22.5, -23.0`;
    }
    route.push([parts[0], parts[1]]);
  }

  return {
    eyebrow: form.eyebrow,
    boat_name: form.boatName,
    origin: { name: form.originName, lat: numbers[0], lon: numbers[1] },
    destination: { name: form.destinationName, lat: numbers[2], lon: numbers[3] },
    departure: fromField(form.departure),
    arrived_at: fromField(form.arrived),
    planned_route: route,
  };
};

const when = (iso: string | null) =>
  iso
    ? `${new Intl.DateTimeFormat("en-GB", {
        timeZone: "UTC",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(iso))} UTC`
    : "never";

const Panel = ({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) => (
  <section className="panel-soft rounded-2xl p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
      {aside}
    </div>
    {children}
  </section>
);

const Field = ({ id, label, children }: { id: string; label: string; children: ReactNode }) => (
  <div className="space-y-1.5">
    <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
      {label}
    </Label>
    {children}
  </div>
);

const inputClass = "h-10 rounded-xl border-border/80 bg-secondary/50";

const VoyageAdminPage = () => {
  const [token, setToken] = useState<string | null>(() => window.sessionStorage.getItem(TOKEN_STORE));
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<AdminState | null>(null);
  const [form, setForm] = useState<SettingsForm>(SUGGESTED);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<"crew" | "tracker">("crew");
  const [issued, setIssued] = useState<{ name: string; kind: string; key: string; qr: string } | null>(null);
  const [period, setPeriod] = useState({ start: "", end: "" });

  useCrewOnlyPage();

  const signOut = useCallback(() => {
    window.sessionStorage.removeItem(TOKEN_STORE);
    setToken(null);
    setState(null);
    setIssued(null);
  }, []);

  /** Run an admin call; a rejected session goes back to the password form. */
  const run = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | null> => {
      try {
        return await action();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          signOut();
          toast.error("Signed out. Enter the password again.");
        } else {
          toast.error(error instanceof ApiError ? error.message : "No connection to the server");
        }
        return null;
      }
    },
    [signOut]
  );

  const refresh = useCallback(
    async (resetForm = false) => {
      if (!token) {
        return;
      }
      const next = await run(() => fetchAdminState(token));
      if (next) {
        setState(next);
        if (resetForm) {
          setForm(next.settings ? toForm(next.settings) : SUGGESTED);
        }
      }
    },
    [token, run]
  );

  useEffect(() => {
    void refresh(true);
  }, [refresh]);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const session = await adminLogin(password);
      window.sessionStorage.setItem(TOKEN_STORE, session.token);
      setToken(session.token);
      setPassword("");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No connection to the server");
    }
    setBusy(false);
  };

  const set = (field: keyof SettingsForm) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const submitSettings = async (event: FormEvent) => {
    event.preventDefault();
    const settings = fromForm(form);
    if (typeof settings === "string") {
      toast.error(settings);
      return;
    }
    if (token && (await run(() => saveSettings(token, settings)))) {
      toast.success("Saved. The public page shows it within a minute.");
      await refresh(true);
    }
  };

  const issueKey = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !newName.trim()) {
      return;
    }
    const created = await run(() => createKey(token, newName.trim(), newKind));
    if (!created) {
      return;
    }
    const link = `${window.location.origin}/voyage/log#k=${created.key}`;
    const qr = created.kind === "crew" ? await QRCode.toDataURL(link, { margin: 1, width: 280 }) : "";
    setIssued({ name: created.name, kind: created.kind, key: created.key, qr });
    setNewName("");
    await refresh();
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy. Select the text and copy it by hand.");
    }
  };

  const confirmThen = async (question: string, action: () => Promise<unknown>) => {
    if (!token || !window.confirm(question)) {
      return;
    }
    if (await run(action)) {
      await refresh();
    }
  };

  const deletePeriod = async (event: FormEvent) => {
    event.preventDefault();
    const start = fromField(period.start);
    const end = fromField(period.end);
    if (!token || !start || !end) {
      toast.error("Fill in both times");
      return;
    }
    if (!window.confirm("Delete every position recorded in this period? This cannot be undone.")) {
      return;
    }
    const answer = await run(() => deletePositionsInPeriod(token, start, end));
    if (answer) {
      toast.success(`Deleted ${answer.deleted} ${answer.deleted === 1 ? "position" : "positions"}`);
      await refresh();
    }
  };

  if (!token) {
    return (
      <div className="mx-auto w-full max-w-sm px-4 py-12 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Voyage</p>
        <h1 className="mt-2 font-heading text-3xl font-semibold">Shore controls</h1>
        <form onSubmit={signIn} className="panel-soft mt-6 rounded-2xl p-5">
          <Field id="admin-password" label="Password">
            <Input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
            />
          </Field>
          <Button type="submit" disabled={busy || !password} className="mt-4 h-11 w-full rounded-xl font-semibold">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
          </Button>
        </form>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading
      </div>
    );
  }

  const lastFix = state.positions.last[0] ?? null;
  const issuedLink = issued ? `${window.location.origin}/voyage/log#k=${issued.key}` : "";
  const trackerUrl = `${window.location.origin}/api/voyage/track`;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Voyage</p>
          <h1 className="mt-2 font-heading text-3xl font-semibold">Shore controls</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link to="/voyage" className="font-semibold text-primary hover:underline">
              Open the public page
            </Link>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-lg" onClick={() => void refresh()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() => {
              void adminLogout(token).catch(() => undefined);
              signOut();
            }}
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            Sign out
          </Button>
        </div>
      </header>

      <section
        className={cn(
          "rounded-2xl border p-5 sm:p-6",
          state.frozen ? "border-amber-400/50 bg-amber-400/10" : "panel-soft"
        )}
      >
        <div className="flex items-start gap-4">
          <PauseCircle className={cn("mt-0.5 h-5 w-5 shrink-0", state.frozen ? "text-amber-300" : "text-primary")} />
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-lg font-semibold text-foreground">
              {state.frozen ? "Writing is paused" : "Pause all writing"}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Emergency switch. While it is on, nobody can add entries, photos or positions, not
              even with a valid link. The public page stays up. Entries written on board wait on
              the devices and are sent after you switch it off.
            </p>
          </div>
          <Switch
            aria-label="Pause all writing"
            checked={state.frozen}
            onCheckedChange={(on) =>
              void confirmThen(
                on ? "Pause all writing to the voyage page?" : "Allow writing again?",
                () => setFrozen(token, on)
              )
            }
          />
        </div>
      </section>

      <Panel title="What has arrived">
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          {[
            ["Positions received", state.positions.total],
            ["Positions on the map", state.positions.public_total],
            ["Log entries", state.entries.length],
            ["Photos", state.photos.count],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs uppercase tracking-[0.1em] text-muted-foreground">{label}</dt>
              <dd className="mt-1 font-heading text-2xl font-semibold tabular-nums text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-muted-foreground">
          {lastFix
            ? `Latest position: ${formatCoord([lastFix.lat, lastFix.lon])}, ${when(lastFix.time)}, from ${lastFix.by}.`
            : "No position has arrived yet."}{" "}
          Positions dated before the departure time are stored but never shown, so the tracker can
          be tested at home.
        </p>
      </Panel>

      <Panel title="The voyage">
        {!state.settings ? (
          <p className="mt-2 text-sm text-amber-200">
            Not saved yet, so the public page shows nothing. The values below are only a
            suggestion: correct them and save.
          </p>
        ) : null}
        <form onSubmit={submitSettings} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="eyebrow" label="Small heading">
              <Input id="eyebrow" value={form.eyebrow} onChange={set("eyebrow")} maxLength={80} className={inputClass} />
            </Field>
            <Field id="boat" label="Boat (name, type)">
              <Input id="boat" value={form.boatName} onChange={set("boatName")} maxLength={80} className={inputClass} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
            <Field id="origin-name" label="From">
              <Input id="origin-name" value={form.originName} onChange={set("originName")} required maxLength={60} className={inputClass} />
            </Field>
            <Field id="origin-lat" label="Latitude">
              <Input id="origin-lat" value={form.originLat} onChange={set("originLat")} required inputMode="decimal" className={inputClass} />
            </Field>
            <Field id="origin-lon" label="Longitude">
              <Input id="origin-lon" value={form.originLon} onChange={set("originLon")} required inputMode="decimal" className={inputClass} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
            <Field id="destination-name" label="To">
              <Input id="destination-name" value={form.destinationName} onChange={set("destinationName")} required maxLength={60} className={inputClass} />
            </Field>
            <Field id="destination-lat" label="Latitude">
              <Input id="destination-lat" value={form.destinationLat} onChange={set("destinationLat")} required inputMode="decimal" className={inputClass} />
            </Field>
            <Field id="destination-lon" label="Longitude">
              <Input id="destination-lon" value={form.destinationLon} onChange={set("destinationLon")} required inputMode="decimal" className={inputClass} />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            South and west are negative: Las Palmas is 28.13, -15.43.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="departure" label="Departure (UTC)">
              <Input id="departure" type="datetime-local" value={form.departure} onChange={set("departure")} className={inputClass} />
            </Field>
            <Field id="arrived" label="Arrival (UTC), when it happens">
              <div className="flex gap-2">
                <Input id="arrived" type="datetime-local" value={form.arrived} onChange={set("arrived")} className={inputClass} />
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 shrink-0 rounded-xl"
                  onClick={() => setForm((current) => ({ ...current, arrived: new Date().toISOString().slice(0, 16) }))}
                >
                  Now
                </Button>
              </div>
            </Field>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            The track becomes public from the departure time. After the arrival time, new
            positions are no longer shown.
          </p>
          <Field id="route" label="Planned route, one latitude, longitude per line">
            <Textarea id="route" value={form.route} onChange={set("route")} rows={6} spellCheck={false} className="rounded-xl border-border/80 bg-secondary/50 font-mono text-xs" />
          </Field>
          <Button type="submit" className="h-11 rounded-xl px-6 font-semibold">
            Save the voyage
          </Button>
        </form>
      </Panel>

      <Panel title="Links for the crew and the tracker">
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          A link is the whole key: whoever has it can write as that person. Send each one
          privately. If one leaks or a device is lost, switch that link off and make a new one.
        </p>

        <form onSubmit={issueKey} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[10rem] flex-1">
            <Field id="new-name" label="Name">
              <Input id="new-name" value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={40} placeholder="Ioana" className={inputClass} />
            </Field>
          </div>
          <Field id="new-kind" label="For">
            <select
              id="new-kind"
              value={newKind}
              onChange={(event) => setNewKind(event.target.value as "crew" | "tracker")}
              className="h-10 rounded-xl border border-border/80 bg-secondary/50 px-3 text-sm text-foreground"
            >
              <option value="crew">A person (log and photos)</option>
              <option value="tracker">The tracking app (positions only)</option>
            </select>
          </Field>
          <Button type="submit" disabled={!newName.trim()} className="h-10 rounded-xl font-semibold">
            <KeyRound className="mr-2 h-4 w-4" />
            Make a link
          </Button>
        </form>

        {issued ? (
          <div className="mt-5 rounded-xl border border-primary/50 bg-primary/5 p-4">
            <p className="font-heading text-base font-semibold text-foreground">
              {issued.kind === "crew" ? `Link for ${issued.name}` : `Tracker key: ${issued.name}`}
            </p>
            <p className="mt-1 text-xs text-amber-200">
              Shown only now. It is not stored anywhere readable, so copy it before leaving this page.
            </p>
            {issued.kind === "crew" ? (
              <div className="mt-4 flex flex-wrap items-start gap-4">
                <img src={issued.qr} alt={`QR code with the link for ${issued.name}`} className="h-40 w-40 rounded-lg bg-white p-1" />
                <div className="min-w-0 flex-1 space-y-3">
                  <p className="break-all rounded-lg bg-secondary/60 p-3 font-mono text-xs text-foreground">{issuedLink}</p>
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => void copy(issuedLink)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy the link
                  </Button>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {issued.name} opens it once on each device (or scans the code), then adds the
                    page to the home screen.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3 text-sm">
                <p className="leading-relaxed text-muted-foreground">
                  In the OwnTracks app choose HTTP mode and enter these. Under Identification,
                  the username can be anything; the password is the key.
                </p>
                {[
                  ["Address", trackerUrl],
                  ["Username", "boat"],
                  ["Password", issued.key],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-wrap items-center gap-2">
                    <span className="w-20 text-xs uppercase tracking-[0.1em] text-muted-foreground">{label}</span>
                    <code className="min-w-0 flex-1 break-all rounded-lg bg-secondary/60 px-3 py-2 text-xs text-foreground">{value}</code>
                    <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => void copy(value)} aria-label={`Copy ${label.toLowerCase()}`}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {state.keys.length > 0 ? (
          <ul className="mt-5 divide-y divide-border/60">
            {state.keys.map((key) => (
              <li key={key.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-semibold", key.revoked_at ? "text-muted-foreground line-through" : "text-foreground")}>
                    {key.name}
                    <span className="ml-2 text-xs font-normal text-muted-foreground no-underline">
                      {key.kind === "crew" ? "person" : "tracker"}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {key.revoked_at ? `Switched off ${when(key.revoked_at)}` : `Last used: ${when(key.last_used_at)}`}
                  </p>
                </div>
                {!key.revoked_at ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    onClick={() =>
                      void confirmThen(`Switch off the link for ${key.name}? This cannot be undone.`, () => revokeKey(token, key.id))
                    }
                  >
                    Switch off
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 text-sm text-muted-foreground">No links yet.</p>
        )}
      </Panel>

      <Panel title="Log entries">
        {state.entries.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60">
            {state.entries.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{entry.title || "Untitled"}</p>
                  <p className="text-xs text-muted-foreground">
                    {when(entry.time)} · {entry.author}
                    {entry.photo_count > 0 ? ` · ${entry.photo_count} ${entry.photo_count === 1 ? "photo" : "photos"}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Delete entry ${entry.title}`}
                  onClick={() =>
                    void confirmThen(`Delete "${entry.title || "this entry"}" and its photos for good?`, () => deleteEntry(token, entry.id))
                  }
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Latest positions">
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Every position that arrives is kept. The public map leaves out any the boat could not
          have reached; delete wrong ones here, one by one or for a whole period.
        </p>
        <form onSubmit={deletePeriod} className="mt-4 flex flex-wrap items-end gap-3">
          <Field id="period-start" label="From (UTC)">
            <Input
              id="period-start"
              type="datetime-local"
              value={period.start}
              onChange={(event) => setPeriod((current) => ({ ...current, start: event.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field id="period-end" label="To (UTC)">
            <Input
              id="period-end"
              type="datetime-local"
              value={period.end}
              onChange={(event) => setPeriod((current) => ({ ...current, end: event.target.value }))}
              className={inputClass}
            />
          </Field>
          <Button type="submit" variant="outline" disabled={!period.start || !period.end} className="h-10 rounded-xl">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete this period
          </Button>
        </form>
        {state.positions.last.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60">
            {state.positions.last.map((fix) => (
              <li key={fix.id} className="flex items-center gap-3 py-2">
                <p className="min-w-0 flex-1 text-sm tabular-nums text-foreground">
                  {formatCoord([fix.lat, fix.lon])}
                  <span className="ml-3 text-xs text-muted-foreground">
                    {when(fix.time)} · {fix.by} · {fix.src}
                  </span>
                </p>
                <button
                  type="button"
                  aria-label="Delete this position"
                  onClick={() => void confirmThen("Delete this position?", () => deletePosition(token, fix.id))}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
};

export default VoyageAdminPage;
