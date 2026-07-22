"use client";

import { useState } from "react";
import { DashboardIcon } from "./DashboardIcon";
import { DashboardWidgetRenderer } from "./DashboardWidgetRenderer";
import { dashboardDeviceVisibilityClass, dashboardGridClass, dashboardWidgetSizeClasses, dashboardWidgetVariantClasses } from "./dashboard-layout";
import type { AdminDashboardResponse } from "@/types";

export function DashboardCategorySection({ category, layout }: { category: AdminDashboardResponse["categories"][number]; layout: AdminDashboardResponse["layout"] }) {
  const [collapsed, setCollapsed] = useState(category.defaultCollapsed);
  const contentId = `dashboard-category-${category.code.toLowerCase()}`;
  const canCollapse = layout.allowCategoryCollapse && category.collapsible;
  return <section className="grid gap-4" aria-labelledby={`${contentId}-title`}>
    {layout.showCategoryHeaders ? <div className="flex items-center justify-between gap-3 border-b border-hope-100 pb-2"><div className="flex min-w-0 items-center gap-3"><span className="text-hope-700"><DashboardIcon iconKey={category.iconKey} /></span><div><h2 id={`${contentId}-title`} className="font-bold text-ink-900">{category.title}</h2><p className="text-xs text-ink-500">{category.description}</p></div><span className="rounded-full bg-hope-50 px-2 py-1 text-xs font-bold text-hope-700">{category.widgets.length}</span></div>{canCollapse ? <button type="button" aria-expanded={!collapsed} aria-controls={contentId} onClick={() => setCollapsed((value) => !value)} className="rounded-md border border-hope-100 px-3 py-2 text-xs font-bold text-ink-700">{collapsed ? "Expandir" : "Recolher"}</button> : null}</div> : <h2 id={`${contentId}-title`} className="sr-only">{category.title}</h2>}
    <div id={contentId} hidden={collapsed} className={dashboardGridClass(layout)}>{category.widgets.map((widget) => <div key={widget.code} className={`${dashboardWidgetSizeClasses[widget.size]} ${dashboardDeviceVisibilityClass(widget.visibleOnMobile, widget.visibleOnTablet, widget.visibleOnDesktop)} ${dashboardWidgetVariantClasses[widget.visualVariant]}`}><div className="mb-2 flex items-center gap-2 text-xs font-bold text-ink-500"><DashboardIcon iconKey={widget.iconKey} className="h-4 w-4" /><span>{widget.title}</span>{widget.badge ? <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[0.65rem] uppercase text-ink-700">{widget.badge.label.slice(0, 32)}</span> : null}</div><DashboardWidgetRenderer widget={widget} /></div>)}</div>
  </section>;
}
