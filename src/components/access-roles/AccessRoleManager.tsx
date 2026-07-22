"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { dashboardLayoutModes, dashboardWidgetDevices, dashboardWidgetSizes, defaultDashboardLayout, type DashboardWidgetDevice } from "@/config/dashboard-widget-enums";
import type { AccessRoleFormValues, AccessRoleListResult, AccessRoleSummary } from "@/types";

type ApiResponse<T> = ({ success: true; data: T } & T) | { success: false; error: { code: string; message: string } };
type AvailableWidget = AccessRoleListResult["availableDashboardWidgets"][number];

const emptyForm: AccessRoleFormValues = { name: "", description: "", permissions: [], isActive: true, confirmSystemChange: false, dashboardWidgets: [], dashboardLayout: { ...defaultDashboardLayout } };
const labelClass = "grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500";
const inputClass = "w-full rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold text-ink-800 outline-none transition focus:border-hope-500 focus:ring-2 focus:ring-hope-100";

function defaultWidgetSetting(widget: AvailableWidget): AccessRoleFormValues["dashboardWidgets"][number] {
  return { code: widget.code, isVisible: true, sortOrder: null, size: null, visibleOnMobile: null, visibleOnTablet: null, visibleOnDesktop: null };
}

export function AccessRoleManager() {
  const [data, setData] = useState<AccessRoleListResult | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<AccessRoleSummary | null>(null);
  const [form, setForm] = useState<AccessRoleFormValues>(emptyForm);
  const [previewDevice, setPreviewDevice] = useState<DashboardWidgetDevice>("DESKTOP");

  const permissionGroups = useMemo(() => {
    const groups = new Map<string, AccessRoleListResult["availablePermissions"]>();
    data?.availablePermissions.forEach((permission) => groups.set(permission.module, [...(groups.get(permission.module) ?? []), permission]));
    return Array.from(groups.entries());
  }, [data]);

  const loadAccessRoles = useCallback(async () => {
    setIsLoading(true); setMessage("");
    try {
      const response = await fetch("/api/access-roles", { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<AccessRoleListResult>;
      if (!payload.success) throw new Error(payload.error.message);
      setData(payload.data);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Nao foi possivel carregar os perfis."); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { void loadAccessRoles(); }, [loadAccessRoles]);

  function openCreateForm() {
    setEditingRole(null);
    setForm({ ...emptyForm, dashboardWidgets: (data?.availableDashboardWidgets ?? []).map(defaultWidgetSetting), dashboardLayout: { ...defaultDashboardLayout } });
    setIsFormOpen(true); setMessage("");
  }

  function openEditForm(role: AccessRoleSummary) {
    const saved = new Map(role.dashboardWidgets.map((widget) => [widget.code, widget]));
    setEditingRole(role);
    setForm({ name: role.name, description: role.description ?? "", permissions: role.permissions.map((permission) => permission.code) as AccessRoleFormValues["permissions"], isActive: role.isActive, confirmSystemChange: false, dashboardWidgets: (data?.availableDashboardWidgets ?? []).map((widget) => saved.get(widget.code) ?? defaultWidgetSetting(widget)), dashboardLayout: role.dashboardLayout });
    setIsFormOpen(true); setMessage("");
  }

  function togglePermission(permission: AccessRoleFormValues["permissions"][number]) {
    setForm((current) => ({ ...current, permissions: current.permissions.includes(permission) ? current.permissions.filter((item) => item !== permission) : [...current.permissions, permission] }));
  }

  function updateWidget(code: AccessRoleFormValues["dashboardWidgets"][number]["code"], changes: Partial<AccessRoleFormValues["dashboardWidgets"][number]>) {
    setForm((current) => ({ ...current, dashboardWidgets: current.dashboardWidgets.map((widget) => widget.code === code ? { ...widget, ...changes } : widget) }));
  }

  function moveWidget(code: AccessRoleFormValues["dashboardWidgets"][number]["code"], direction: -1 | 1) {
    const ordered = [...form.dashboardWidgets].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const index = ordered.findIndex((widget) => widget.code === code); const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    setForm((current) => ({ ...current, dashboardWidgets: current.dashboardWidgets.map((widget) => ({ ...widget, sortOrder: ordered.findIndex((item) => item.code === widget.code) * 10 + 10 })) }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    try {
      const response = await fetch(editingRole ? `/api/access-roles/${editingRole.id}` : "/api/access-roles", { method: editingRole ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const payload = (await response.json()) as ApiResponse<AccessRoleSummary>;
      if (!payload.success) throw new Error(payload.error.message);
      setIsFormOpen(false); setMessage(editingRole ? "Perfil atualizado com sucesso." : "Perfil criado com sucesso."); await loadAccessRoles();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Nao foi possivel salvar o perfil."); }
  }

  async function handleDelete(role: AccessRoleSummary) {
    if (!window.confirm("Deseja excluir este perfil de acesso?")) return;
    try {
      const response = await fetch(`/api/access-roles/${role.id}${role.isSystem ? "?confirmSystemChange=true" : ""}`, { method: "DELETE" });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;
      if (!payload.success) throw new Error(payload.error.message);
      setMessage("Perfil excluido com sucesso."); await loadAccessRoles();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Nao foi possivel excluir o perfil."); }
  }

  return <div className="space-y-5">
    {message ? <div className="rounded-md border border-hope-100 bg-hope-50 px-4 py-3 text-sm font-semibold text-ink-800">{message}</div> : null}
    <div className="overflow-hidden rounded-md border border-hope-100 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-hope-100 px-4 py-3"><div><p className="text-sm font-bold text-ink-900">Perfis cadastrados</p><p className="text-xs text-ink-500">{data?.accessRoles.length ?? 0} perfil(is)</p></div><button type="button" onClick={openCreateForm} className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">Novo perfil</button></div><div className="overflow-x-auto"><table className="min-w-full divide-y divide-hope-100 text-sm"><thead className="bg-hope-50 text-left text-xs font-bold uppercase tracking-wide text-ink-500"><tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">Descricao</th><th className="px-4 py-3">Permissoes</th><th className="px-4 py-3">Membros</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Acoes</th></tr></thead><tbody className="divide-y divide-hope-100">{isLoading ? <tr><td className="px-4 py-8 text-center font-semibold text-ink-500" colSpan={6}>Carregando perfis...</td></tr> : null}{data?.accessRoles.map((role) => <tr key={role.id}><td className="px-4 py-4 font-semibold">{role.name}{role.isSystem ? <span className="ml-2 text-xs text-hope-700">Sistema</span> : null}</td><td className="px-4 py-4">{role.description || "-"}</td><td className="px-4 py-4">{role.permissions.length}</td><td className="px-4 py-4">{role.membersCount}</td><td className="px-4 py-4">{role.isActive ? "Ativo" : "Inativo"}</td><td className="px-4 py-4 text-right"><button type="button" onClick={() => openEditForm(role)} className="mr-2 rounded-md border border-hope-100 px-3 py-2 text-xs font-bold">Editar</button><button type="button" onClick={() => void handleDelete(role)} className="rounded-md border border-red-100 px-3 py-2 text-xs font-bold text-red-700">Excluir</button></td></tr>)}</tbody></table></div></div>
    {isFormOpen ? <div className="fixed inset-0 z-40 overflow-y-auto bg-ink-900/45 px-4 py-6"><div className="mx-auto max-w-5xl rounded-md bg-white shadow-soft"><form onSubmit={handleSubmit}><div className="flex items-start justify-between border-b border-hope-100 px-5 py-4"><div><h2 className="text-lg font-bold">{editingRole ? "Editar perfil" : "Novo perfil"}</h2><p className="text-sm text-ink-500">Permissoes, cards e layout por perfil.</p></div><button type="button" onClick={() => setIsFormOpen(false)} className="rounded-md border border-hope-100 px-3 py-2 text-sm font-bold">Fechar</button></div><div className="grid gap-5 p-5">
      <label className={labelClass}>Nome<input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className={inputClass} /></label><label className={labelClass}>Descricao<textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className={`${inputClass} min-h-24`} /></label><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />Perfil ativo</label>{editingRole?.isSystem ? <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.confirmSystemChange} onChange={(event) => setForm((current) => ({ ...current, confirmSystemChange: event.target.checked }))} />Confirmar alteracao de perfil do sistema</label> : null}
      <div className="grid gap-4 md:grid-cols-2">{permissionGroups.map(([group, permissions]) => <fieldset key={group} className="rounded-md border border-hope-100 p-3"><legend className="px-1 text-xs font-bold uppercase text-ink-500">{group}</legend><div className="mt-2 grid gap-2">{permissions.map((permission) => { const code = permission.code as AccessRoleFormValues["permissions"][number]; return <label key={permission.code} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={form.permissions.includes(code)} onChange={() => togglePermission(code)} className="mt-1" /><span><span className="block font-semibold">{permission.label || permission.name}</span><span className="block text-xs text-ink-500">{permission.code}</span>{permission.description ? <span className="block text-xs text-ink-500">{permission.description}</span> : null}{permission.module.includes("Financeiro") || permission.module.includes("Contribuicoes") ? <span className="mt-1 inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[0.65rem] font-bold uppercase text-red-700">Conteudo sensivel</span> : null}</span></label>; })}</div></fieldset>)}</div>
      <fieldset className="rounded-md border border-hope-100 p-4"><div className="flex items-center justify-between"><div><legend className="text-sm font-bold">Cards do dashboard</legend><p className="text-xs text-ink-500">Configuracoes visuais nunca concedem permissao.</p></div><button type="button" onClick={() => setForm((current) => ({ ...current, dashboardWidgets: (data?.availableDashboardWidgets ?? []).map(defaultWidgetSetting), dashboardLayout: { ...defaultDashboardLayout } }))} className="rounded-md border border-hope-100 px-3 py-2 text-xs font-bold">Restaurar padroes</button></div><div className="mt-4 grid gap-3">{data?.availableDashboardWidgets.map((widget) => <WidgetSetting key={widget.code} widget={widget} setting={form.dashboardWidgets.find((item) => item.code === widget.code) ?? defaultWidgetSetting(widget)} hasPermission={form.permissions.includes(widget.permissionCode as AccessRoleFormValues["permissions"][number])} onChange={(changes) => updateWidget(widget.code, changes)} onMove={(direction) => moveWidget(widget.code, direction)} onReset={() => updateWidget(widget.code, defaultWidgetSetting(widget))} />)}</div></fieldset>
      <LayoutSettings form={form} setForm={setForm} />
      <fieldset className="rounded-md border border-hope-100 p-4"><legend className="px-1 text-sm font-bold">Pre-visualizacao estrutural</legend><div className="mt-3 flex gap-2">{dashboardWidgetDevices.map((device) => <button key={device} type="button" onClick={() => setPreviewDevice(device)} className={`rounded-md px-3 py-2 text-xs font-bold ${previewDevice === device ? "bg-hope-600 text-white" : "border border-hope-100"}`}>{device}</button>)}</div><DashboardLayoutPreview device={previewDevice} form={form} widgets={data?.availableDashboardWidgets ?? []} /></fieldset>
    </div><div className="flex justify-end gap-3 border-t border-hope-100 px-5 py-4"><button type="button" onClick={() => setIsFormOpen(false)} className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold">Cancelar</button><button className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">Salvar perfil</button></div></form></div></div> : null}
  </div>;
}

function WidgetSetting({ widget, setting, hasPermission, onChange, onMove, onReset }: { widget: AvailableWidget; setting: AccessRoleFormValues["dashboardWidgets"][number]; hasPermission: boolean; onChange: (changes: Partial<typeof setting>) => void; onMove: (direction: -1 | 1) => void; onReset: () => void }) {
  const unavailable = !hasPermission || !widget.isEnabled;
  const customized = !setting.isVisible || setting.sortOrder !== null || setting.size !== null || setting.visibleOnMobile !== null || setting.visibleOnTablet !== null || setting.visibleOnDesktop !== null;
  return <div className={`grid gap-3 rounded-md border p-3 ${widget.sensitivity === "RESTRICTED" ? "border-red-100 bg-red-50/40" : "border-hope-100"}`}><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{widget.title}{widget.sensitivity === "RESTRICTED" ? " - sensivel" : ""}</p><span className="rounded-full bg-hope-50 px-2 py-0.5 text-[0.65rem] font-bold uppercase text-hope-700">{customized ? "Personalizado" : "Padrao"}</span></div><p className="text-xs text-ink-500">{widget.category} - {widget.priority} - {widget.permissionCode}</p>{unavailable ? <p className="text-xs font-bold text-red-700">Indisponivel: {widget.isEnabled ? "exige permissao" : "desabilitado globalmente"}</p> : null}</div><div className="flex flex-wrap items-end gap-3"><Check label="Visivel" disabled={unavailable} checked={!unavailable && setting.isVisible} onChange={(value) => onChange({ isVisible: value })} /><label className={labelClass}>Ordem<input type="number" min={0} max={10000} disabled={unavailable} value={setting.sortOrder ?? widget.defaultOrder} onChange={(event) => onChange({ sortOrder: Number(event.target.value) })} className="w-24 rounded-md border px-2 py-1" /></label><label className={labelClass}>Tamanho<select disabled={unavailable} value={setting.size ?? ""} onChange={(event) => onChange({ size: event.target.value ? event.target.value as typeof setting.size : null })} className="rounded-md border px-2 py-1"><option value="">Padrao ({widget.defaultSize})</option>{dashboardWidgetSizes.map((size) => <option key={size}>{size}</option>)}</select></label><Check label="Celular" disabled={unavailable} checked={setting.visibleOnMobile ?? widget.defaultVisibleOnMobile} onChange={(value) => onChange({ visibleOnMobile: value })} /><Check label="Tablet" disabled={unavailable} checked={setting.visibleOnTablet ?? widget.defaultVisibleOnTablet} onChange={(value) => onChange({ visibleOnTablet: value })} /><Check label="Desktop" disabled={unavailable} checked={setting.visibleOnDesktop ?? widget.defaultVisibleOnDesktop} onChange={(value) => onChange({ visibleOnDesktop: value })} /><button type="button" disabled={unavailable} onClick={() => onMove(-1)} className="rounded-md border px-2 py-1 text-xs font-bold disabled:opacity-40">Subir</button><button type="button" disabled={unavailable} onClick={() => onMove(1)} className="rounded-md border px-2 py-1 text-xs font-bold disabled:opacity-40">Descer</button><button type="button" disabled={!customized} onClick={onReset} className="rounded-md border px-2 py-1 text-xs font-bold disabled:opacity-40">Restaurar</button></div></div>;
}

function Check({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center gap-1 text-xs font-bold"><input type="checkbox" disabled={disabled} checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>; }

function LayoutSettings({ form, setForm }: { form: AccessRoleFormValues; setForm: Dispatch<SetStateAction<AccessRoleFormValues>> }) {
  const update = (changes: Partial<AccessRoleFormValues["dashboardLayout"]>) => setForm((current) => ({ ...current, dashboardLayout: { ...current.dashboardLayout, ...changes } }));
  return <fieldset className="rounded-md border border-hope-100 p-4"><legend className="px-1 text-sm font-bold">Layout do dashboard</legend><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><label className={labelClass}>Modo<select className={inputClass} value={form.dashboardLayout.mode} onChange={(event) => update({ mode: event.target.value as AccessRoleFormValues["dashboardLayout"]["mode"] })}>{dashboardLayoutModes.map((mode) => <option key={mode}>{mode}</option>)}</select></label><Column label="Colunas desktop" value={form.dashboardLayout.desktopColumns} values={[1,2,3,4]} onChange={(value) => update({ desktopColumns: value as 1|2|3|4 })} /><Column label="Colunas tablet" value={form.dashboardLayout.tabletColumns} values={[1,2,3]} onChange={(value) => update({ tabletColumns: value as 1|2|3 })} /><Column label="Colunas celular" value={form.dashboardLayout.mobileColumns} values={[1,2]} onChange={(value) => update({ mobileColumns: value as 1|2 })} /><Check label="Exibir cabecalhos" checked={form.dashboardLayout.showCategoryHeaders} onChange={(value) => update({ showCategoryHeaders: value })} /><Check label="Permitir recolhimento" checked={form.dashboardLayout.allowCategoryCollapse} onChange={(value) => update({ allowCategoryCollapse: value })} /></div></fieldset>;
}

function Column({ label, value, values, onChange }: { label: string; value: number; values: number[]; onChange: (value: number) => void }) { return <label className={labelClass}>{label}<select className={inputClass} value={value} onChange={(event) => onChange(Number(event.target.value))}>{values.map((item) => <option key={item}>{item}</option>)}</select></label>; }

function DashboardLayoutPreview({ device, form, widgets }: { device: DashboardWidgetDevice; form: AccessRoleFormValues; widgets: AvailableWidget[] }) {
  const columns = device === "MOBILE" ? form.dashboardLayout.mobileColumns : device === "TABLET" ? form.dashboardLayout.tabletColumns : form.dashboardLayout.desktopColumns;
  const field = device === "MOBILE" ? "visibleOnMobile" : device === "TABLET" ? "visibleOnTablet" : "visibleOnDesktop";
  const defaultField = device === "MOBILE" ? "defaultVisibleOnMobile" : device === "TABLET" ? "defaultVisibleOnTablet" : "defaultVisibleOnDesktop";
  const settings = new Map(form.dashboardWidgets.map((setting) => [setting.code, setting]));
  const visible = widgets.filter((widget) => { const setting = settings.get(widget.code); return setting?.isVisible && form.permissions.includes(widget.permissionCode as AccessRoleFormValues["permissions"][number]) && (setting[field] ?? widget[defaultField]); }).sort((a,b) => (settings.get(a.code)?.sortOrder ?? a.defaultOrder) - (settings.get(b.code)?.sortOrder ?? b.defaultOrder));
  return <div className="mt-4 grid gap-2 rounded-md bg-hope-50 p-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>{visible.length ? visible.map((widget) => { const size = settings.get(widget.code)?.size ?? widget.defaultSize; const requestedSpan = size === "SMALL" ? 1 : size === "MEDIUM" ? 2 : size === "LARGE" ? 3 : columns; const span = Math.min(requestedSpan, columns); return <div key={widget.code} className="rounded-md border border-hope-100 bg-white p-3" style={{ gridColumn: size === "FULL" ? "1 / -1" : `span ${span} / span ${span}` }}><p className="truncate text-xs font-bold">{widget.title}</p><p className="text-[0.65rem] text-ink-500">{widget.category} - {size}</p></div>; }) : <p className="col-span-full text-xs font-semibold text-ink-500">Nenhum card visivel neste dispositivo.</p>}</div>;
}
