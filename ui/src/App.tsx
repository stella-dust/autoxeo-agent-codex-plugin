/*
THESIS: A companion research folio exposes only context, official collection and local artifacts; it refuses the historical six-stage dashboard.
OWN-WORLD: Mist-white paper, graphite ledger lines, cobalt action, square folio tabs and editorial file rows.
STORY: Connect the account, bind the project, confirm an official collection, then return to Codex for reasoning and deliverables.
FIRST VIEWPORT: A narrow project folio frames one decisive next-action ledger beside exact account and Cloud truth.
FORM: Codex-native operational folio, ranked first; direct brief substitution, no concept seed.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
*/
import {
  ArrowUpRight, BookOpen, ChevronRight, CircleAlert, Cloud, FileText,
  FolderOpen, KeyRound, LoaderCircle, LogOut, Menu, Play, RefreshCw,
  ShieldCheck, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Artifact, ArtifactKind, ProjectState } from "../../src/contracts.js";

type View = "context" | "collections" | "artifacts";

interface ConnectionStatus {
  connected: boolean;
  evidenceStatus: "authoritative" | "unavailable";
  message: string;
  account:
    | { state: "configuration_required" | "signed_out" | "error"; message: string }
    | { state: "pending"; message: string; userCode: string; verificationUrl: string; expiresAt: string }
    | { state: "signed_in"; message: string; deviceId: string; accessExpiresAt: string; refreshExpiresAt: string };
  runtime: { localDaemon: "online"; cloudGateway: "online" | "offline" | "configuration_required"; queue: "available" | "unavailable" };
  platforms: Array<{ platform: string; label: string; state: "ready" | "configuration_required" | "eligibility_required" | "unavailable"; search: string; detail: string }>;
}

interface AccountOverview {
  account: { id: string; email: string; name: string | null; status: string };
  organizations: Array<{
    id: string; name: string; role: "owner" | "admin" | "analyst" | "viewer";
    entitlement: { planName: string; subscriptionStatus: string };
    credit: { available: number; includedPerMonth: number; usedThisPeriod: number };
    projects: Array<{ id: string; name: string; brand: { id: string; name: string } }>;
  }>;
  links: { account: string; support: string };
}

interface PreflightResult {
  ticket: { id: string; summary: string; estimatedCredit: number; expiresAt: string };
  estimatedCredit: number;
  evidenceStatus: "authoritative";
}

const viewCopy: Record<View, { label: string; description: string }> = {
  context: { label: "Context", description: "账号、项目与 Wiki" },
  collections: { label: "Collections", description: "官方 API 采集" },
  artifacts: { label: "Artifacts", description: "本地产物索引" },
};

const kindCopy: Record<ArtifactKind, string> = {
  brand_wiki: "Brand Wiki", question_set: "问题集", collection_dataset: "采集数据",
  baseline_analysis: "基线分析", retest_analysis: "复测分析", deliverable: "交付物", other: "其他",
};

async function request<T>(url: string, options: RequestInit = {}, csrf?: string): Promise<T> {
  const response = await fetch(url, { ...options, headers: { "content-type": "application/json", ...(csrf ? { "x-autoxeo-csrf": csrf } : {}), ...options.headers } });
  const body = await response.json() as T & { message?: string; requestId?: string };
  if (!response.ok) throw new Error(`${body.message ?? `HTTP_${response.status}`}${body.requestId ? ` · ${body.requestId}` : ""}`);
  return body;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function App() {
  const [state, setState] = useState<ProjectState>();
  const [connection, setConnection] = useState<ConnectionStatus>();
  const [account, setAccount] = useState<AccountOverview>();
  const [csrf, setCsrf] = useState<string>();
  const [view, setView] = useState<View>("context");
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [preflight, setPreflight] = useState<PreflightResult>();
  const [selection, setSelection] = useState({ organizationId: "", projectId: "", taskBudget: 100 });
  const [preview, setPreview] = useState<{ artifact: Artifact; content: string }>();

  const load = useCallback(async () => {
    const [nextState, nextConnection] = await Promise.all([
      request<ProjectState>("/api/v1/state"), request<ConnectionStatus>("/api/v1/connection"),
    ]);
    setState(nextState);
    setConnection(nextConnection);
    if (nextConnection.account.state === "signed_in") {
      const nextAccount = await request<AccountOverview>("/api/v1/account");
      setAccount(nextAccount);
      setSelection((current) => ({
        organizationId: current.organizationId || nextAccount.organizations[0]?.id || "",
        projectId: current.projectId || nextAccount.organizations[0]?.projects[0]?.id || "",
        taskBudget: current.taskBudget,
      }));
    } else setAccount(undefined);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const token = new URLSearchParams(window.location.hash.slice(1)).get("session");
        const session = token
          ? await request<{ csrfToken: string }>("/api/v1/session/bootstrap", { method: "POST", body: JSON.stringify({ token }) })
          : await request<{ csrfToken: string }>("/api/v1/session");
        setCsrf(session.csrfToken);
        if (token) history.replaceState(null, "", window.location.pathname);
        await load();
      } catch (cause) { setError(cause instanceof Error ? cause.message : "无法启动本地工作台"); }
    })();
  }, [load]);

  const command = async <T,>(body: Record<string, unknown>): Promise<T | undefined> => {
    if (!csrf) return;
    setBusy(String(body.command)); setError(undefined);
    try {
      const result = await request<T>("/api/v1/commands", { method: "POST", body: JSON.stringify(body) }, csrf);
      await load();
      return result;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "操作失败"); }
    finally { setBusy(undefined); }
  };

  const selectedOrganization = account?.organizations.find((item) => item.id === selection.organizationId);
  const artifactsByKind = useMemo(() => {
    const groups = new Map<ArtifactKind, Artifact[]>();
    for (const artifact of state?.artifacts ?? []) groups.set(artifact.kind, [...(groups.get(artifact.kind) ?? []), artifact]);
    return [...groups.entries()];
  }, [state?.artifacts]);

  if (!state) return (
    <main className="boot">
      <span className="brand-mark" aria-hidden="true">AX</span>
      <h1>{error ? "工作台未能连接" : "正在恢复研究现场"}</h1>
      <p>{error ?? "校验本机会话、工作区与 Cloud 状态"}</p>
      {error ? <button onClick={() => window.location.reload()}>重新连接</button> : <LoaderCircle className="spin" aria-label="加载中" />}
    </main>
  );

  const signedIn = connection?.account.state === "signed_in";
  const bound = Boolean(state.project.cloudId);
  const nextAction = !signedIn ? "连接 AutoXEO 账号" : !bound ? "绑定 Cloud 项目" : !state.collection.questionSetId ? "回到 Codex 生成并冻结问题集" : state.collection.nextAction;

  return (
    <div className="shell">
      <header className="masthead">
        <div className="brand"><button className="menu" onClick={() => setMenuOpen((value) => !value)} aria-label="切换导航"><Menu /></button><span className="brand-mark">AX</span><strong>AutoXEO</strong><span>for Codex</span></div>
        <div className="truth"><span className={connection?.connected ? "signal ready" : "signal"} />{connection?.connected ? "Cloud connected" : "Local only"}<span className="divider" /><ShieldCheck />127.0.0.1</div>
      </header>

      <aside className={`folio ${menuOpen ? "open" : ""}`}>
        <div className="project-identity"><small>WORKSPACE</small><strong>{state.project.cloudName ?? "Local GEO Research"}</strong><span>{state.project.localRootName}</span></div>
        <nav aria-label="工作台导航">
          {(Object.keys(viewCopy) as View[]).map((key) => <button key={key} className={view === key ? "active" : ""} onClick={() => { setView(key); setMenuOpen(false); }}><span>{viewCopy[key].label}</span><small>{viewCopy[key].description}</small><ChevronRight /></button>)}
        </nav>
        <div className="folio-foot">
          <span>Brand Wiki</span><strong>{state.brand.wiki.status === "missing" ? "尚未建立" : `${state.brand.wiki.entryCount} 个实体`}</strong>
          <span>Credit</span><strong>{state.credit.authoritative ? state.credit.available.toFixed(0) : "未连接"}</strong>
        </div>
      </aside>

      <main className="stage" id="main-content">
        {error && <div className="error" role="alert"><CircleAlert />{error}<button onClick={() => setError(undefined)} aria-label="关闭"><X /></button></div>}

        {view === "context" && <>
          <section className="stage-head"><div><h1>把推理留在 Codex，<br />把采集交给 Cloud。</h1><p>这个工作台只管理真实上下文。问题生产、分析、复测与 Wiki 写作都在当前 Codex 会话完成。</p></div><BookOpen aria-hidden="true" /></section>
          <section className="next-ledger"><div><span>下一步</span><h2>{nextAction}</h2><p>{connection?.message}</p></div>{!signedIn ? <button onClick={() => void command({ command: "start_account_connection" })} disabled={Boolean(busy)}><KeyRound />连接账号</button> : <button className="secondary" onClick={() => void load()}><RefreshCw />刷新状态</button>}</section>

          {connection?.account.state === "pending" && <section className="authorization"><div><span>设备授权码</span><strong>{connection.account.userCode}</strong><p>{connection.account.message}</p></div><a href={connection.account.verificationUrl} target="_blank" rel="noreferrer">前往授权 <ArrowUpRight /></a><button onClick={() => void command({ command: "poll_account_connection" })} disabled={Boolean(busy)}>我已批准</button></section>}

          <section className="ledger">
            <header><h2>Project context</h2><span>{signedIn ? account?.account.email : "尚未连接账号"}</span></header>
            <div className="ledger-row"><span>Codex runtime</span><strong>当前会话负责推理与写作</strong><em>不需要 DeepSeek Chat Key</em></div>
            <div className="ledger-row"><span>Brand Wiki</span><strong>{state.brand.wiki.status === "missing" ? "等待 Codex 建立" : `${state.brand.wiki.entryCount} 个实体 · ${state.brand.wiki.evidenceCount} 项证据`}</strong><em>本地工作区权威</em></div>
            <div className="ledger-row"><span>Official collection</span><strong>{connection?.platforms.filter((item) => item.state === "ready").length ?? 0} 个平台就绪</strong><em>Cloud 权威</em></div>
          </section>

          {signedIn && !bound && <section className="binding">
            <header><h2>绑定一个 Cloud 项目</h2><p>用于官方 API 采集、Evidence 与 Credit Receipt。</p></header>
            <label>组织<select value={selection.organizationId} onChange={(event) => { const organizationId = event.target.value; const org = account?.organizations.find((item) => item.id === organizationId); setSelection({ ...selection, organizationId, projectId: org?.projects[0]?.id ?? "" }); }}>{account?.organizations.map((org) => <option key={org.id} value={org.id}>{org.name} · {org.entitlement.planName}</option>)}</select></label>
            <label>项目<select value={selection.projectId} onChange={(event) => setSelection({ ...selection, projectId: event.target.value })}>{selectedOrganization?.projects.map((project) => <option key={project.id} value={project.id}>{project.name} · {project.brand.name}</option>)}</select></label>
            <label>本任务 Credit 上限<input type="number" min="0" value={selection.taskBudget} onChange={(event) => setSelection({ ...selection, taskBudget: Number(event.target.value) })} /></label>
            <button onClick={() => void command({ command: "bind_cloud_project", ...selection })} disabled={!selection.projectId || Boolean(busy)}>确认绑定</button>
          </section>}

          {signedIn && <button className="text-action" onClick={() => void command({ command: "disconnect_account", confirmation: "disconnect_autoxeo_account" })}><LogOut />断开本机账号会话</button>}
        </>}

        {view === "collections" && <>
          <section className="stage-head compact"><div><h1>Official collection</h1><p>这里只执行平台官方 API。没有 ready 能力就失败关闭，不用 Codex 回答或模型模拟填空。</p></div><Cloud /></section>
          <section className="platform-ledger">
            {connection?.platforms.map((platform) => <div className="platform-row" key={platform.platform}><span className={`signal ${platform.state === "ready" ? "ready" : ""}`} /><div><strong>{platform.label}</strong><p>{platform.detail}</p></div><span>{platform.search}</span><em>{platform.state}</em></div>)}
          </section>
          <section className="collection-action">
            <div><span>当前问题版本</span><strong>{state.collection.questionSetId ?? "尚未冻结"}</strong><p>{state.collection.nextAction}</p></div>
            {!preflight ? <button onClick={() => void command<PreflightResult>({ command: "prepare_official_collection", questionSetId: state.collection.questionSetId, platforms: ["deepseek"], maxCredit: state.task.budget }).then((value) => value && setPreflight(value))} disabled={!state.collection.questionSetId || Boolean(busy)}><Play />运行预检</button> : <div className="confirm"><strong>{preflight.ticket.summary}</strong><span>预计 {preflight.estimatedCredit} Credit · {formatTime(preflight.ticket.expiresAt)} 过期</span><button onClick={() => void command({ command: "start_official_collection", ticketId: preflight.ticket.id, idempotencyKey: crypto.randomUUID() }).then(() => setPreflight(undefined))}>确认并开始</button><button className="secondary" onClick={() => setPreflight(undefined)}>取消</button></div>}
          </section>
          <section className="ledger"><header><h2>Collection truth</h2><span>{state.collection.status}</span></header><div className="ledger-row"><span>Job</span><strong>{state.collection.jobId ?? "尚未创建"}</strong><em>{state.collection.provenance}</em></div><div className="ledger-row"><span>Receipt</span><strong>{state.collection.receiptId ?? "尚未生成"}</strong><em>Cloud authority</em></div><div className="ledger-row"><span>Reserved Credit</span><strong>{state.credit.reserved}</strong><em>以最终结算为准</em></div></section>
        </>}

        {view === "artifacts" && <>
          <section className="stage-head compact"><div><h1>Workspace artifacts</h1><p>本地文件是 Codex 推理的可审计产物。Cloud 事实不会被本地猜测替代。</p></div><FolderOpen /></section>
          <button className="refresh" onClick={() => void command({ command: "refresh_artifacts" })}><RefreshCw />重新索引</button>
          {artifactsByKind.length === 0 ? <section className="empty"><FileText /><h2>还没有研究产物</h2><p>回到 Codex，请它先建立 Brand Wiki 或问题集。</p></section> : artifactsByKind.map(([kind, artifacts]) => <section className="file-group" key={kind}><header><h2>{kindCopy[kind]}</h2><span>{artifacts.length}</span></header>{artifacts.map((artifact) => <button key={artifact.id} onClick={() => void request<{ content: string }>(`/api/v1/artifacts/preview?path=${encodeURIComponent(artifact.relativePath)}`).then((result) => setPreview({ artifact, content: result.content }))}><FileText /><span><strong>{artifact.name}</strong><small>{artifact.relativePath}</small></span><em>{formatTime(artifact.createdAt)}</em><ChevronRight /></button>)}</section>)}
        </>}
      </main>

      {preview && <aside className="preview" aria-label="产物预览"><header><div><strong>{preview.artifact.name}</strong><span>{preview.artifact.relativePath}</span></div><button onClick={() => setPreview(undefined)} aria-label="关闭预览"><X /></button></header><pre>{preview.content}</pre></aside>}
    </div>
  );
}
