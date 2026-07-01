"use client";

import { saveMenuVisibilityAction } from "@/app/actions/settings-actions";
import type { ApiRecord } from "@/lib/api/_crud";
import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import styles from "../record-manager.module.css";

type Page={slug:string;title:string;section:string;path:string;icon:string};
const areas=[
  {key:"products",label:"Master Product",description:"Products, mappings, bundles, and feature structures.",links:[["Products","/products"],["Product mapping","/products/mapping"],["Classifications","/products/classifications"]]},
  {key:"tickets",label:"Master Ticket",description:"Divisions, people, request types, and notification ownership.",links:[["Divisions","/tickets/divisions"],["People","/tickets/people"],["Request types","/tickets/types"]]},
  {key:"customer",label:"Customer Knowledge",description:"Pain-point platforms, categories, and customer taxonomy.",links:[["Platforms","/customer-knowledge/platforms"],["Categories","/customer-knowledge/categories"]]},
  {key:"links",label:"Link Templates",description:"Reusable program and event link templates.",links:[["Link templates","/program/link-templates"]]},
  {key:"competitor",label:"Competitor Intelligence",description:"Competitor profiles, products, prices, snapshots, and flags.",links:[["Profiles","/competitor-intel"],["Products","/competitor-intel/products"],["Flags","/competitor-intel/flags"]]},
  {key:"classification",label:"Classifications",description:"Product and imported sales classifications.",links:[["Product classifications","/products/classifications"],["Product mappings","/products/mapping"]]},
  {key:"cta",label:"Content Planning CTA",description:"Carousel call-to-action options and planning references.",links:[["CTA options","/content-planning/cta"],["Carousel plans","/content-planning/carousels"]]},
  {key:"users",label:"Users & Roles",description:"Authentication accounts, access roles, and active status.",links:[["Users & roles","/settings/users"]]},
] as const;

function settingValue(rows:ApiRecord[]){const row=rows.find((item)=>item.key==="menu_visibility"||item.key==="hidden_modules");let value=row?.value;if(typeof value==="string"){try{value=JSON.parse(value);}catch{return[];}}if(Array.isArray(value))return value.map(String);if(value&&typeof value==="object"&&"hiddenSlugs" in value&&Array.isArray(value.hiddenSlugs))return value.hiddenSlugs.map(String);return[];}

export function SettingsWorkspace({settings,pages,management}:{settings:ApiRecord[];pages:Page[];management:ReactNode}){
  const [tab,setTab]=useState("menu");const hidden=new Set(settingValue(settings));
  return <div className={styles.settingsWorkspace}><div className={styles.workspaceHeader}><div><p>Internal</p><h1>Settings</h1><span>Menu visibility, operational master data, account access, and persisted application configuration.</span></div></div><nav className={styles.workspaceTabs}><button className={tab==="menu"?styles.workspaceTabActive:styles.workspaceTab} onClick={()=>setTab("menu")}>Menu config</button>{areas.map((area)=><button className={tab===area.key?styles.workspaceTabActive:styles.workspaceTab} key={area.key} onClick={()=>setTab(area.key)}>{area.label}</button>)}<button className={tab==="advanced"?styles.workspaceTabActive:styles.workspaceTab} onClick={()=>setTab("advanced")}>Advanced</button></nav>
  {tab==="menu"?<section className={styles.menuSettings}><header><h2>Sidebar modules</h2><p>Hidden modules remain routable by direct URL. This setting controls navigation visibility only.</p></header><form action={saveMenuVisibilityAction}>{[...new Set(pages.map((page)=>page.section))].map((section)=><fieldset key={section}><legend>{section}</legend>{pages.filter((page)=>page.section===section).map((page)=><label key={page.slug}><input name="all_slug" type="hidden" value={page.slug}/><input defaultChecked={!hidden.has(page.slug)} name="visible_slug" type="checkbox" value={page.slug}/><i className={`ti ${page.icon}`}/><span>{page.title}</span></label>)}</fieldset>)}<button className={styles.primaryButton}>Save menu visibility</button></form></section>:null}
  {areas.map((area)=>tab===area.key?<section className={styles.settingsArea} key={area.key}><header><h2>{area.label}</h2><p>{area.description}</p></header><div>{area.links.map(([label,path])=><Link href={path} key={path}><i className="ti ti-arrow-up-right"/><strong>{label}</strong><span>{path}</span></Link>)}</div></section>:null)}
  {tab==="advanced"?management:null}</div>;
}
