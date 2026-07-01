"use client";

import { saveMenuVisibilityAction } from "@/app/actions/settings-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ApiRecord } from "@/lib/api/_crud";
import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";

type Page = { slug: string; title: string; section: string; path: string; icon: string };
const areas = [
  { key: "products", label: "Master Product", description: "Products, mappings, bundles, and feature structures.", links: [["Products", "/products"], ["Product mapping", "/products/mapping"], ["Classifications", "/products/classifications"]] },
  { key: "tickets", label: "Master Ticket", description: "Divisions, people, request types, and notification ownership.", links: [["Divisions", "/tickets/divisions"], ["People", "/tickets/people"], ["Request types", "/tickets/types"]] },
  { key: "customer", label: "Customer Knowledge", description: "Pain-point platforms, categories, and customer taxonomy.", links: [["Platforms", "/customer-knowledge/platforms"], ["Categories", "/customer-knowledge/categories"]] },
  { key: "links", label: "Link Templates", description: "Reusable program and event link templates.", links: [["Link templates", "/program/link-templates"]] },
  { key: "competitor", label: "Competitor Intelligence", description: "Competitor profiles, products, prices, snapshots, and flags.", links: [["Profiles", "/competitor-intel"], ["Products", "/competitor-intel/products"], ["Flags", "/competitor-intel/flags"]] },
  { key: "classification", label: "Classifications", description: "Product and imported sales classifications.", links: [["Product classifications", "/products/classifications"], ["Product mappings", "/products/mapping"]] },
  { key: "cta", label: "Content Planning CTA", description: "Carousel call-to-action options and planning references.", links: [["CTA options", "/content-planning/cta"], ["Carousel plans", "/content-planning/carousels"]] },
  { key: "users", label: "Users & Roles", description: "Authentication accounts, access roles, and active status.", links: [["Users & roles", "/settings/users"]] },
] as const;

function settingValue(rows: ApiRecord[]) { const row = rows.find((item) => item.key === "menu_visibility" || item.key === "hidden_modules"); let value = row?.value; if (typeof value === "string") { try { value = JSON.parse(value); } catch { return []; } } if (Array.isArray(value)) return value.map(String); if (value && typeof value === "object" && "hiddenSlugs" in value && Array.isArray(value.hiddenSlugs)) return value.hiddenSlugs.map(String); return []; }

export function SettingsWorkspace({ settings, pages, management }: { settings: ApiRecord[]; pages: Page[]; management: ReactNode }) {
  const [tab, setTab] = useState("menu"); const hidden = new Set(settingValue(settings));
  return (
    <div className="grid gap-3.5">
      <Tabs onValueChange={setTab} value={tab}>
        <TabsList className="h-auto w-full flex-wrap justify-start" variant="line">
          <TabsTrigger value="menu">Menu config</TabsTrigger>
          {areas.map((area) => <TabsTrigger key={area.key} value={area.key}>{area.label}</TabsTrigger>)}
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "menu" ? (
        <Card className="gap-3 p-5">
          <div><h2 className="text-sm font-bold">Sidebar modules</h2><p className="mt-1 text-[11px] text-muted-foreground">Hidden modules remain routable by direct URL. This setting controls navigation visibility only.</p></div>
          <form action={saveMenuVisibilityAction} className="grid gap-3.5">
            {[...new Set(pages.map((page) => page.section))].map((section) => (
              <fieldset className="rounded-lg border border-border p-3" key={section}>
                <legend className="px-1.5 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">{section}</legend>
                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {pages.filter((page) => page.section === section).map((page) => (
                    <label className="flex items-center gap-1.5 text-[12px]" key={page.slug}>
                      <input name="all_slug" type="hidden" value={page.slug} />
                      <input defaultChecked={!hidden.has(page.slug)} name="visible_slug" type="checkbox" value={page.slug} />
                      <i className={`ti ${page.icon}`} /><span>{page.title}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <Button className="w-max" type="submit">Save menu visibility</Button>
          </form>
        </Card>
      ) : null}
      {areas.map((area) => tab === area.key ? (
        <Card className="gap-3 p-5" key={area.key}>
          <div><h2 className="text-sm font-bold">{area.label}</h2><p className="mt-1 text-[11px] text-muted-foreground">{area.description}</p></div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {area.links.map(([label, path]) => (
              <Link className="flex items-center gap-2 rounded-lg border border-border bg-white p-2.5 text-[12px]" href={path} key={path}>
                <i className="ti ti-arrow-up-right text-[var(--purple-mid)]" /><strong className="font-semibold">{label}</strong><span className="ml-auto text-[10px] text-muted-foreground">{path}</span>
              </Link>
            ))}
          </div>
        </Card>
      ) : null)}
      {tab === "advanced" ? management : null}
    </div>
  );
}
