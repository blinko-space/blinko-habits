import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { customViewPresentation, getCustomViewHost, type CustomViewHost } from "@blinko-cloud/cli/custom-view";
import "./styles.css";
import {
  COLORS,
  HABIT_TYPE_KEY,
  createHabit,
  isScheduled,
  parseCompletions,
  parseSchedule,
  recentDates,
  sanitizeHabit,
  streaks,
  todayKey,
  toggleCompletion,
  type HabitColor,
  type HabitData,
} from "./model";

type EntityRecord<T> = { id: string; typeKey: string; data: T; version: number; trashedAt: string | null; createdAt: string; updatedAt: string };
type Entities = {
  create<T>(input: { typeKey: string; data: T; idempotencyKey?: string }): Promise<EntityRecord<T>>;
  query<T>(input: { typeKey: string; status: "active"; sort: { field: string; direction: "asc" | "desc" }; cursor?: string; limit: number }): Promise<{ items: EntityRecord<T>[]; nextCursor: string | null }>;
  update<T>(id: string, input: { data: T; baseVersion: number }): Promise<EntityRecord<T>>;
  trash(id: string, baseVersion: number): Promise<EntityRecord<unknown>>;
};
type HabitsHost = CustomViewHost & { entities: Entities };
type Form = { id?: string; title: string; note: string; color: HabitColor; schedule: number[] };

const COPY = {
  en: {
    app:"Blinko Habits", subtitle:"Small steps, visible momentum", search:"Search habits", newHabit:"New habit", today:"Today", completed:"completed", currentStreak:"Current streak", bestStreak:"Best streak", days:"days", empty:"Start with one small promise", emptyBody:"Choose something worth repeating. Your progress stays private inside this Blinko App.", create:"Create habit", edit:"Edit habit", habitName:"Habit name", note:"Note", noteHint:"Why does this matter?", color:"Color", schedule:"Repeat on", everyDay:"Every day", save:"Save", cancel:"Cancel", delete:"Delete", deleteTitle:"Delete this habit?", deleteBody:"The habit moves to Blinko trash. Its check-in history is kept with it.", loading:"Loading habits…", loadFailed:"Habits could not be loaded.", retry:"Retry", noResults:"No habits match your search.", checkIn:"Check in", undo:"Undo check-in", scheduledOff:"Not scheduled", recent:"Recent activity", required:"Enter a habit name.", scheduleRequired:"Select at least one day.", saveFailed:"Could not save this change.", conflict:"This habit changed elsewhere. Reload to continue.", reload:"Reload", doneToday:"Done today", dueToday:"Due today", restDay:"Rest day", total:"Total check-ins", close:"Close",
    weekdays:["S","M","T","W","T","F","S"], weekdayNames:["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
  },
  "zh-CN": {
    app:"Blinko 习惯", subtitle:"小步前进，看见积累", search:"搜索习惯", newHabit:"新建习惯", today:"今天", completed:"已完成", currentStreak:"当前连续", bestStreak:"最佳连续", days:"天", empty:"从一个小小的承诺开始", emptyBody:"选择一件值得重复的事。你的进度只保存在这个 Blinko App 中。", create:"创建习惯", edit:"编辑习惯", habitName:"习惯名称", note:"说明", noteHint:"为什么这件事重要？", color:"颜色", schedule:"重复日期", everyDay:"每天", save:"保存", cancel:"取消", delete:"删除", deleteTitle:"删除这个习惯？", deleteBody:"习惯会移入 Blinko 回收站，打卡历史会一起保留。", loading:"正在加载习惯…", loadFailed:"无法加载习惯。", retry:"重试", noResults:"没有匹配的习惯。", checkIn:"打卡", undo:"撤销打卡", scheduledOff:"今天不安排", recent:"近期记录", required:"请输入习惯名称。", scheduleRequired:"请至少选择一天。", saveFailed:"无法保存这次更改。", conflict:"这个习惯已在其他地方更新，请重新载入。", reload:"重新载入", doneToday:"今日完成", dueToday:"今日待完成", restDay:"休息日", total:"累计打卡", close:"关闭",
    weekdays:["日","一","二","三","四","五","六"], weekdayNames:["周日","周一","周二","周三","周四","周五","周六"]
  },
  "zh-TW": {
    app:"Blinko 習慣", subtitle:"小步前進，看見累積", search:"搜尋習慣", newHabit:"新增習慣", today:"今天", completed:"已完成", currentStreak:"目前連續", bestStreak:"最佳連續", days:"天", empty:"從一個小小的承諾開始", emptyBody:"選擇一件值得重複的事。你的進度只保存在這個 Blinko App 中。", create:"建立習慣", edit:"編輯習慣", habitName:"習慣名稱", note:"說明", noteHint:"為什麼這件事重要？", color:"顏色", schedule:"重複日期", everyDay:"每天", save:"儲存", cancel:"取消", delete:"刪除", deleteTitle:"刪除這個習慣？", deleteBody:"習慣會移到 Blinko 垃圾桶，打卡歷史會一起保留。", loading:"正在載入習慣…", loadFailed:"無法載入習慣。", retry:"重試", noResults:"沒有符合的習慣。", checkIn:"打卡", undo:"撤銷打卡", scheduledOff:"今天不安排", recent:"近期紀錄", required:"請輸入習慣名稱。", scheduleRequired:"請至少選擇一天。", saveFailed:"無法儲存這次變更。", conflict:"這個習慣已在其他地方更新，請重新載入。", reload:"重新載入", doneToday:"今日完成", dueToday:"今日待完成", restDay:"休息日", total:"累計打卡", close:"關閉",
    weekdays:["日","一","二","三","四","五","六"], weekdayNames:["週日","週一","週二","週三","週四","週五","週六"]
  }
} as const;

const presentation = customViewPresentation();
const locale = presentation.locale.toLowerCase().startsWith("zh") ? (/(tw|hk|mo)|hant/.test(presentation.locale.toLowerCase()) ? "zh-TW" : "zh-CN") : "en";
const copy = COPY[locale];
type TextKey = Exclude<keyof typeof COPY.en, "weekdays" | "weekdayNames">;
const t = (key: TextKey): string => String(copy[key] ?? COPY.en[key]);
const host = getCustomViewHost() as HabitsHost;
const paths: Record<string, ReactNode> = {
  sprout:<><path d="M12 21v-8"/><path d="M12 13c-4 0-7-2-7-6 4 0 7 2 7 6Z"/><path d="M12 16c4 0 7-2 7-6-4 0-7 2-7 6Z"/></>, plus:<><path d="M12 5v14M5 12h14"/></>, search:<><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></>, check:<><path d="m5 12 4 4L19 6"/></>, flame:<><path d="M12 22c4 0 7-3 7-7 0-3-2-6-5-9 0 3-1 4-2 5-1-3-3-5-5-7 0 4-2 7-2 11 0 4 3 7 7 7Z"/></>, trophy:<><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 1-3 3M12 13v4M8 21h8M9 17h6"/></>, pencil:<><path d="m4 20 4-1 11-11a2 2 0 0 0-3-3L5 16l-1 4Z"/></>, trash:<><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></>, close:<><path d="m6 6 12 12M18 6 6 18"/></>, reload:<><path d="M20 7v5h-5M4 17v-5h5"/><path d="M18 12a6 6 0 0 0-10-4L5 11M6 12a6 6 0 0 0 10 4l3-3"/></>
};
function Icon({name,size=18}:{name:keyof typeof paths;size?:number}) { return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>; }

function App() {
  const [records,setRecords]=useState<EntityRecord<HabitData>[]>([]);
  const [loading,setLoading]=useState(true); const [loadError,setLoadError]=useState(false);
  const [busyId,setBusyId]=useState<string>(); const [query,setQuery]=useState("");
  const [form,setForm]=useState<Form>(); const [deleteId,setDeleteId]=useState<string>();
  const [error,setError]=useState(""); const [conflict,setConflict]=useState(false);
  const recordsRef=useRef(records); recordsRef.current=records;
  const today=todayKey(); const dates=useMemo(()=>recentDates(14,today),[today]);

  const load=async()=>{
    setLoading(true); setLoadError(false); setConflict(false); setError("");
    try { const items:EntityRecord<HabitData>[]=[]; let cursor:string|undefined;
      for(let page=0;page<10;page+=1){const result=await host.entities.query<HabitData>({typeKey:HABIT_TYPE_KEY,status:"active",sort:{field:"updatedAt",direction:"desc"},...(cursor?{cursor}:{}),limit:100});items.push(...result.items.map((item)=>({...item,data:sanitizeHabit(item.data)})));if(!result.nextCursor)break;cursor=result.nextCursor;}
      setRecords(items);
    } catch { setLoadError(true); } finally { setLoading(false); }
  };
  useEffect(()=>{document.title=String(t("app"));void load();},[]);

  const saveRecord=async(record:EntityRecord<HabitData>,data:HabitData)=>{
    if(busyId)return false; setBusyId(record.id); setError("");
    try { const updated=await host.entities.update<HabitData>(record.id,{data,baseVersion:record.version});setRecords((items)=>items.map((item)=>item.id===updated.id?updated:item));return true; }
    catch(err){const message=err instanceof Error?err.message:"";if(message.includes("VERSION_CONFLICT"))setConflict(true);setError(String(t("saveFailed")));return false;} finally{setBusyId(undefined);}
  };
  const toggle=async(record:EntityRecord<HabitData>,date=today)=>{await saveRecord(record,toggleCompletion(record.data,date));};
  const submit=async()=>{
    if(!form?.title.trim()){setError(String(t("required")));return;} if(!form.schedule.length){setError(String(t("scheduleRequired")));return;}
    setError("");
    if(form.id){const record=recordsRef.current.find((item)=>item.id===form.id);if(!record)return;const next={...record.data,...createHabit(form),completions:record.data.completions,createdAt:record.data.createdAt,updatedAt:new Date().toISOString()};if(await saveRecord(record,next))setForm(undefined);return;}
    setBusyId("new");
    try{const created=await host.entities.create<HabitData>({typeKey:HABIT_TYPE_KEY,data:createHabit(form),idempotencyKey:`habit:${crypto.randomUUID()}`});setRecords((items)=>[created,...items]);setForm(undefined);}catch{setError(String(t("saveFailed")));}finally{setBusyId(undefined);}
  };
  const remove=async()=>{const record=recordsRef.current.find((item)=>item.id===deleteId);if(!record)return;setBusyId(record.id);try{await host.entities.trash(record.id,record.version);setRecords((items)=>items.filter((item)=>item.id!==record.id));setDeleteId(undefined);}catch{setError(String(t("saveFailed")));}finally{setBusyId(undefined);}};

  const visible=records.filter((record)=>`${record.data.title}\n${record.data.note}`.toLocaleLowerCase(presentation.locale).includes(query.trim().toLocaleLowerCase(presentation.locale)));
  const scheduledToday=records.filter((record)=>isScheduled(record.data,today));
  const doneToday=scheduledToday.filter((record)=>parseCompletions(record.data.completions).includes(today)).length;
  return <main className="app-shell">
    <header className="topbar"><span className="brand-mark"><Icon name="sprout" size={20}/></span><div><h1>{t("app")}</h1><p>{t("subtitle")}</p></div><button className="primary" onClick={()=>{setError("");setForm({title:"",note:"",color:"sun",schedule:[0,1,2,3,4,5,6]});}}><Icon name="plus" size={17}/>{t("newHabit")}</button></header>
    {conflict&&<div className="banner"><span>{t("conflict")}</span><button onClick={()=>void load()}><Icon name="reload" size={15}/>{t("reload")}</button></div>}
    {error&&!form&&<div className="banner error"><span>{error}</span><button onClick={()=>setError("")}>{t("close")}</button></div>}
    <section className="content">
      <aside className="summary">
        <div className="today-ring" style={{"--progress":scheduledToday.length?`${doneToday/scheduledToday.length*360}deg`:"0deg"} as CSSProperties}><span><strong>{doneToday}</strong><small>/ {scheduledToday.length}</small></span></div>
        <div><strong>{t("today")}</strong><p>{doneToday} {t("completed")}</p></div>
        <label className="search"><Icon name="search" size={16}/><input aria-label={String(t("search"))} placeholder={String(t("search"))} value={query} onChange={(event)=>setQuery(event.target.value)}/></label>
      </aside>
      {loading?<State glyph="sprout" title={String(t("loading"))}/>:loadError?<State glyph="reload" title={String(t("loadFailed"))} action={<button className="secondary" onClick={()=>void load()}>{t("retry")}</button>}/>:!records.length?<State glyph="sprout" title={String(t("empty"))} body={String(t("emptyBody"))} action={<button className="primary" onClick={()=>setForm({title:"",note:"",color:"sun",schedule:[0,1,2,3,4,5,6]})}><Icon name="plus" size={17}/>{t("create")}</button>}/>:!visible.length?<State glyph="search" title={String(t("noResults"))}/>:<div className="habit-grid">{visible.map((record)=><HabitCard key={record.id} record={record} dates={dates} today={today} busy={busyId===record.id} onToggle={(date)=>void toggle(record,date)} onEdit={()=>{setError("");setForm({id:record.id,title:record.data.title,note:record.data.note,color:record.data.color,schedule:parseSchedule(record.data.schedule)});}} onDelete={()=>setDeleteId(record.id)}/>)}</div>}
    </section>
    {form&&<Dialog title={form.id?String(t("edit")):String(t("create"))} onClose={()=>setForm(undefined)}><label>{t("habitName")}<input autoFocus maxLength={120} value={form.title} onChange={(event)=>setForm({...form,title:event.target.value})}/></label><label>{t("note")}<textarea maxLength={2000} placeholder={String(t("noteHint"))} value={form.note} onChange={(event)=>setForm({...form,note:event.target.value})}/></label><fieldset><legend>{t("color")}</legend><div className="colors">{COLORS.map((color)=><button key={color} type="button" aria-label={color} aria-pressed={form.color===color} className={`color ${color}`} onClick={()=>setForm({...form,color})}>{form.color===color&&<Icon name="check" size={15}/>}</button>)}</div></fieldset><fieldset><legend>{t("schedule")}</legend><div className="weekdays">{copy.weekdays.map((label,index)=><button key={index} type="button" aria-label={copy.weekdayNames[index]} aria-pressed={form.schedule.includes(index)} onClick={()=>setForm({...form,schedule:form.schedule.includes(index)?form.schedule.filter((day)=>day!==index):[...form.schedule,index].sort()})}>{label}</button>)}</div></fieldset>{error&&<p className="form-error">{error}</p>}<div className="actions"><button className="secondary" onClick={()=>setForm(undefined)}>{t("cancel")}</button><button className="primary" disabled={Boolean(busyId)} onClick={()=>void submit()}>{t("save")}</button></div></Dialog>}
    {deleteId&&<Dialog title={String(t("deleteTitle"))} onClose={()=>setDeleteId(undefined)}><p className="dialog-copy">{t("deleteBody")}</p><div className="actions"><button className="secondary" onClick={()=>setDeleteId(undefined)}>{t("cancel")}</button><button className="danger" disabled={Boolean(busyId)} onClick={()=>void remove()}>{t("delete")}</button></div></Dialog>}
  </main>;

  function HabitCard({record,dates,today,busy,onToggle,onEdit,onDelete}:{record:EntityRecord<HabitData>;dates:string[];today:string;busy:boolean;onToggle:(date:string)=>void;onEdit:()=>void;onDelete:()=>void}){
    const completed=new Set(parseCompletions(record.data.completions));const stats=streaks(record.data,today);const scheduled=isScheduled(record.data,today);const done=completed.has(today);
    return <article className={`habit-card ${record.data.color}`}><div className="habit-head"><span className="habit-dot"><Icon name="sprout" size={18}/></span><div><h2>{record.data.title}</h2><p className={`status ${done?"done":""}`}>{done?t("doneToday"):scheduled?t("dueToday"):t("restDay")}</p></div><div className="card-actions"><button aria-label={String(t("edit"))} onClick={onEdit}><Icon name="pencil" size={16}/></button><button aria-label={String(t("delete"))} onClick={onDelete}><Icon name="trash" size={16}/></button></div></div>{record.data.note&&<p className="habit-note">{record.data.note}</p>}<button className={`checkin ${done?"checked":""}`} disabled={busy||!scheduled} onClick={()=>onToggle(today)}><span>{done&&<Icon name="check" size={19}/>}</span>{done?t("undo"):scheduled?t("checkIn"):t("scheduledOff")}</button><div className="streaks"><div><Icon name="flame" size={18}/><span>{t("currentStreak")}<strong>{stats.current} {t("days")}</strong></span></div><div><Icon name="trophy" size={18}/><span>{t("bestStreak")}<strong>{stats.best} {t("days")}</strong></span></div><div><Icon name="check" size={18}/><span>{t("total")}<strong>{completed.size}</strong></span></div></div><div className="recent"><span>{t("recent")}</span><div>{dates.map((date)=><button key={date} disabled={busy||!isScheduled(record.data,date)} className={completed.has(date)?"complete":""} title={new Intl.DateTimeFormat(presentation.locale,{month:"short",day:"numeric"}).format(new Date(`${date}T12:00:00`))} aria-label={date} aria-pressed={completed.has(date)} onClick={()=>onToggle(date)}>{new Date(`${date}T12:00:00`).getDate()}</button>)}</div></div></article>;
  }
}

function State({glyph,title,body,action}:{glyph:keyof typeof paths;title:string;body?:string;action?:ReactNode}){return <div className="state"><span><Icon name={glyph} size={28}/></span><h2>{title}</h2>{body&&<p>{body}</p>}{action}</div>;}
function Dialog({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){return <div className="backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose();}}><section className="dialog" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button aria-label={String(t("close"))} onClick={onClose}><Icon name="close" size={18}/></button></header>{children}</section></div>;}

createRoot(document.getElementById("root")!).render(<App/>);
