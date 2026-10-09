"use client";

import { ScheduleMemberRole } from "@prisma/client";
import type { ReactNode } from "react";
import { MemberCombobox, type MemberComboboxOption } from "@/components/members/MemberCombobox";
import { hasInstrumentRole, scheduleMemberRoleOptions } from "@/lib/schedule-member-role";

export type ScheduleInstrumentDraft = {
  instrumentCategoryId: string;
  source: "" | "REGISTERED" | "OWN";
  instrumentId: string;
};

export type ScheduleMemberBasicValue = {
  memberId: string;
  roles: ScheduleMemberRole[];
  instrumentAssignment?: ScheduleInstrumentDraft;
};

export type ScheduleInstrumentCategoryOption = {
  id: string;
  name: string;
  isActive: boolean;
};

export type ScheduleEligibleInstrumentOption = {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  status: string;
  label?: string;
};

type Props = {
  value: ScheduleMemberBasicValue;
  members: readonly MemberComboboxOption[];
  categories: readonly ScheduleInstrumentCategoryOption[];
  instruments: readonly ScheduleEligibleInstrumentOption[];
  onMemberChange: (memberId: string) => void;
  onRoleChange: (role: ScheduleMemberRole, checked: boolean) => void;
  onInstrumentCategoryChange: (categoryId: string) => void;
  onInstrumentSourceChange: (source: ScheduleInstrumentDraft["source"]) => void;
  onInstrumentChange: (instrumentId: string) => void;
  memberLoading?: boolean;
  categoriesLoading?: boolean;
  instrumentsLoading?: boolean;
  memberHelp?: ReactNode;
  instrumentSourceName: string;
  instrumentEnabled?: boolean;
};

const inputClass = "w-full rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold text-ink-800 outline-none transition focus:border-hope-500 focus:ring-2 focus:ring-hope-100";

export function ScheduleMemberBasicEditor({
  value,
  members,
  categories,
  instruments,
  onMemberChange,
  onRoleChange,
  onInstrumentCategoryChange,
  onInstrumentSourceChange,
  onInstrumentChange,
  memberLoading = false,
  categoriesLoading = false,
  instrumentsLoading = false,
  memberHelp,
  instrumentSourceName,
  instrumentEnabled = true
}: Props) {
  const showInstrumentFields = instrumentEnabled && hasInstrumentRole({ roles: value.roles });

  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-2">
      <Field label="Membro" className="md:col-span-2">
        <MemberCombobox
          required
          value={value.memberId}
          onChange={onMemberChange}
          members={members}
          allowEmpty={false}
          loading={memberLoading}
          ariaLabel="Membro escalado"
        />
        {memberHelp}
      </Field>

      <fieldset className="grid gap-2 md:col-span-2">
        <legend className="text-xs font-bold uppercase tracking-wide text-ink-500">Funções</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {scheduleMemberRoleOptions.map((role) => (
            <label key={role.value} className="flex min-h-10 items-center gap-2 rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold text-ink-700">
              <input
                type="checkbox"
                name={`${instrumentSourceName}-roles`}
                value={role.value}
                checked={value.roles.includes(role.value)}
                onChange={(event) => onRoleChange(role.value, event.target.checked)}
              />
              {role.label}
            </label>
          ))}
        </div>
        {value.roles.length === 0 ? (
          <span className="text-xs font-semibold text-red-700">Selecione pelo menos uma função.</span>
        ) : null}
      </fieldset>

      {showInstrumentFields ? (
        <>
          <Field label="Categoria musical">
            <select
              value={value.instrumentAssignment?.instrumentCategoryId ?? ""}
              onChange={(event) => onInstrumentCategoryChange(event.target.value)}
              disabled={categoriesLoading}
              className={inputClass}
              aria-busy={categoriesLoading}
            >
              <option value="">{categoriesLoading ? "Carregando categorias..." : "Categoria nao informada"}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}{!category.isActive ? " (Inativa)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <fieldset className="grid gap-2 text-xs font-bold uppercase tracking-wide text-ink-500">
            <legend>Origem do instrumento</legend>
            <label className="flex items-center gap-2 text-sm font-semibold normal-case tracking-normal text-ink-700">
              <input
                type="radio"
                name={instrumentSourceName}
                value="REGISTERED"
                checked={value.instrumentAssignment?.source === "REGISTERED"}
                onChange={() => onInstrumentSourceChange("REGISTERED")}
              />
              Instrumento da igreja
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold normal-case tracking-normal text-ink-700">
              <input
                type="radio"
                name={instrumentSourceName}
                value="OWN"
                checked={value.instrumentAssignment?.source === "OWN"}
                onChange={() => onInstrumentSourceChange("OWN")}
              />
              Instrumento próprio
            </label>
          </fieldset>
          {value.instrumentAssignment?.source === "REGISTERED" ? (
            <Field label="Instrumento" className="md:col-span-2">
              <select
                value={value.instrumentAssignment.instrumentId}
                onChange={(event) => onInstrumentChange(event.target.value)}
                disabled={!value.instrumentAssignment.instrumentCategoryId || instrumentsLoading}
                className={inputClass}
                aria-busy={instrumentsLoading}
              >
                <option value="">
                  {!value.instrumentAssignment.instrumentCategoryId
                    ? "Selecione uma categoria primeiro"
                    : instrumentsLoading
                      ? "Carregando instrumentos..."
                      : instruments.length === 0
                        ? "Nenhum instrumento ativo disponivel para esta categoria."
                        : "Selecione"}
                </option>
                {instruments.map((instrument) => (
                  <option key={instrument.id} value={instrument.id}>{instrument.label ?? instrument.name}</option>
                ))}
              </select>
            </Field>
          ) : null}
          {value.instrumentAssignment?.source === "OWN" ? (
            <p className="text-sm font-semibold text-ink-600 md:col-span-2">Será utilizado um instrumento próprio do membro.</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`grid min-w-0 gap-1 text-xs font-bold uppercase tracking-wide text-ink-500 ${className}`}>
      {label}
      {children}
    </label>
  );
}
