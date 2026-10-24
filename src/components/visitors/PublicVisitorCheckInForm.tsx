"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { FormMessage } from "@/components/ui/FormMessage";
import { formatPhone, onlyDigits } from "@/utils";
import { TurnstileWidget } from "./TurnstileWidget";
import {
  isPublicVisitorRegistrationAvailable,
  optionalAddress,
  type VisitorAddressForm,
  type VisitorPrivacyNoticePublic,
  visitorRequestError
} from "./public-visitor-check-in";

type Phase = "INITIAL" | "IDENTIFY_SUBMITTING" | "PROFILE_REQUIRED" | "COMPLETE_SUBMITTING" | "COMPLETED" | "ERROR_RECOVERABLE" | "SERVICE_UNAVAILABLE" | "RATE_LIMITED" | "TURNSTILE_ERROR" | "TURNSTILE_EXPIRED";
type Message = { text: string; tone: "error" | "success" | "warning" | "info" } | null;
type InvalidField = "phone" | "birthDate" | "privacy" | "name" | null;
type ApiFailure = { success: false; error?: { code?: string } };
type ApiSuccess = { success: true; data?: { state?: "COMPLETED" | "PROFILE_REQUIRED"; continuationToken?: string } };

const emptyAddress: VisitorAddressForm = { street: "", number: "", complement: "", district: "", city: "", state: "" };
const inputClass = "h-11 w-full rounded-md border border-hope-100 px-3 text-sm font-semibold text-ink-800 outline-none transition focus:border-hope-500 focus:ring-2 focus:ring-hope-100";

async function readResponse(response: Response): Promise<ApiSuccess | ApiFailure> {
  try { return await response.json() as ApiSuccess | ApiFailure; } catch { return { success: false }; }
}

export function PublicVisitorCheckInForm({ notice }: { notice: VisitorPrivacyNoticePublic }) {
  const [phase, setPhase] = useState<Phase>("INITIAL");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [continuationToken, setContinuationToken] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState<VisitorAddressForm>(emptyAddress);
  const [message, setMessage] = useState<Message>(null);
  const [invalidField, setInvalidField] = useState<InvalidField>(null);
  const [resetKey, setResetKey] = useState(0);
  const profileHeadingRef = useRef<HTMLHeadingElement>(null);
  const completedHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusInitialFieldRef = useRef(false);
  const publicRegistrationAvailable = isPublicVisitorRegistrationAvailable(notice);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  useEffect(() => {
    if (phase === "PROFILE_REQUIRED") profileHeadingRef.current?.focus();
    if (phase === "COMPLETED") completedHeadingRef.current?.focus();
    if (phase === "INITIAL" && focusInitialFieldRef.current) {
      focusInitialFieldRef.current = false;
      focusField("visitor-phone");
    }
  }, [phase]);

  function resetTurnstile() {
    setTurnstileToken("");
    setResetKey((current) => current + 1);
  }

  function resetFlow(messageToShow?: Message) {
    setPhase("INITIAL");
    setPhone("");
    setBirthDate("");
    setAcknowledged(false);
    setContinuationToken(null);
    setName("");
    setAddress(emptyAddress);
    resetTurnstile();
    setInvalidField(null);
    setMessage(messageToShow ?? null);
  }

  function focusField(id: string) {
    document.getElementById(id)?.focus();
  }

  async function submitIdentify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (phase === "IDENTIFY_SUBMITTING" || !publicRegistrationAvailable) return;
    setMessage(null);
    setInvalidField(null);
    const digits = onlyDigits(phone);
    if (digits.length !== 10 && digits.length !== 11) {
      setPhase("ERROR_RECOVERABLE");
      setInvalidField("phone");
      setMessage({ tone: "error", text: "Informe um telefone brasileiro com 10 ou 11 digitos." });
      focusField("visitor-phone");
      return;
    }
    if (!birthDate) {
      setPhase("ERROR_RECOVERABLE");
      setInvalidField("birthDate");
      setMessage({ tone: "error", text: "Informe sua data de nascimento." });
      focusField("visitor-birth-date");
      return;
    }
    if (!acknowledged) {
      setPhase("ERROR_RECOVERABLE");
      setInvalidField("privacy");
      setMessage({ tone: "error", text: "Confirme sua ciencia do aviso de privacidade para continuar." });
      focusField("visitor-privacy");
      return;
    }
    if (!turnstileToken) {
      setPhase("TURNSTILE_ERROR");
      setMessage({ tone: "error", text: "Conclua a verificacao de seguranca antes de continuar." });
      return;
    }

    setPhase("IDENTIFY_SUBMITTING");
    try {
      const response = await fetch("/api/public/visitor-check-ins", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "IDENTIFY", phone, birthDate, privacy: { acknowledged: true, noticeVersion: notice.version }, turnstileToken })
      });
      const payload = await readResponse(response);
      if (response.ok && payload.success && payload.data?.state === "PROFILE_REQUIRED" && payload.data.continuationToken) {
        setContinuationToken(payload.data.continuationToken);
        setPhase("PROFILE_REQUIRED");
        return;
      }
      if (response.ok && payload.success && payload.data?.state === "COMPLETED") {
        resetFlow({ tone: "success", text: "Sua visita de hoje foi registrada. Seja bem-vindo!" });
        setPhase("COMPLETED");
        return;
      }
      const code = !payload.success ? payload.error?.code : undefined;
      if (code === "FLOW_EXPIRED") { focusInitialFieldRef.current = true; resetFlow({ tone: "warning", text: visitorRequestError(response.status, code) }); return; }
      const nextPhase: Phase = response.status === 429 ? "RATE_LIMITED" : response.status === 503 ? "SERVICE_UNAVAILABLE" : "ERROR_RECOVERABLE";
      setPhase(nextPhase);
      setMessage({ tone: response.status === 429 ? "warning" : "error", text: visitorRequestError(response.status, code, response.headers.get("Retry-After")) });
    } catch {
      setPhase("SERVICE_UNAVAILABLE");
      setMessage({ tone: "error", text: "Nao foi possivel concluir agora. Tente novamente em alguns instantes." });
    } finally {
      resetTurnstile();
    }
  }

  async function submitComplete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (phase === "COMPLETE_SUBMITTING" || !continuationToken) return;
    setMessage(null);
    setInvalidField(null);
    if (name.trim().length < 3) {
      setPhase("ERROR_RECOVERABLE");
      setInvalidField("name");
      setMessage({ tone: "error", text: "Informe seu nome." });
      focusField("visitor-name");
      return;
    }
    setPhase("COMPLETE_SUBMITTING");
    try {
      const response = await fetch("/api/public/visitor-check-ins", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "COMPLETE", continuationToken, phone, birthDate, name, address: optionalAddress(address) })
      });
      const payload = await readResponse(response);
      if (response.ok && payload.success && payload.data?.state === "COMPLETED") {
        resetFlow({ tone: "success", text: "Seu cadastro e sua visita foram confirmados. Seja bem-vindo!" });
        setPhase("COMPLETED");
        return;
      }
      const code = !payload.success ? payload.error?.code : undefined;
      if (code === "FLOW_EXPIRED") { focusInitialFieldRef.current = true; resetFlow({ tone: "warning", text: visitorRequestError(response.status, code) }); return; }
      const nextPhase: Phase = response.status === 429 ? "RATE_LIMITED" : response.status === 503 ? "SERVICE_UNAVAILABLE" : "ERROR_RECOVERABLE";
      setPhase(nextPhase);
      setMessage({ tone: response.status === 429 ? "warning" : "error", text: visitorRequestError(response.status, code, response.headers.get("Retry-After")) });
    } catch {
      setPhase("SERVICE_UNAVAILABLE");
      setMessage({ tone: "error", text: "Nao foi possivel concluir agora. Tente novamente em alguns instantes." });
    }
  }

  if (!publicRegistrationAvailable) {
    return (
      <section className="rounded-md border border-hope-100 bg-white p-6 shadow-soft" aria-labelledby="visitor-registration-title">
        <h2 id="visitor-registration-title" className="text-2xl font-bold">Cadastro de visitantes</h2>
        <div className="mt-5"><FormMessage tone="info">O cadastro de visitantes ainda nao esta disponivel.</FormMessage></div>
      </section>
    );
  }

  if (phase === "COMPLETED") {
    return (
      <section className="rounded-md border border-hope-100 bg-white p-6 shadow-soft" aria-labelledby="visitor-completed-title">
        <h2 ref={completedHeadingRef} id="visitor-completed-title" tabIndex={-1} className="text-2xl font-bold">Obrigado pela visita</h2>
        <div className="mt-5">{message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}</div>
        <button type="button" onClick={() => resetFlow()} className="mt-5 h-11 rounded-md border border-hope-600 px-4 text-sm font-bold text-hope-700">Registrar outra visita</button>
      </section>
    );
  }

  const isProfile = phase === "PROFILE_REQUIRED" || phase === "COMPLETE_SUBMITTING" || (continuationToken !== null && ["ERROR_RECOVERABLE", "SERVICE_UNAVAILABLE", "RATE_LIMITED"].includes(phase));
  const submitting = phase === "IDENTIFY_SUBMITTING" || phase === "COMPLETE_SUBMITTING";
  const errorId = "visitor-form-message";

  return (
    <section className="rounded-md border border-hope-100 bg-white shadow-soft" aria-labelledby="visitor-registration-title">
      <div className="border-b border-hope-100 px-5 py-4 sm:px-6">
        <h2 id="visitor-registration-title" className="text-xl font-bold">{isProfile ? "Complete seu cadastro" : "Registre sua visita"}</h2>
        <p className="mt-1 text-sm text-ink-500">{isProfile ? "Informe apenas os dados que desejar acrescentar." : "Informe seus dados para registrar sua visita."}</p>
      </div>
      {message ? <div className="px-5 pt-5 sm:px-6"><FormMessage id={errorId} tone={message.tone}>{message.text}</FormMessage></div> : null}
      {isProfile ? (
        <form onSubmit={submitComplete} className="grid gap-4 p-5 sm:p-6" noValidate>
          <h3 ref={profileHeadingRef} tabIndex={-1} className="sr-only">Dados complementares</h3>
          <Field label="Nome" htmlFor="visitor-name" required>
            <input id="visitor-name" required value={name} onChange={(event) => { setName(event.target.value); if (invalidField === "name") setInvalidField(null); }} maxLength={160} aria-invalid={invalidField === "name"} aria-describedby={invalidField === "name" ? errorId : undefined} className={inputClass} autoComplete="name" />
          </Field>
          <fieldset className="grid gap-4 rounded-md border border-hope-100 p-4">
            <legend className="px-1 text-sm font-bold text-ink-700">Endereco opcional</legend>
            <Field label="Logradouro" htmlFor="visitor-street"><input id="visitor-street" value={address.street} maxLength={160} onChange={(event) => setAddress((current) => ({ ...current, street: event.target.value }))} className={inputClass} autoComplete="address-line1" /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Numero" htmlFor="visitor-number"><input id="visitor-number" value={address.number} maxLength={40} onChange={(event) => setAddress((current) => ({ ...current, number: event.target.value }))} className={inputClass} autoComplete="address-line2" /></Field>
              <Field label="Complemento" htmlFor="visitor-complement"><input id="visitor-complement" value={address.complement} maxLength={120} onChange={(event) => setAddress((current) => ({ ...current, complement: event.target.value }))} className={inputClass} /></Field>
            </div>
            <Field label="Bairro" htmlFor="visitor-district"><input id="visitor-district" value={address.district} maxLength={120} onChange={(event) => setAddress((current) => ({ ...current, district: event.target.value }))} className={inputClass} autoComplete="address-level3" /></Field>
            <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
              <Field label="Cidade" htmlFor="visitor-city"><input id="visitor-city" value={address.city} maxLength={120} onChange={(event) => setAddress((current) => ({ ...current, city: event.target.value }))} className={inputClass} autoComplete="address-level2" /></Field>
              <Field label="UF" htmlFor="visitor-state"><input id="visitor-state" value={address.state} maxLength={2} onChange={(event) => setAddress((current) => ({ ...current, state: event.target.value.toUpperCase() }))} className={inputClass} autoComplete="address-level1" /></Field>
            </div>
          </fieldset>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => resetFlow()} disabled={submitting} className="h-11 rounded-md border border-hope-600 px-4 text-sm font-bold text-hope-700 disabled:opacity-50">Voltar</button>
            <button type="submit" disabled={submitting} className="h-11 rounded-md bg-hope-600 px-4 text-sm font-bold text-white transition hover:bg-hope-700 disabled:cursor-not-allowed disabled:opacity-70">{submitting ? "Enviando..." : "Confirmar visita"}</button>
          </div>
        </form>
      ) : (
        <form onSubmit={submitIdentify} className="grid gap-4 p-5 sm:p-6" noValidate>
          <Field label="Telefone / WhatsApp" htmlFor="visitor-phone" required>
            <input id="visitor-phone" required value={phone} onChange={(event) => { setPhone(formatPhone(event.target.value)); if (invalidField === "phone") setInvalidField(null); }} inputMode="tel" autoComplete="tel" maxLength={16} aria-invalid={invalidField === "phone"} aria-describedby={invalidField === "phone" ? errorId : undefined} className={inputClass} placeholder="(00) 00000-0000" />
          </Field>
          <Field label="Data de nascimento" htmlFor="visitor-birth-date" required>
            <input id="visitor-birth-date" required type="date" value={birthDate} onChange={(event) => { setBirthDate(event.target.value); if (invalidField === "birthDate") setInvalidField(null); }} autoComplete="bday" aria-invalid={invalidField === "birthDate"} aria-describedby={invalidField === "birthDate" ? errorId : undefined} className={inputClass} />
          </Field>
          <div className="rounded-md border border-hope-100 bg-hope-50 p-4 text-sm leading-6 text-ink-700 whitespace-pre-wrap">{notice.text}</div>
          <label className="flex items-start gap-3 text-sm font-semibold text-ink-700" htmlFor="visitor-privacy">
            <input id="visitor-privacy" type="checkbox" checked={acknowledged} onChange={(event) => { setAcknowledged(event.target.checked); if (invalidField === "privacy") setInvalidField(null); }} aria-invalid={invalidField === "privacy"} aria-describedby={invalidField === "privacy" ? errorId : undefined} className="mt-1 h-4 w-4 rounded border-hope-100 text-hope-600 focus:ring-hope-600" />
            Estou ciente do aviso de privacidade, versao {notice.version}.
          </label>
          <TurnstileWidget siteKey={siteKey} resetKey={resetKey} onToken={(token) => { setTurnstileToken(token); setMessage(null); }} onExpired={() => { setTurnstileToken(""); setPhase("TURNSTILE_EXPIRED"); setMessage({ tone: "warning", text: "A verificacao expirou. Conclua uma nova verificacao para continuar." }); }} onError={() => { setTurnstileToken(""); setPhase("TURNSTILE_ERROR"); setMessage({ tone: "error", text: "Nao foi possivel concluir a verificacao. Tente novamente." }); }} onScriptError={() => { setTurnstileToken(""); setPhase("TURNSTILE_ERROR"); setMessage({ tone: "error", text: "A verificacao de seguranca nao esta disponivel agora. Recarregue a pagina e tente novamente." }); }} />
          <button type="submit" disabled={submitting || !turnstileToken} className="h-11 w-full rounded-md bg-hope-600 px-4 text-sm font-bold text-white transition hover:bg-hope-700 disabled:cursor-not-allowed disabled:opacity-70">{submitting ? "Verificando..." : "Continuar"}</button>
        </form>
      )}
    </section>
  );
}

function Field({ label, htmlFor, required, children }: { label: string; htmlFor: string; required?: boolean; children: React.ReactNode }) {
  return <label htmlFor={htmlFor} className="grid gap-1 text-sm font-bold text-ink-700">{label}{required ? <span aria-hidden="true"> *</span> : null}{children}</label>;
}
