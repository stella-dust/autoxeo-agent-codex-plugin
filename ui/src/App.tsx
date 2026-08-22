/*
THESIS: One auditable GEO task state and its next safe action lead; no generic dashboard grid.
OWN-WORLD: Cool neutral instruments, signal-violet action, hairline rows, semantic state colors.
STORY: Scope the project, see what is true, confirm cost/impact, inspect Evidence and artifacts.
FIRST VIEWPORT: Global truth bar, compact workflow rail, task state and next action, optional inspector.
FORM: Established Operate workbench extended in place; no concept reseed for this scoped migration.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
*/
import {
  Activity,
  BadgeCheck,
  BookOpenText,
  Box,
  Building2,
  Check,
  ChevronRight,
  CircleAlert,
  CircleDot,
  Cloud,
  Cpu,
  ExternalLink,
  FileCode2,
  FileText,
  FolderOpen,
  Gauge,
  KeyRound,
  LoaderCircle,
  PanelLeftClose,
  Play,
  RefreshCw,
  ReceiptText,
  Search,
  Server,
  ShieldCheck,
  UserRound,
  LogOut,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Artifact, GeoNode, KnowledgeEntry, NodeStatus, ProjectState } from "../../src/contracts.js";

type View = "overview" | "knowledge" | "artifacts" | "services";
type Detail = { type: "node"; value: GeoNode } | { type: "knowledge"; value: KnowledgeEntry } | { type: "artifact"; value: Artifact };

interface ConnectionStatus {
  connected: boolean;
  mode: "cloud";
  evidenceStatus: "authoritative" | "unavailable";
  message: string;
  account:
    | { state: "configuration_required" | "signed_out" | "error"; message: string }
    | { state: "pending"; message: string; userCode: string; verificationUrl: string; expiresAt: string }
    | { state: "signed_in"; message: string; deviceId: string; accessExpiresAt: string; refreshExpiresAt: string };
  runtime: { localDaemon: "online"; cloudGateway: "online" | "offline" | "configuration_required"; queue: "available" | "unavailable" };
  concurrency: { interactive: { active: number; limit: number | null }; batch: { active: number; limit: number | null }; source: "cloud" | "unavailable" };
  platforms: Array<{ platform: string; label: string; state: "ready" | "configuration_required" | "eligibility_required" | "unavailable"; search: string; detail: string }>;
}

interface PreflightResult {
  ticket: { id: string; summary: string; estimatedCredit: number; expiresAt: string };
  estimatedCredit: number;
  evidenceStatus: "authoritative";
}

interface AccountOverview {
  account: { id: string; email: string; name: string | null; emailVerified: string | null; status: string };
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    role: "owner" | "admin" | "analyst" | "viewer";
    entitlement: { planCode: string; planName: string; subscriptionStatus: "trialing" | "active" | "past_due" | "canceled" | "expired" | "inactive"; currentPeriodEnd: string | null; trialEndsAt: string | null };
    credit: { available: number; includedPerMonth: number; usedThisPeriod: number; usageEventCount: number; periodStart: string };
    quota: { projects: { current: number; limit: number }; members: { current: number; limit: number }; collectionRuns: { limit: number } };
    projects: Array<{ id: string; name: string; brand: { id: string; name: string } }>;
    invoices: Array<{ id: string; amount: number; currency: string; status: string; provider: string; pdfUrl: string | null; createdAt: string }>;
  }>;
  links: { account: string; support: string };
  refreshedAt: string;
}

interface ArtifactPreview {
  content: string;
  mediaType: string;
}

const statusCopy: Record<NodeStatus, string> = {
  not_selected: "未选择",
  blocked: "阻塞",
  ready: "可开始",
  running: "运行中",
  waiting_user: "待确认",
  partial_failed: "部分失败",
  failed: "失败",
  cancelled: "已取消",
  completed: "已完成",
};

const statusTone: Record<NodeStatus, string> = {
  not_selected: "muted",
  blocked: "muted",
  ready: "info",
  running: "running",
  waiting_user: "warning",
  partial_failed: "warning",
  failed: "danger",
  cancelled: "muted",
  completed: "success",
};

async function request<T>(path: string, options: RequestInit = {}, csrf?: string): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(csrf ? { "x-autoxeo-csrf": csrf } : {}),
      ...options.headers,
    },
  });
  const body = (await response.json()) as T & { message?: string; code?: string; requestId?: string };
  if (!response.ok) {
    const message = body.message ?? body.code ?? `HTTP_${response.status}`;
    throw new Error(body.requestId ? `${message}（请求 ID：${body.requestId}）` : message);
  }
  return body;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(
    new Date(value),
  );
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  return `${(value / 1024).toFixed(value < 10_240 ? 1 : 0)} KB`;
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency }).format(amount / 100);
}

function formatQuota(current: number, limit: number): string {
  return limit < 0 ? `${current} / 按权益` : `${current} / ${limit}`;
}

function latestInvoiceCopy(invoices: AccountOverview["organizations"][number]["invoices"]): string {
  const invoice = invoices[0];
  if (!invoice) return "暂无账单记录";
  return `${formatMoney(invoice.amount, invoice.currency)} · ${invoice.status} · ${formatTime(invoice.createdAt)}`;
}

const subscriptionCopy: Record<AccountOverview["organizations"][number]["entitlement"]["subscriptionStatus"], string> = {
  trialing: "试用中",
  active: "生效中",
  past_due: "待处理",
  canceled: "已取消",
  expired: "已到期",
  inactive: "未生效",
};

function StatusMark({ status }: { status: NodeStatus }) {
  if (status === "running") return <LoaderCircle aria-hidden="true" className="status-spin" size={15} />;
  if (status === "completed") return <Check aria-hidden="true" size={15} />;
  if (status === "failed") return <X aria-hidden="true" size={15} />;
  if (status === "waiting_user") return <CircleAlert aria-hidden="true" size={15} />;
  return <CircleDot aria-hidden="true" size={15} />;
}

export function App() {
  const [state, setState] = useState<ProjectState>();
  const [connection, setConnection] = useState<ConnectionStatus>();
  const [accountOverview, setAccountOverview] = useState<AccountOverview>();
  const [accountError, setAccountError] = useState<string>();
  const [accountLoading, setAccountLoading] = useState(false);
  const [csrf, setCsrf] = useState<string>();
  const [view, setView] = useState<View>("overview");
  const [detail, setDetail] = useState<Detail>();
  const [preview, setPreview] = useState<ArtifactPreview>();
  const [previewError, setPreviewError] = useState<string>();
  const [preflight, setPreflight] = useState<PreflightResult>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [isCompact, setIsCompact] = useState(() => window.matchMedia("(max-width: 820px)").matches);
  const sidebarRef = useRef<HTMLElement>(null);
  const detailCloseRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLButtonElement>(null);
  const lastPanelTriggerRef = useRef<HTMLElement | null>(null);

  const restorePanelFocus = useCallback(() => {
    requestAnimationFrame(() => {
      const trigger = lastPanelTriggerRef.current;
      if (isCompact && trigger?.closest(".sidebar")) mobileMenuRef.current?.focus();
      else trigger?.focus();
    });
  }, [isCompact]);

  const closePanels = useCallback(() => {
    setMobileNav(false);
    setDetail(undefined);
    setPreview(undefined);
    setPreviewError(undefined);
    restorePanelFocus();
  }, [restorePanelFocus]);

  const showDetail = useCallback((next: Detail) => {
    if (document.activeElement instanceof HTMLElement) lastPanelTriggerRef.current = document.activeElement;
    setDetail(next);
  }, []);

  const loadState = useCallback(async () => {
    setState(await request<ProjectState>("/api/v1/state"));
  }, []);

  const loadAccount = useCallback(async () => {
    setAccountLoading(true);
    setAccountError(undefined);
    try {
      setAccountOverview(await request<AccountOverview>("/api/v1/account"));
    } catch (cause) {
      setAccountOverview(undefined);
      setAccountError(cause instanceof Error ? cause.message : "无法读取账号权益");
    } finally {
      setAccountLoading(false);
    }
  }, []);

  useEffect(() => {
    const launchToken = new URLSearchParams(window.location.hash.slice(1)).get("session");
    const bootstrap = async () => {
      try {
        const session = launchToken
          ? await request<{ csrfToken: string }>("/api/v1/session/bootstrap", {
              method: "POST",
              body: JSON.stringify({ token: launchToken }),
            })
          : await request<{ csrfToken: string }>("/api/v1/session");
        setCsrf(session.csrfToken);
        if (launchToken) history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
        const [nextState, nextConnection] = await Promise.all([
          request<ProjectState>("/api/v1/state"),
          request<ConnectionStatus>("/api/v1/connection"),
        ]);
        setState(nextState);
        setConnection(nextConnection);
        if (nextConnection.account.state === "signed_in") void loadAccount();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "无法启动本地工作台");
      }
    };
    void bootstrap();
  }, [loadAccount]);

  useEffect(() => {
    if (!csrf) return;
    const events = new EventSource("/api/v1/events");
    const refresh = () => void loadState().catch(() => undefined);
    events.addEventListener("state", refresh);
    return () => events.close();
  }, [csrf, loadState]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 820px)");
    const update = () => setIsCompact(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closePanels();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [closePanels]);

  useEffect(() => {
    if (isCompact && mobileNav) sidebarRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [isCompact, mobileNav]);

  useEffect(() => {
    if (detail) detailCloseRef.current?.focus();
  }, [detail]);

  const runCommand = async <T,>(command: Record<string, unknown>): Promise<T | undefined> => {
    if (!csrf) return undefined;
    setBusy(String(command.command));
    setError(undefined);
    try {
      const result = await request<T>("/api/v1/commands", { method: "POST", body: JSON.stringify(command) }, csrf);
      await loadState();
      const nextConnection = await request<ConnectionStatus>("/api/v1/connection");
      setConnection(nextConnection);
      if (nextConnection.account.state === "signed_in") await loadAccount();
      else setAccountOverview(undefined);
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作失败，请重试");
      return undefined;
    } finally {
      setBusy(undefined);
    }
  };

  const prepareCapture = async () => {
    if (!state) return;
    if (state.task.id === "task-unbound") {
      setError("请先在 Codex 中建立并冻结当前项目的问题集，再运行采集预检。");
      return;
    }
    const result = await runCommand<PreflightResult>({
      command: "prepare_capture",
      questionSetId: state.task.id,
      platforms: ["deepseek"],
      maxCredit: state.task.budget,
    });
    if (result) setPreflight(result);
  };

  const startCapture = async () => {
    if (!preflight) return;
    const result = await runCommand({
      command: "start_capture",
      ticketId: preflight.ticket.id,
      idempotencyKey: crypto.randomUUID(),
    });
    if (result) setPreflight(undefined);
  };

  const openArtifact = async (artifact: Artifact) => {
    showDetail({ type: "artifact", value: artifact });
    setPreview(undefined);
    setPreviewError(undefined);
    try {
      setPreview(await request<ArtifactPreview>(`/api/v1/artifacts/preview?path=${encodeURIComponent(artifact.relativePath)}`));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "无法预览产物";
      setPreviewError(message);
      setError(message);
    }
  };

  const filteredArtifacts = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("zh-CN");
    if (!needle) return state?.artifacts ?? [];
    return (state?.artifacts ?? []).filter((item) => `${item.name} ${item.relativePath}`.toLocaleLowerCase("zh-CN").includes(needle));
  }, [query, state?.artifacts]);

  if (!state) {
    return (
      <main className="boot-shell">
        <div className="boot-mark" aria-hidden="true"><span className="brand-glyph">/</span></div>
        <h1>正在连接本地工作台</h1>
        <p>{error ?? "校验本机会话并恢复项目状态…"}</p>
        {error ? <div className="boot-actions"><button onClick={() => window.location.reload()}>重新连接</button><button onClick={() => window.close()}>关闭页面</button></div> : <LoaderCircle className="status-spin" aria-label="加载中" />}
      </main>
    );
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-workspace">跳到主要内容</a>
      <header className="topbar">
        <div className="brand-lockup">
          <button
            className="mobile-menu"
            ref={mobileMenuRef}
            aria-label="切换导航"
            aria-expanded={mobileNav}
            onClick={(event) => {
              if (!mobileNav) lastPanelTriggerRef.current = event.currentTarget;
              setMobileNav((value) => !value);
            }}
          >
            <PanelLeftClose size={18} />
          </button>
          <span className="brand-symbol" aria-hidden="true"><span className="brand-glyph">/</span></span>
          <strong>AutoXEO Agent</strong>
          <span className="product-separator">/</span>
          <span>本地工作台</span>
        </div>
        <div className="topbar-status">
          <span className={`connection-dot ${connection?.connected ? "online" : "offline"}`} aria-hidden="true" />
          <span>{connection?.connected ? "Cloud 已连接" : connection?.account.state === "signed_in" ? "Cloud 待就绪" : "账号未连接"}</span>
          <span className="topbar-divider" />
          <ShieldCheck size={15} aria-hidden="true" />
          <span>仅本机</span>
        </div>
      </header>

      {isCompact && (mobileNav || detail) && (
        <button
          className="panel-scrim"
          aria-label="关闭侧边面板"
          onClick={closePanels}
        />
      )}

      <aside
        className={`sidebar ${mobileNav ? "mobile-open" : ""}`}
        ref={sidebarRef}
        aria-hidden={isCompact && !mobileNav}
        inert={isCompact && !mobileNav ? true : undefined}
      >
        <section className="project-switcher">
          <span className="section-label">当前项目</span>
          <div className="project-button">
            <span className="project-avatar">AX</span>
            <span><strong>{state.project.name}</strong><small>{state.project.rootName}</small></span>
          </div>
        </section>

        <nav aria-label="工作台导航">
          <button className={view === "overview" ? "active" : ""} onClick={() => { setView("overview"); setMobileNav(false); requestAnimationFrame(() => mobileMenuRef.current?.focus()); }}>
            <Gauge size={17} aria-hidden="true" /> 工作台
          </button>
          <button className={view === "knowledge" ? "active" : ""} onClick={() => { setView("knowledge"); setMobileNav(false); requestAnimationFrame(() => mobileMenuRef.current?.focus()); }}>
            <BookOpenText size={17} aria-hidden="true" /> 知识库 <span className="nav-count">{state.knowledge.length}</span>
          </button>
          <button className={view === "artifacts" ? "active" : ""} onClick={() => { setView("artifacts"); setMobileNav(false); requestAnimationFrame(() => mobileMenuRef.current?.focus()); }}>
            <FolderOpen size={17} aria-hidden="true" /> 项目产物 <span className="nav-count">{state.artifacts.length}</span>
          </button>
          <button className={view === "services" ? "active" : ""} onClick={() => { setView("services"); setMobileNav(false); requestAnimationFrame(() => mobileMenuRef.current?.focus()); }}>
            <Server size={17} aria-hidden="true" /> 云服务
          </button>
        </nav>

        <section className="node-nav">
          <span className="section-label">GEO 六节点</span>
          {state.nodes.map((node) => (
            <button key={node.kind} onClick={() => { setView("overview"); showDetail({ type: "node", value: node }); setMobileNav(false); }}>
              <span className={`status-icon ${statusTone[node.status]}`}><StatusMark status={node.status} /></span>
              <span>{node.title}</span>
              <span className="sr-only">状态：{statusCopy[node.status]}</span>
            </button>
          ))}
        </section>

        <section className="credit-block">
          <div><span>可用 Credit</span><strong>{state.credit.available.toFixed(0)}</strong></div>
          <div className="credit-track"><span style={{ width: `${Math.min(100, (state.credit.available / 500) * 100)}%` }} /></div>
          <small>{state.credit.authoritative ? "Cloud 权威余额" : "未连接 · 不显示估算余额"}</small>
        </section>
      </aside>

      <main className="workspace" id="main-workspace" inert={isCompact && (mobileNav || Boolean(detail)) ? true : undefined}>
        {error && (
          <div className="error-banner" role="alert">
            <CircleAlert size={17} aria-hidden="true" />
            <span>{error}</span>
            <button aria-label="关闭错误" onClick={() => setError(undefined)}><X size={16} /></button>
          </div>
        )}

        {view === "overview" && (
          <Overview
            state={state}
            connection={connection}
            busy={busy}
            preflight={preflight}
            onPrepare={() => void prepareCapture()}
            onStart={() => void startCapture()}
            onSelectNode={(node) => showDetail({ type: "node", value: node })}
            onOpenArtifact={(artifact) => void openArtifact(artifact)}
          />
        )}
        {view === "knowledge" && <Knowledge state={state} onSelect={(value) => showDetail({ type: "knowledge", value })} />}
        {view === "artifacts" && (
          <Artifacts
            artifacts={filteredArtifacts}
            query={query}
            onQuery={setQuery}
            busy={busy}
            onRefresh={() => void runCommand({ command: "refresh_artifacts" })}
            onSelect={(value) => void openArtifact(value)}
          />
        )}
        {view === "services" && connection && (
          <Services
            connection={connection}
            overview={accountOverview}
            accountError={accountError}
            accountLoading={accountLoading}
            busy={busy}
            onStart={() => void runCommand({ command: "start_account_connection" })}
            onPoll={() => void runCommand({ command: "poll_account_connection" })}
            onDisconnect={() => void runCommand({ command: "disconnect_account", confirmation: "disconnect_autoxeo_account" })}
            onRefresh={() => void loadAccount()}
            state={state}
            onBind={(organizationId, projectId, taskBudget) =>
              void runCommand({
                command: "bind_cloud_project",
                organizationId,
                projectId,
                taskBudget,
              })
            }
          />
        )}
      </main>

      <DetailPanel detail={detail} preview={preview} previewError={previewError} state={state} closeRef={detailCloseRef} onClose={closePanels} />
    </div>
  );
}

function Overview({ state, connection, busy, preflight, onPrepare, onStart, onSelectNode, onOpenArtifact }: {
  state: ProjectState;
  connection?: ConnectionStatus | undefined;
  busy?: string | undefined;
  preflight?: PreflightResult | undefined;
  onPrepare: () => void;
  onStart: () => void;
  onSelectNode: (node: GeoNode) => void;
  onOpenArtifact: (artifact: Artifact) => void;
}) {
  const captureRunning = state.task.status === "running";
  return (
    <div className="page-content">
      <div className="page-heading">
        <div><h1>{state.task.title}</h1><p>同一任务里的节点、证据、确认与本地产物。</p></div>
        <span className={`task-state ${statusTone[state.task.status]}`}><StatusMark status={state.task.status} />{statusCopy[state.task.status]}</span>
      </div>

      {!connection?.connected && (
        <div className="truth-banner">
          <ShieldCheck size={18} aria-hidden="true" />
          <div><strong>正式采集当前不可用</strong><span>{connection?.message ?? "请先连接 AutoXEO 账号并完成 Cloud 预检；不会生成模拟观测。"}</span></div>
        </div>
      )}

      <section className="next-action">
        <div>
          <span className="section-label">唯一下一步</span>
          <h2>{preflight ? "核对估算后确认采集" : state.task.nextAction}</h2>
          <p>{preflight ? `${preflight.ticket.summary}。票据将在 ${formatTime(preflight.ticket.expiresAt)} 过期。` : captureRunning ? "Cloud Job 已创建；本地事件流会持续同步权威进度。" : "先运行无扣费预检；只有再次确认才创建 Cloud Job。未连接时操作会失败关闭。"}</p>
        </div>
        <div className="action-cost">
          <span>预估</span>
          <strong>{(preflight?.estimatedCredit ?? state.task.estimatedCost).toFixed(1)}</strong>
          <small>Credit</small>
        </div>
        {captureRunning ? (
          <button className="secondary-action" disabled>
            <LoaderCircle className="status-spin" size={17} />
            Job 已创建
          </button>
        ) : preflight ? (
          <button className="primary-action" disabled={Boolean(busy)} onClick={onStart}>
            {busy === "start_capture" ? <LoaderCircle className="status-spin" size={17} /> : <Play size={17} />}
            确认并开始
          </button>
        ) : (
          <button
            className="primary-action"
            disabled={
              Boolean(busy) ||
              !connection?.connected ||
              state.task.id === "task-unbound" ||
              state.task.budget <= 0
            }
            onClick={onPrepare}
          >
            {busy === "prepare_capture" ? <LoaderCircle className="status-spin" size={17} /> : <Activity size={17} />}
            运行预检
          </button>
        )}
      </section>

      <section className="workflow-section">
        <div className="section-heading"><div><h2>GEO 任务链</h2><p>报告是跨节点产物，不是第七个节点。</p></div><span>{state.nodes.filter((node) => node.status === "completed").length} / 6 完成</span></div>
        <div className="node-flow">
          {state.nodes.map((node, index) => (
            <button key={node.kind} className="node-row" onClick={() => onSelectNode(node)}>
              <span className="node-index">{String(index + 1).padStart(2, "0")}</span>
              <span className={`status-icon large ${statusTone[node.status]}`}><StatusMark status={node.status} /></span>
              <span className="node-copy"><strong>{node.title}</strong><small>{node.summary}</small></span>
              <span className={`status-text ${statusTone[node.status]}`}>{statusCopy[node.status]}</span>
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      <div className="lower-grid">
        <section className="activity-section">
          <div className="section-heading"><div><h2>最近活动</h2><p>Receipt、Job 和本地变更分开记录。</p></div></div>
          <div className="activity-list">
            {state.activity.slice(0, 5).map((item) => (
              <div className="activity-row" key={item.id}>
                <span className={`activity-mark ${item.status}`} />
                <div><strong>{item.title}</strong><small>{item.detail}</small></div>
                <time>{formatTime(item.occurredAt)}</time>
              </div>
            ))}
          </div>
        </section>
        <section className="artifact-section">
          <div className="section-heading"><div><h2>本地产物</h2><p>项目根目录内的安全预览。</p></div><span>{state.artifacts.length}</span></div>
          {state.artifacts.length === 0 ? (
            <div className="empty-compact"><FileText size={21} /><p>尚未索引到 MD、JSON、CSV 或 HTML 产物。</p></div>
          ) : state.artifacts.slice(0, 4).map((artifact) => (
            <button className="artifact-row" key={artifact.id} onClick={() => onOpenArtifact(artifact)}>
              <FileCode2 size={16} /><span><strong>{artifact.name}</strong><small>{artifact.relativePath}</small></span><small>{formatBytes(artifact.bytes)}</small>
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}

function Knowledge({ state, onSelect }: { state: ProjectState; onSelect: (value: KnowledgeEntry) => void }) {
  return (
    <div className="page-content">
      <div className="page-heading"><div><h1>品牌知识库</h1><p>本地可读草稿、结构化索引与不可变发布 Snapshot。</p></div><span className="completeness">完整度 <strong>{state.brand.completeness}%</strong></span></div>
      <section className="knowledge-summary">
        <div><span className="section-label">当前品牌</span><h2>{state.brand.name}</h2><p>{state.brand.publicationStatus === "published" ? `已绑定 ${state.brand.publicationId}` : "尚未绑定已发布 Snapshot"}</p></div>
        <div className="completeness-bar" aria-label={`知识库完整度 ${state.brand.completeness}%`}><span style={{ width: `${state.brand.completeness}%` }} /></div>
      </section>
      <section className="table-section">
        <div className="table-head"><span>条目</span><span>类型</span><span>状态</span><span>更新</span></div>
        {state.knowledge.map((item) => (
          <button className="table-row" key={item.id} onClick={() => onSelect(item)}>
            <span><strong>{item.title}</strong><small>{item.source}</small></span>
            <span>{item.category}</span><span className={`knowledge-status ${item.status}`}>{item.status}</span><time>{formatTime(item.updatedAt)}</time>
          </button>
        ))}
      </section>
    </div>
  );
}

function Artifacts({ artifacts, query, onQuery, busy, onRefresh, onSelect }: {
  artifacts: Artifact[];
  query: string;
  onQuery: (value: string) => void;
  busy?: string | undefined;
  onRefresh: () => void;
  onSelect: (value: Artifact) => void;
}) {
  return (
    <div className="page-content">
      <div className="page-heading"><div><h1>项目产物</h1><p>文件内容保留在本机；索引不代表已上传或已登记。</p></div><button className="secondary-action" disabled={Boolean(busy)} onClick={onRefresh}><RefreshCw className={busy ? "status-spin" : ""} size={16} />刷新索引</button></div>
      <label className="search-box"><Search size={17} aria-hidden="true" /><span className="sr-only">搜索项目产物</span><input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="搜索文件名或相对路径" /></label>
      {artifacts.length === 0 ? (
        <div className="empty-state"><FolderOpen size={30} /><h2>{query ? "没有匹配的产物" : "项目里还没有可预览产物"}</h2><p>支持 2 MB 以内的 Markdown、JSON、CSV 与 HTML；隐藏目录、密钥文件和符号链接不会进入索引。</p></div>
      ) : (
        <section className="file-list">
          {artifacts.map((artifact) => (
            <button key={artifact.id} onClick={() => onSelect(artifact)}>
              <span className="file-icon"><FileText size={18} /></span><span><strong>{artifact.name}</strong><small>{artifact.relativePath}</small></span><span>{artifact.mediaType}</span><span>{formatBytes(artifact.bytes)}</span><time>{formatTime(artifact.createdAt)}</time><ChevronRight size={16} />
            </button>
          ))}
        </section>
      )}
    </div>
  );
}

function Services({ connection, overview, accountError, accountLoading, busy, onStart, onPoll, onDisconnect, onRefresh, state, onBind }: {
  connection: ConnectionStatus;
  overview?: AccountOverview | undefined;
  accountError?: string | undefined;
  accountLoading: boolean;
  busy?: string | undefined;
  onStart: () => void;
  onPoll: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
  state: ProjectState;
  onBind: (organizationId: string, projectId: string, taskBudget: number) => void;
}) {
  const account = connection.account;
  const [bindingDraft, setBindingDraft] = useState<{
    organizationId: string;
    projectId: string;
    taskBudget: string;
  }>();
  const currentOrganization = overview?.organizations.find(
    (item) => item.id === state.organization.id,
  );
  const defaultOrganization = currentOrganization ?? overview?.organizations[0];
  const selectedOrganization =
    overview?.organizations.find(
      (item) => item.id === bindingDraft?.organizationId,
    ) ?? defaultOrganization;
  const currentProject = selectedOrganization?.projects.find(
    (item) => item.id === state.project.id,
  );
  const selectedProject =
    selectedOrganization?.projects.find(
      (item) => item.id === bindingDraft?.projectId,
    ) ?? currentProject ?? selectedOrganization?.projects[0];
  const organizationId = selectedOrganization?.id ?? "";
  const projectId = selectedProject?.id ?? "";
  const taskBudget =
    bindingDraft?.organizationId === organizationId
      ? bindingDraft.taskBudget
      : String(
          currentOrganization
            ? state.task.budget
            : Math.min(selectedOrganization?.credit.available ?? 0, 120),
        );
  const parsedBudget = Number(taskBudget);
  const budgetValid =
    Number.isInteger(parsedBudget) &&
    parsedBudget >= 0 &&
    parsedBudget <= (selectedOrganization?.credit.available ?? -1);
  const currentBinding =
    state.organization.id === organizationId && state.project.id === projectId;
  return (
    <div className="page-content service-page">
      <div className="page-heading">
        <div><h1>账号与云服务</h1><p>本地 daemon、AutoXEO 账号、任务队列、并发池与官方平台能力。</p></div>
        <span className={`task-state ${connection.connected ? "success" : "warning"}`}><Cloud size={15} />{connection.connected ? "服务可用" : "需要处理"}</span>
      </div>

      <section className="service-account">
        <div className="service-account-copy">
          <span className="service-icon"><KeyRound size={19} /></span>
          <div><h2>AutoXEO 官网账号</h2><p>{account.message}</p></div>
        </div>
        {account.state === "pending" ? (
          <div className="device-code">
            <span>设备码</span><strong>{account.userCode}</strong>
            <div className="service-actions"><a className="primary-action" href={account.verificationUrl} target="_blank" rel="noreferrer">前往官网批准 <ExternalLink size={15} /></a><button className="secondary-action" disabled={Boolean(busy)} onClick={onPoll}>我已批准，检查状态</button></div>
            <small>登录请求将在 {formatTime(account.expiresAt)} 过期。请先核对网页账号；若浏览器保留了其他账号，可在批准页直接切换。首次确认后，正常重启会静默恢复连接。</small>
          </div>
        ) : account.state === "signed_in" ? (
          <div className="service-actions"><button className="secondary-action" disabled={Boolean(busy)} onClick={onDisconnect}><LogOut size={15} />断开此设备</button></div>
        ) : (
          <button className="primary-action" disabled={Boolean(busy) || account.state === "configuration_required"} onClick={onStart}>{busy === "start_account_connection" ? <LoaderCircle className="status-spin" size={16} /> : <KeyRound size={16} />}连接已有账号</button>
        )}
      </section>

      {account.state === "signed_in" && (
        <section className="account-overview" aria-labelledby="account-overview-title">
          <div className="section-heading">
            <div><h2 id="account-overview-title">账号权益与计费</h2><p>只读同步官网权威状态；购买、付款和套餐变更始终在官网完成。</p></div>
            <button className="secondary-action compact-action" disabled={accountLoading} onClick={onRefresh}>{accountLoading ? <LoaderCircle className="status-spin" size={15} /> : <RefreshCw size={15} />}刷新</button>
          </div>
          {accountLoading && !overview ? (
            <div className="account-state" role="status"><LoaderCircle className="status-spin" size={18} /><span>正在读取账号、Credit 与账单状态…</span></div>
          ) : accountError ? (
            <div className="account-state error" role="alert"><CircleAlert size={18} /><div><strong>暂时无法读取官网权益</strong><span>{accountError}。本地文件不受影响，也不会产生扣费。</span></div><button className="secondary-action" onClick={onRefresh}>重试</button></div>
          ) : overview ? (
            <>
              <div className="account-identity">
                <span className="service-icon"><UserRound size={18} /></span>
                <div><strong>{overview.account.name || "AutoXEO 用户"}</strong><small>{overview.account.email}</small></div>
                <span className={`knowledge-status ${overview.account.emailVerified ? "published" : "draft"}`}><BadgeCheck size={12} />{overview.account.emailVerified ? "邮箱已验证" : "邮箱待验证"}</span>
              </div>
              {overview.organizations.length === 0 ? (
                <div className="account-state"><Building2 size={18} /><div><strong>尚未加入可用组织</strong><span>请在官网完成组织创建或接受邀请，然后刷新本页。</span></div></div>
              ) : (
                <section className="project-binding" aria-labelledby="project-binding-title">
                  <div className="project-binding-heading">
                    <div>
                      <h3 id="project-binding-title">当前工作区绑定</h3>
                      <p>选择 Cloud 项目并为当前任务设置 Credit 上限。绑定本身不调用平台，也不扣费。</p>
                    </div>
                    <span className={`knowledge-status ${currentBinding ? "published" : "draft"}`}>
                      {currentBinding ? "已绑定" : "待绑定"}
                    </span>
                  </div>
                  <div className="binding-fields">
                    <label>
                      <span>组织</span>
                      <select
                        value={organizationId}
                        onChange={(event) => {
                          const nextOrganization = overview.organizations.find(
                            (item) => item.id === event.target.value,
                          );
                          setBindingDraft({
                            organizationId: event.target.value,
                            projectId: nextOrganization?.projects[0]?.id ?? "",
                            taskBudget: String(
                              Math.min(nextOrganization?.credit.available ?? 0, 120),
                            ),
                          });
                        }}
                      >
                        {overview.organizations.map((organization) => (
                          <option value={organization.id} key={organization.id}>
                            {organization.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Cloud 项目</span>
                      <select
                        value={projectId}
                        disabled={!selectedOrganization?.projects.length}
                        onChange={(event) =>
                          setBindingDraft({
                            organizationId,
                            projectId: event.target.value,
                            taskBudget,
                          })
                        }
                      >
                        {selectedOrganization?.projects.length ? (
                          selectedOrganization.projects.map((project) => (
                            <option value={project.id} key={project.id}>
                              {project.name} · {project.brand.name}
                            </option>
                          ))
                        ) : (
                          <option value="">该组织尚无项目</option>
                        )}
                      </select>
                    </label>
                    <label>
                      <span>任务 Credit 上限</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max={selectedOrganization?.credit.available ?? 0}
                        step="1"
                        value={taskBudget}
                        aria-describedby="task-budget-hint"
                        onChange={(event) =>
                          setBindingDraft({
                            organizationId,
                            projectId,
                            taskBudget: event.target.value,
                          })
                        }
                      />
                    </label>
                    <button
                      className="primary-action binding-action"
                      disabled={
                        Boolean(busy) || !selectedProject || !budgetValid
                      }
                      onClick={() =>
                        onBind(organizationId, projectId, parsedBudget)
                      }
                    >
                      {busy === "bind_cloud_project" ? (
                        <LoaderCircle className="status-spin" size={16} />
                      ) : (
                        <Building2 size={16} />
                      )}
                      {currentBinding ? "更新绑定" : "绑定项目"}
                    </button>
                  </div>
                  <p className={`binding-hint ${taskBudget && !budgetValid ? "error" : ""}`} id="task-budget-hint">
                    {taskBudget && !budgetValid
                      ? `请输入 0–${selectedOrganization?.credit.available ?? 0} 的整数；未保存，不会扣费。`
                      : selectedProject
                        ? `${selectedProject.brand.name} · 可用 ${selectedOrganization?.credit.available ?? 0} Credit。问题冻结和采集仍分别要求确认票据。`
                        : "该组织没有可绑定项目；请先在官网创建项目后刷新。"}
                  </p>
                </section>
              )}
              {overview.organizations.map((organization) => (
                <div className="entitlement-block" key={organization.id}>
                  <div className="entitlement-heading">
                    <div><strong>{organization.name}</strong><small>{organization.role} · {organization.entitlement.planName}</small></div>
                    <span className={`knowledge-status ${organization.entitlement.subscriptionStatus === "active" || organization.entitlement.subscriptionStatus === "trialing" ? "published" : "draft"}`}>{subscriptionCopy[organization.entitlement.subscriptionStatus]}</span>
                  </div>
                  <div className="entitlement-metrics">
                    <div><span>可用 Credit</span><strong>{organization.credit.available.toLocaleString("zh-CN")}</strong><small>本期已用 {organization.credit.usedThisPeriod.toLocaleString("zh-CN")}</small></div>
                    <div><span>项目配额</span><strong>{formatQuota(organization.quota.projects.current, organization.quota.projects.limit)}</strong><small>以官网权益为准</small></div>
                    <div><span>成员配额</span><strong>{formatQuota(organization.quota.members.current, organization.quota.members.limit)}</strong><small>当前组织</small></div>
                  </div>
                  <div className="billing-strip">
                    <span className="service-icon"><ReceiptText size={17} /></span>
                    <div><strong>最近账单</strong><small>{latestInvoiceCopy(organization.invoices)}</small></div>
                  </div>
                </div>
              ))}
              <div className="service-actions account-links">
                <a className="secondary-action" href={overview.links.account} target="_blank" rel="noreferrer"><UserRound size={15} />在官网管理账号 <ExternalLink size={14} /></a>
              </div>
              <p className="account-disclosure">Plugin 不显示套餐价格、不发起升级或收银台；这里只使用官网已有账号和已经生效的权益。</p>
            </>
          ) : null}
        </section>
      )}

      <section className="runtime-grid" aria-label="服务实体状态">
        <div className="runtime-row"><span className="service-icon"><Server size={18} /></span><div><strong>本地 Workbench daemon</strong><small>127.0.0.1 · 当前会话隔离</small></div><span className="knowledge-status published">在线</span></div>
        <div className="runtime-row"><span className="service-icon"><Cloud size={18} /></span><div><strong>Cloud API Gateway</strong><small>认证、租户、Credit 与 Evidence 权威入口</small></div><span className={`knowledge-status ${connection.runtime.cloudGateway === "online" ? "published" : "draft"}`}>{connection.runtime.cloudGateway === "online" ? "在线" : "不可用"}</span></div>
        <div className="runtime-row"><span className="service-icon"><Cpu size={18} /></span><div><strong>Worker 与任务队列</strong><small>交互任务和批量采集使用独立并发池</small></div><span className={`knowledge-status ${connection.runtime.queue === "available" ? "published" : "draft"}`}>{connection.runtime.queue === "available" ? "可用" : "无回执"}</span></div>
      </section>

      <section className="pool-section">
        <div className="section-heading"><div><h2>并发池</h2><p>数值只接受 Cloud 权威状态；未连接时不使用猜测值。</p></div></div>
        <div className="pool-grid">
          <div><span>交互 Agent</span><strong>{connection.concurrency.source === "cloud" ? `${connection.concurrency.interactive.active} / ${connection.concurrency.interactive.limit}` : "—"}</strong><small>低延迟队列</small></div>
          <div><span>批量采集</span><strong>{connection.concurrency.source === "cloud" ? `${connection.concurrency.batch.active} / ${connection.concurrency.batch.limit}` : "—"}</strong><small>公平调度与 Credit 预留</small></div>
        </div>
      </section>

      <section className="platform-section">
        <div className="section-heading"><div><h2>官方平台能力</h2><p>平台 API Key 只保存在 Cloud，不进入 Plugin、Workspace 或日志。</p></div></div>
        <div className="platform-list">
          {connection.platforms.map((item) => (
            <div className="platform-row" key={item.platform}>
              <div><strong>{item.label}</strong><small>{item.detail}</small></div>
              <span>{item.search}</span>
              <span className={`knowledge-status ${item.state === "ready" ? "published" : "draft"}`}>{item.state === "ready" ? "可用" : item.state === "eligibility_required" ? "待资格" : "待配置"}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function DetailPanel({ detail, preview, previewError, state, closeRef, onClose }: { detail?: Detail | undefined; preview?: ArtifactPreview | undefined; previewError?: string | undefined; state: ProjectState; closeRef: React.RefObject<HTMLButtonElement | null>; onClose: () => void }) {
  return (
    <aside className={`detail-panel ${detail ? "open" : ""}`} aria-hidden={!detail} inert={!detail ? true : undefined}>
      <div className="detail-header"><div><span className="section-label">详情</span><strong>{detail ? (detail.type === "artifact" ? detail.value.name : detail.value.title) : "选择对象"}</strong></div><button ref={closeRef} aria-label="关闭详情" disabled={!detail} onClick={onClose}><X size={18} /></button></div>
      {!detail ? (
        <div className="detail-empty"><Box size={28} /><p>选择节点、知识条目或项目文件，查看证据与状态。</p></div>
      ) : detail.type === "node" ? (
        <div className="detail-body">
          <div className="detail-status"><span className={`status-icon large ${statusTone[detail.value.status]}`}><StatusMark status={detail.value.status} /></span><div><strong>{statusCopy[detail.value.status]}</strong><small>更新于 {formatTime(detail.value.updatedAt)}</small></div></div>
          <section><span className="section-label">当前摘要</span><p>{detail.value.summary}</p></section>
          <section><span className="section-label">下一步</span><p>{detail.value.nextAction ?? "当前节点没有待执行动作。"}</p></section>
          <section><span className="section-label">关联产物</span><p>{detail.value.artifactCount} 个本地产物；以 Receipt 或 Evidence 才能证明 Cloud/平台事实。</p></section>
        </div>
      ) : detail.type === "knowledge" ? (
        <div className="detail-body"><div className="knowledge-detail-title"><BookOpenText size={20} /><span className={`knowledge-status ${detail.value.status}`}>{detail.value.status}</span></div><section><span className="section-label">来源</span><p>{detail.value.source}</p></section><section><span className="section-label">数据边界</span><p>{detail.value.status === "published" ? "任务可冻结引用该发布事实；修改草稿不会回写既有任务。" : "本地草稿默认不上传 Cloud，也不能作为已发布品牌事实。"}</p></section></div>
      ) : (
        <div className="detail-body artifact-preview"><div className="artifact-meta"><span>{detail.value.mediaType}</span><span>{formatBytes(detail.value.bytes)}</span></div><code>{detail.value.sha256.slice(0, 20)}…</code><span className="path-chip">{detail.value.relativePath}</span>{previewError ? <div className="preview-loading" role="alert"><CircleAlert size={16} />预览失败：{previewError}</div> : !preview ? <div className="preview-loading"><LoaderCircle className="status-spin" />读取安全预览…</div> : preview.mediaType === "text/html" ? <iframe title={`${detail.value.name} 预览`} sandbox="" srcDoc={preview.content} /> : <pre>{preview.content}</pre>}</div>
      )}
      {detail && <footer className="detail-footer"><span>Project revision</span><code>{state.revision}</code></footer>}
    </aside>
  );
}
