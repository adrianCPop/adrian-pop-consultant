import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { Copy, KeyRound, Loader2, LogOut, PauseCircle, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import VoyageLanguageSwitch from "@/components/voyage/VoyageLanguageSwitch";
import { CREW_LANGUAGES } from "@/lib/voyageI18n";
import { useCrewOnlyPage } from "@/lib/useCrewOnlyPage";
import { useVoyageTexts } from "@/lib/useVoyageTexts";
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
import type { VoyageTexts } from "@/lib/voyageI18n";
import { cn } from "@/lib/utils";

/** Shore-side controls for the voyage page. The only part of it behind a password. */

const TOKEN_STORE = "voyage-admin-token";

interface SettingsForm {
  eyebrow: string;
  eyebrowRo: string;
  boatName: string;
  originName: string;
  originNameRo: string;
  originLat: string;
  originLon: string;
  destinationName: string;
  destinationNameRo: string;
  destinationLat: string;
  destinationLon: string;
  departure: string;
  arrived: string;
  route: string;
}

/** Shown as a starting point until the real voyage is saved. Nothing here is public. */
const SUGGESTED: SettingsForm = {
  eyebrow: "Atlantic crossing · 2026",
  eyebrowRo: "Traversarea Atlanticului · 2026",
  boatName: "",
  originName: "Las Palmas",
  originNameRo: "",
  originLat: "28.13",
  originLon: "-15.43",
  destinationName: "Saint Lucia",
  destinationNameRo: "Sfânta Lucia",
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
  eyebrowRo: settings.eyebrow_ro ?? "",
  boatName: settings.boat_name,
  originName: settings.origin.name,
  originNameRo: settings.origin.name_ro ?? "",
  originLat: String(settings.origin.lat),
  originLon: String(settings.origin.lon),
  destinationName: settings.destination.name,
  destinationNameRo: settings.destination.name_ro ?? "",
  destinationLat: String(settings.destination.lat),
  destinationLon: String(settings.destination.lon),
  departure: toField(settings.departure),
  arrived: toField(settings.arrived_at),
  route: settings.planned_route.map(([lat, lon]) => `${lat}, ${lon}`).join("\n"),
});

const fromForm = (form: SettingsForm, t: VoyageTexts["t"]): VoyageSettings | string => {
  const numbers = [form.originLat, form.originLon, form.destinationLat, form.destinationLon].map(Number);
  if (numbers.some((value) => Number.isNaN(value))) {
    return t("admin.voyage.badNumbers");
  }
  const route: [number, number][] = [];
  for (const line of form.route.split("\n").map((text) => text.trim()).filter(Boolean)) {
    const parts = line.split(/[,;\s]+/).map(Number);
    if (parts.length !== 2 || parts.some((value) => Number.isNaN(value))) {
      return t("admin.voyage.badRouteLine", { line });
    }
    route.push([parts[0], parts[1]]);
  }

  return {
    eyebrow: form.eyebrow,
    eyebrow_ro: form.eyebrowRo,
    boat_name: form.boatName,
    origin: { name: form.originName, name_ro: form.originNameRo, lat: numbers[0], lon: numbers[1] },
    destination: {
      name: form.destinationName,
      name_ro: form.destinationNameRo,
      lat: numbers[2],
      lon: numbers[3],
    },
    departure: fromField(form.departure),
    arrived_at: fromField(form.arrived),
    planned_route: route,
  };
};

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
  const texts = useVoyageTexts();
  const { t } = texts;
  // Read through a ref by the calls below, so that changing the language does not
  // count as a reason to fetch everything again and reset a half-filled form.
  const textsRef = useRef(texts);
  textsRef.current = texts;
  const when = (iso: string | null) => (iso ? texts.stamp(iso) : t("admin.never"));
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
          toast.error(textsRef.current.t("admin.signedOut"));
        } else {
          toast.error(
            error instanceof ApiError
              ? textsRef.current.server(error.message)
              : textsRef.current.t("admin.noConnection")
          );
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
      toast.error(error instanceof ApiError ? texts.server(error.message) : t("admin.noConnection"));
    }
    setBusy(false);
  };

  const set = (field: keyof SettingsForm) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const submitSettings = async (event: FormEvent) => {
    event.preventDefault();
    const settings = fromForm(form, t);
    if (typeof settings === "string") {
      toast.error(settings);
      return;
    }
    if (token && (await run(() => saveSettings(token, settings)))) {
      toast.success(t("admin.saved"));
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
      toast.success(t("admin.copied"));
    } catch {
      toast.error(t("admin.notCopied"));
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
      toast.error(t("admin.positions.bothTimes"));
      return;
    }
    if (!window.confirm(t("admin.positions.confirmPeriod"))) {
      return;
    }
    const answer = await run(() => deletePositionsInPeriod(token, start, end));
    if (answer) {
      toast.success(t("admin.positions.deleted", { count: answer.deleted }));
      await refresh();
    }
  };

  if (!token) {
    return (
      <div lang={texts.htmlLang} className="mx-auto w-full max-w-sm px-4 py-12 sm:py-16">
        <div className="flex items-start justify-between gap-4">
          <p className="pt-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            {t("admin.eyebrow")}
          </p>
          <VoyageLanguageSwitch languages={CREW_LANGUAGES} />
        </div>
        <h1 className="mt-2 font-heading text-3xl font-semibold">{t("admin.title")}</h1>
        <form onSubmit={signIn} className="panel-soft mt-6 rounded-2xl p-5">
          <Field id="admin-password" label={t("admin.password")}>
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
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("admin.signIn")}
          </Button>
        </form>
      </div>
    );
  }

  if (!state) {
    return (
      <div
        lang={texts.htmlLang}
        className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground"
      >
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {t("admin.loading")}
      </div>
    );
  }

  const lastFix = state.positions.last[0] ?? null;
  const issuedLink = issued ? `${window.location.origin}/voyage/log#k=${issued.key}` : "";
  const trackerUrl = `${window.location.origin}/api/voyage/track`;

  return (
    <div
      lang={texts.htmlLang}
      className="mx-auto w-full max-w-4xl space-y-4 px-4 py-8 sm:px-6 sm:py-12"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            {t("admin.eyebrow")}
          </p>
          <h1 className="mt-2 font-heading text-3xl font-semibold">{t("admin.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link to="/voyage" className="font-semibold text-primary hover:underline">
              {t("admin.openPublic")}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <VoyageLanguageSwitch languages={CREW_LANGUAGES} />
          <Button variant="outline" size="sm" className="rounded-lg" onClick={() => void refresh()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            {t("admin.refresh")}
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
            {t("admin.signOut")}
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
              {state.frozen ? t("admin.pause.on") : t("admin.pause.off")}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {t("admin.pause.body")}
            </p>
          </div>
          <Switch
            aria-label={t("admin.pause.off")}
            checked={state.frozen}
            onCheckedChange={(on) =>
              void confirmThen(
                on ? t("admin.pause.confirmOn") : t("admin.pause.confirmOff"),
                () => setFrozen(token, on)
              )
            }
          />
        </div>
      </section>

      <Panel title={t("admin.arrived.title")}>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          {[
            [t("admin.arrived.received"), state.positions.total],
            [t("admin.arrived.onMap"), state.positions.public_total],
            [t("admin.arrived.entries"), state.entries.length],
            [t("admin.arrived.photos"), state.photos.count],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs uppercase tracking-[0.1em] text-muted-foreground">{label}</dt>
              <dd className="mt-1 font-heading text-2xl font-semibold tabular-nums text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-muted-foreground">
          {lastFix
            ? t("admin.arrived.latest", {
                position: texts.coord([lastFix.lat, lastFix.lon]),
                time: when(lastFix.time),
                by: lastFix.by,
              })
            : t("admin.arrived.none")}{" "}
          {t("admin.arrived.note")}
        </p>
      </Panel>

      <Panel title={t("admin.voyage.title")}>
        {!state.settings ? (
          <p className="mt-2 text-sm text-amber-200">
            {t("admin.voyage.notSaved")}
          </p>
        ) : null}
        <form onSubmit={submitSettings} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="eyebrow" label={t("admin.voyage.eyebrow")}>
              <Input id="eyebrow" value={form.eyebrow} onChange={set("eyebrow")} maxLength={80} className={inputClass} />
            </Field>
            <Field id="eyebrow-ro" label={t("admin.voyage.eyebrowRo")}>
              <Input id="eyebrow-ro" lang="ro" value={form.eyebrowRo} onChange={set("eyebrowRo")} maxLength={80} className={inputClass} />
            </Field>
          </div>
          <Field id="boat" label={t("admin.voyage.boat")}>
            <Input id="boat" value={form.boatName} onChange={set("boatName")} maxLength={80} className={inputClass} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[2fr_2fr_1fr_1fr]">
            <Field id="origin-name" label={t("admin.voyage.from")}>
              <Input id="origin-name" value={form.originName} onChange={set("originName")} required maxLength={60} className={inputClass} />
            </Field>
            <Field id="origin-name-ro" label={t("admin.voyage.nameRo")}>
              <Input id="origin-name-ro" lang="ro" value={form.originNameRo} onChange={set("originNameRo")} maxLength={60} className={inputClass} />
            </Field>
            <Field id="origin-lat" label={t("admin.voyage.latitude")}>
              <Input id="origin-lat" value={form.originLat} onChange={set("originLat")} required inputMode="decimal" className={inputClass} />
            </Field>
            <Field id="origin-lon" label={t("admin.voyage.longitude")}>
              <Input id="origin-lon" value={form.originLon} onChange={set("originLon")} required inputMode="decimal" className={inputClass} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-[2fr_2fr_1fr_1fr]">
            <Field id="destination-name" label={t("admin.voyage.to")}>
              <Input id="destination-name" value={form.destinationName} onChange={set("destinationName")} required maxLength={60} className={inputClass} />
            </Field>
            <Field id="destination-name-ro" label={t("admin.voyage.nameRo")}>
              <Input id="destination-name-ro" lang="ro" value={form.destinationNameRo} onChange={set("destinationNameRo")} maxLength={60} className={inputClass} />
            </Field>
            <Field id="destination-lat" label={t("admin.voyage.latitude")}>
              <Input id="destination-lat" value={form.destinationLat} onChange={set("destinationLat")} required inputMode="decimal" className={inputClass} />
            </Field>
            <Field id="destination-lon" label={t("admin.voyage.longitude")}>
              <Input id="destination-lon" value={form.destinationLon} onChange={set("destinationLon")} required inputMode="decimal" className={inputClass} />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">{t("admin.voyage.romanianNote")}</p>
          <p className="text-xs text-muted-foreground">
            {t("admin.voyage.signs")}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="departure" label={t("admin.voyage.departure")}>
              <Input id="departure" type="datetime-local" value={form.departure} onChange={set("departure")} className={inputClass} />
            </Field>
            <Field id="arrived" label={t("admin.voyage.arrival")}>
              <div className="flex gap-2">
                <Input id="arrived" type="datetime-local" value={form.arrived} onChange={set("arrived")} className={inputClass} />
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 shrink-0 rounded-xl"
                  onClick={() => setForm((current) => ({ ...current, arrived: new Date().toISOString().slice(0, 16) }))}
                >
                  {t("admin.voyage.now")}
                </Button>
              </div>
            </Field>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("admin.voyage.datesNote")}
          </p>
          <Field id="route" label={t("admin.voyage.route")}>
            <Textarea id="route" value={form.route} onChange={set("route")} rows={6} spellCheck={false} className="rounded-xl border-border/80 bg-secondary/50 font-mono text-xs" />
          </Field>
          <Button type="submit" className="h-11 rounded-xl px-6 font-semibold">
            {t("admin.voyage.save")}
          </Button>
        </form>
      </Panel>

      <Panel title={t("admin.links.title")}>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("admin.links.body")}
        </p>

        <form onSubmit={issueKey} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[10rem] flex-1">
            <Field id="new-name" label={t("admin.links.name")}>
              <Input id="new-name" value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={40} placeholder="Ioana" className={inputClass} />
            </Field>
          </div>
          <Field id="new-kind" label={t("admin.links.for")}>
            <select
              id="new-kind"
              value={newKind}
              onChange={(event) => setNewKind(event.target.value as "crew" | "tracker")}
              className="h-10 rounded-xl border border-border/80 bg-secondary/50 px-3 text-sm text-foreground"
            >
              <option value="crew">{t("admin.links.person")}</option>
              <option value="tracker">{t("admin.links.tracker")}</option>
            </select>
          </Field>
          <Button type="submit" disabled={!newName.trim()} className="h-10 rounded-xl font-semibold">
            <KeyRound className="mr-2 h-4 w-4" />
            {t("admin.links.make")}
          </Button>
        </form>

        {issued ? (
          <div className="mt-5 rounded-xl border border-primary/50 bg-primary/5 p-4">
            <p className="font-heading text-base font-semibold text-foreground">
              {issued.kind === "crew"
                ? t("admin.links.forName", { name: issued.name })
                : t("admin.links.trackerKey", { name: issued.name })}
            </p>
            <p className="mt-1 text-xs text-amber-200">
              {t("admin.links.shownOnce")}
            </p>
            {issued.kind === "crew" ? (
              <div className="mt-4 flex flex-wrap items-start gap-4">
                <img src={issued.qr} alt={t("admin.links.qr", { name: issued.name })} className="h-40 w-40 rounded-lg bg-white p-1" />
                <div className="min-w-0 flex-1 space-y-3">
                  <p className="break-all rounded-lg bg-secondary/60 p-3 font-mono text-xs text-foreground">{issuedLink}</p>
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => void copy(issuedLink)}>
                    <Copy className="mr-2 h-4 w-4" />
                    {t("admin.links.copy")}
                  </Button>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {t("admin.links.howTo", { name: issued.name })}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3 text-sm">
                <p className="leading-relaxed text-muted-foreground">
                  {t("admin.tracker.howTo")}
                </p>
                {[
                  [t("admin.tracker.address"), trackerUrl],
                  [t("admin.tracker.username"), "boat"],
                  [t("admin.password"), issued.key],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-wrap items-center gap-2">
                    <span className="w-24 text-xs uppercase tracking-[0.1em] text-muted-foreground">{label}</span>
                    <code className="min-w-0 flex-1 break-all rounded-lg bg-secondary/60 px-3 py-2 text-xs text-foreground">{value}</code>
                    <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => void copy(value)} aria-label={t("admin.tracker.copy", { what: label })}>
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
                      {key.kind === "crew" ? t("admin.links.kindPerson") : t("admin.tracker.kind")}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {key.revoked_at
                      ? t("admin.links.switchedOff", { time: when(key.revoked_at) })
                      : t("admin.links.lastUsed", { time: when(key.last_used_at) })}
                  </p>
                </div>
                {!key.revoked_at ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    onClick={() =>
                      void confirmThen(t("admin.links.confirmOff", { name: key.name }), () => revokeKey(token, key.id))
                    }
                  >
                    {t("admin.links.switchOff")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 text-sm text-muted-foreground">{t("admin.links.none")}</p>
        )}
      </Panel>

      <Panel title={t("admin.entries.title")}>
        {state.entries.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("admin.entries.none")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60">
            {state.entries.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{entry.title || t("admin.entries.untitled")}</p>
                  <p className="text-xs text-muted-foreground">
                    {when(entry.time)} · {entry.author}
                    {entry.photo_count > 0 ? ` · ${t("common.photos", { count: entry.photo_count })}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={t("admin.entries.delete", { title: entry.title || t("admin.entries.untitled") })}
                  onClick={() =>
                    void confirmThen(
                      entry.title
                        ? t("admin.entries.confirm", { title: entry.title })
                        : t("admin.entries.confirmUntitled"),
                      () => deleteEntry(token, entry.id)
                    )
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

      <Panel title={t("admin.positions.title")}>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("admin.positions.body")}
        </p>
        <form onSubmit={deletePeriod} className="mt-4 flex flex-wrap items-end gap-3">
          <Field id="period-start" label={t("admin.positions.from")}>
            <Input
              id="period-start"
              type="datetime-local"
              value={period.start}
              onChange={(event) => setPeriod((current) => ({ ...current, start: event.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field id="period-end" label={t("admin.positions.to")}>
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
            {t("admin.positions.deletePeriod")}
          </Button>
        </form>
        {state.positions.last.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("admin.positions.none")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60">
            {state.positions.last.map((fix) => (
              <li key={fix.id} className="flex items-center gap-3 py-2">
                <p className="min-w-0 flex-1 text-sm tabular-nums text-foreground">
                  {texts.coord([fix.lat, fix.lon])}
                  <span className="ml-3 text-xs text-muted-foreground">
                    {when(fix.time)} · {fix.by} · {fix.src}
                  </span>
                </p>
                <button
                  type="button"
                  aria-label={t("admin.positions.delete")}
                  onClick={() => void confirmThen(t("admin.positions.confirm"), () => deletePosition(token, fix.id))}
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
