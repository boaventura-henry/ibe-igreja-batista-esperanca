"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { memberLabelCollator, memberSearchMatches } from "@/lib/member-search";
import { getMemberOptionLabel } from "@/utils";

export type MemberComboboxOption = {
  id: string;
  name: string;
  nickname?: string | null;
  label?: string;
  searchText?: string | null;
};

type MemberComboboxProps = {
  value: string;
  onChange: (memberId: string) => void;
  members: readonly MemberComboboxOption[];
  disabled?: boolean;
  required?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  placeholder?: string;
  loading?: boolean;
  ariaLabel?: string;
  className?: string;
  focusRef?: { current: HTMLInputElement | null };
};

export function sortMemberComboboxOptions(options: readonly MemberComboboxOption[]) {
  return [...options].sort((left, right) => {
    const labelOrder = memberLabelCollator.compare(memberComboboxLabel(left), memberComboboxLabel(right));
    return labelOrder || left.id.localeCompare(right.id);
  });
}

export function memberComboboxLabel(member: MemberComboboxOption) {
  return member.label ?? getMemberOptionLabel(member);
}

export function filterMemberComboboxOptions(options: readonly MemberComboboxOption[], query: string) {
  return sortMemberComboboxOptions(options).filter((member) =>
    memberSearchMatches(query, [memberComboboxLabel(member), member.name, member.nickname, member.searchText])
  );
}

export function nextMemberComboboxIndex(currentIndex: number, length: number, direction: 1 | -1) {
  if (!length) return -1;
  if (currentIndex < 0) return direction === 1 ? 0 : length - 1;
  return (currentIndex + direction + length) % length;
}

export function MemberCombobox({
  value,
  onChange,
  members,
  disabled = false,
  required = false,
  allowEmpty = true,
  emptyLabel = "Selecione",
  placeholder = "Pesquisar membro",
  loading = false,
  ariaLabel = "Selecionar membro",
  className = "",
  focusRef
}: MemberComboboxProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const sortedMembers = useMemo(() => sortMemberComboboxOptions(members), [members]);
  const visibleMembers = useMemo(() => filterMemberComboboxOptions(sortedMembers, query), [sortedMembers, query]);
  const selectedMember = useMemo(() => sortedMembers.find((member) => member.id === value) ?? null, [sortedMembers, value]);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePointer(event: MouseEvent | TouchEvent) {
      if (rootRef.current && event.target instanceof Node && !rootRef.current.contains(event.target)) {
        setOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", closeOnOutsidePointer);
    document.addEventListener("touchstart", closeOnOutsidePointer);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsidePointer);
      document.removeEventListener("touchstart", closeOnOutsidePointer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = visibleMembers.findIndex((member) => member.id === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : visibleMembers.length ? 0 : -1);
  }, [open, query, value, visibleMembers]);

  function openSearch() {
    if (disabled) return;
    setQuery("");
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function select(member: MemberComboboxOption) {
    onChange(member.id);
    setQuery("");
    setOpen(false);
  }

  function clear() {
    if (disabled || !allowEmpty) return;
    onChange("");
    setQuery("");
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openSearch();
        return;
      }
      setActiveIndex((current) => nextMemberComboboxIndex(current, visibleMembers.length, event.key === "ArrowDown" ? 1 : -1));
      return;
    }

    if (event.key === "Enter" && open) {
      event.preventDefault();

      if (!loading && activeIndex >= 0 && visibleMembers[activeIndex]) {
        select(visibleMembers[activeIndex]);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setQuery("");
      return;
    }

    if (event.key === "Tab") {
      setOpen(false);
      setQuery("");
    }
  }

  const displayValue = open ? query : selectedMember ? memberComboboxLabel(selectedMember) : "";
  const activeOption = !loading && activeIndex >= 0 ? visibleMembers[activeIndex] : null;

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <div className="flex min-w-0 gap-2">
        <input
          ref={(node) => {
            inputRef.current = node;
            if (focusRef) focusRef.current = node;
          }}
          role="combobox"
          aria-label={ariaLabel}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-activedescendant={activeOption ? `${listboxId}-${activeOption.id}` : undefined}
          aria-required={required || undefined}
          required={required}
          autoComplete="off"
          disabled={disabled}
          value={displayValue}
          onFocus={openSearch}
          onClick={() => { if (!open) openSearch(); }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={selectedMember ? undefined : placeholder}
          className="w-full min-w-0 rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold text-ink-800 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-500"
        />
        {allowEmpty && value ? (
          <button type="button" onClick={clear} disabled={disabled} className="shrink-0 rounded-md border border-hope-100 px-3 py-2 text-xs font-bold text-ink-700 disabled:opacity-50">
            Limpar
          </button>
        ) : null}
      </div>
      {open ? (
        <div id={listboxId} role="listbox" aria-label={`${ariaLabel} - resultados`} className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto overscroll-contain rounded-md border border-hope-100 bg-white p-1 shadow-soft sm:max-h-72">
          {loading ? <p role="status" className="px-3 py-2 text-sm font-semibold text-ink-500">Carregando membros...</p> : null}
          {!loading && !sortedMembers.length ? <p role="status" className="px-3 py-2 text-sm font-semibold text-ink-500">Nenhum membro disponível.</p> : null}
          {!loading && sortedMembers.length && !visibleMembers.length ? <p role="status" className="px-3 py-2 text-sm font-semibold text-ink-500">Nenhum membro encontrado.</p> : null}
          {!loading && visibleMembers.map((member, index) => (
            <button
              key={member.id}
              id={`${listboxId}-${member.id}`}
              type="button"
              role="option"
              aria-selected={member.id === value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(member)}
              className={`block w-full break-words rounded-md px-3 py-2 text-left text-sm font-semibold text-ink-800 focus-visible:outline-none ${index === activeIndex ? "bg-hope-50" : "hover:bg-hope-50"}`}
            >
              {memberComboboxLabel(member)}
            </button>
          ))}
          {!loading && allowEmpty ? (
            <button type="button" role="option" aria-selected={!value} onMouseDown={(event) => event.preventDefault()} onClick={clear} className="block w-full rounded-md border-t border-hope-100 px-3 py-2 text-left text-sm font-semibold text-ink-600 hover:bg-hope-50 focus-visible:outline-none">
              {emptyLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
