import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseExtensionManifest } from "@blinko-cloud/cli/sdk";
import { HABIT_TYPE_KEY, createHabit, isScheduled, parseCompletions, streaks, toggleCompletion } from "../ui/model";

const root=resolve(import.meta.dirname,"..");
const blinko=resolve(root,"node_modules/.bin/blinko");
const runCli=(command:"validate"|"build")=>execFileSync(blinko,["extension",command,"."],{cwd:root,encoding:"utf8"});

describe("Blinko Habits App",()=>{
  it("declares one sidebar Custom View with owned entities and no network",()=>{
    const source=JSON.parse(readFileSync(resolve(root,"blinko.app.json"),"utf8"));
    const manifest=parseExtensionManifest(source);
    expect(manifest).toMatchObject({appId:"cloud.blinko.habits",permissions:{required:["data:own:read","data:own:write","search:index:lexical"]},network:{domains:[]},dataTypes:[expect.objectContaining({typeKey:HABIT_TYPE_KEY})],contributes:{items:[expect.objectContaining({surface:"sidebar",viewId:"habits.workspace"})]}});
    expect(source.dataTypes[0].search.lexical).toEqual(expect.arrayContaining(["title","note"]));
    expect(runCli("validate")).toContain("Valid cloud.blinko.habits");
  });
  it("sanitizes habits and toggles an idempotent daily completion",()=>{
    let habit=createHabit({title:"Read <script>",note:"Ten pages",color:"leaf",schedule:[1,2,3,4,5]},new Date("2026-08-24T08:00:00Z"));
    expect(habit.title).toBe("Read script");
    expect(isScheduled(habit,"2026-08-24")).toBe(true);
    habit=toggleCompletion(habit,"2026-08-24");
    expect(parseCompletions(habit.completions)).toEqual(["2026-08-24"]);
    habit=toggleCompletion(habit,"2026-08-24");
    expect(parseCompletions(habit.completions)).toEqual([]);
  });
  it("calculates current and best streaks over scheduled weekdays",()=>{
    let habit=createHabit({title:"Practice",note:"",color:"sun",schedule:[1,2,3,4,5]});
    for(const date of ["2026-08-24","2026-08-25","2026-08-26","2026-08-27","2026-08-28","2026-08-31"]){habit=toggleCompletion(habit,date);}
    expect(streaks(habit,"2026-08-31")).toEqual({current:6,best:6});
  });
  it("bundles a self-contained responsive React document",()=>{
    runCli("build");
    const index=JSON.parse(readFileSync(resolve(root,"dist/resource-index.json"),"utf8"));
    const resource=index.resources.find((item:{id:string})=>item.id==="ui.habits.workspace");
    const html=readFileSync(resolve(root,"dist",resource.path),"utf8");
    expect(html).toContain("Blinko Habits");
    expect(html).toContain(HABIT_TYPE_KEY);
    expect(html).toContain("prefers-reduced-motion");
    expect(html).not.toContain("setInterval");
    expect(html).not.toMatch(/<script\b[^>]*\bsrc\s*=/i);
    expect(html).not.toMatch(/<link\b[^>]*\brel=["']?stylesheet/i);
  },30000);
});
