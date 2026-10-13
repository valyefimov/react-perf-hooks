// Code-editor style demo video. Reuses @vefimov/termdub's ElevenLabs provider,
// headless-Chrome shooter and ffmpeg assembler; only the frames are custom.
//
//   ELEVENLABS_API_KEY=... TERMDUB_DIR=<path to @vefimov/termdub> node demo/editor-demo.mjs
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const termdub = process.env.TERMDUB_DIR;
if (!termdub) throw new Error('Set TERMDUB_DIR to the @vefimov/termdub package directory');
const load = (p) => import(pathToFileURL(join(termdub, 'src', p)).href);
const { createShooter } = await load('frames.mjs');
const { assemble, poster } = await load('video.mjs');
const { getProvider } = await load('tts/index.mjs');
const { duration, ffmpeg } = await load('util.mjs');

const require = createRequire(join(root, 'package.json'));
const Prism = require(
  require.resolve('prismjs', { paths: [join(root, 'node_modules/.pnpm/node_modules')] }),
);
require(join(root, 'node_modules/.pnpm/node_modules/prismjs/components/prism-jsx.js'));
require(join(root, 'node_modules/.pnpm/node_modules/prismjs/components/prism-typescript.js'));
require(join(root, 'node_modules/.pnpm/node_modules/prismjs/components/prism-tsx.js'));

const VOICE = 'JBFqnCBsd6RMkjVDRZzb';
const W = 1280;
const H = 720;
const out = join(root, 'static/video');
const workDir = join(root, '.termdub');
const framesDir = join(workDir, 'frames');
rmSync(workDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });

const HOOKS = [
  'useRenderCount',
  'useRenderBudget',
  'useRenderTracker',
  'useWhyDidYouUpdate',
  'useComponentLifecycle',
  'useMemoProfiling',
  'useDebouncedState',
  'useThrottledState',
  'useIdleCallbackWorker',
  'useFps',
  'useLongTasks',
  'useINP',
  'useCLS',
  'useWebVitals',
  'usePerformanceMark',
  'useIntersectionObserver',
  'useMemoryStatus',
  'useAllocationTracker',
  'useNetworkEfficiency',
];

// focus: [from, to] 1-based line ranges; each one gets a highlight + the matching note
const SCENES = [
  {
    hook: 'useRenderCount',
    file: 'DashboardCard.tsx',
    tag: 'Re-renders',
    code: `import { useRenderCount } from 'react-perf-hooks';

function DashboardCard() {
  const renderCount = useRenderCount('DashboardCard', {
    logOnRender: true,
    thresholdWarning: 10,
  });

  return (
    <span className="debug-badge">
      Rendered {renderCount} times
    </span>
  );
}`,
    focus: [
      {
        lines: [4, 7],
        note: 'Counts renders per component instance. Log every render, and get a warning once it passes ten.',
      },
      {
        lines: [10, 12],
        note: 'The count is a plain number, so you can even show it as a badge while you debug.',
      },
    ],
    say: 'First, useRenderCount. It counts how many times a component renders. Turn on logging, set a threshold, and you get a warning the moment a component re-renders more than it should.',
  },
  {
    hook: 'useRenderBudget',
    file: 'PricingGrid.tsx',
    tag: 'Render time',
    code: `import { useRenderBudget } from 'react-perf-hooks';

export function PricingGrid() {
  useRenderBudget(16, 'PricingGrid', {
    strict: false,
  });

  return <section>...</section>;
}`,
    focus: [
      {
        lines: [4, 4],
        note: 'Give a component a budget in milliseconds. Sixteen is one frame at sixty FPS.',
      },
      {
        lines: [5, 5],
        note: 'strict: false means it warns. Switch it on and a blown budget throws, which is handy in tests.',
      },
    ],
    say: 'useRenderBudget gives a component a time budget. Sixteen milliseconds is one frame. Go over, and you get a warning, or, in strict mode, a hard error that fails your tests.',
  },
  {
    hook: 'useWhyDidYouUpdate',
    file: 'HeavyList.tsx',
    tag: 'Why re-render',
    code: `import { useWhyDidYouUpdate } from 'react-perf-hooks';

function HeavyList(props: {
  items: Item[];
  onSelect: (id: string) => void;
}) {
  useWhyDidYouUpdate('HeavyList', props, {
    deepCheck: true,
  });

  return (
    <ul>
      {props.items.map((item) => (
        <li key={item.id}>{item.label}</li>
      ))}
    </ul>
  );
}`,
    focus: [
      {
        lines: [7, 9],
        note: 'Pass in your props, and it logs exactly which ones changed between two renders.',
      },
      {
        lines: [8, 8],
        note: 'deepCheck spots reference-only churn: a new array or function that holds the same data.',
      },
    ],
    say: 'Not sure why a component re-rendered? useWhyDidYouUpdate logs exactly which props changed. With deep check on, it also tells you when a value was a brand new reference with identical content.',
  },
  {
    hook: 'useFps',
    file: 'AdaptiveMedia.tsx',
    tag: 'Frame rate',
    code: `import { useFps } from 'react-perf-hooks';

export function AdaptiveMedia() {
  const { fps, isLowPerformance } = useFps({
    threshold: 30,
    windowSize: 10,
    onDrop: (currentFps) => {
      sendToAnalytics({ currentFps });
    },
  });

  return (
    <section>
      <p>FPS: {fps.toFixed(0)}</p>
      {isLowPerformance
        ? <StaticImage />
        : <HeavyLottieAnimation />}
    </section>
  );
}`,
    focus: [
      {
        lines: [4, 9],
        note: 'Measures real frame rate with requestAnimationFrame, averaged over a rolling window.',
      },
      {
        lines: [15, 17],
        note: 'On a weak device, swap the heavy animation for something light. Automatically.',
      },
    ],
    say: 'useFps measures the real frame rate of your page. When it drops below your threshold, you can report it, or simply swap that heavy animation for a static image on slow devices.',
  },
  {
    hook: 'useLongTasks',
    file: 'LongTaskProbe.tsx',
    tag: 'Main thread',
    code: `import { useLongTasks } from 'react-perf-hooks';

export function LongTaskProbe() {
  const { latest, count, totalBlockingTime } =
    useLongTasks({
      screen: () => location.pathname,
      minDuration: 75,
      onLongTask: (metric) => {
        sendToAnalytics(metric);
      },
    });

  return (
    <p>
      Long tasks: {count}, blocking:{' '}
      {totalBlockingTime.toFixed(0)} ms
    </p>
  );
}`,
    focus: [
      {
        lines: [4, 5],
        note: 'Watches the Long Tasks API: anything that blocks the main thread past your limit.',
      },
      {
        lines: [6, 10],
        note: 'Tag each task with the current screen, and ship it to your analytics.',
      },
    ],
    say: 'useLongTasks catches the work that freezes your UI. It counts blocking tasks, adds up total blocking time, and tags each one with the screen it happened on.',
  },
  {
    hook: 'useWebVitals',
    file: 'VitalsOverlay.tsx',
    tag: 'Core Web Vitals',
    code: `import { useWebVitals } from 'react-perf-hooks';

export function VitalsOverlay() {
  const vitals = useWebVitals({
    onMetric: (metric) => {
      navigator.sendBeacon(
        '/api/vitals',
        JSON.stringify(metric),
      );
    },
  });

  return <p>LCP: {vitals.LCP?.value ?? 'waiting'}</p>;
}`,
    focus: [
      {
        lines: [4, 4],
        note: 'LCP, INP, CLS, FCP and TTFB as live React state. Needs the optional web-vitals package.',
      },
      {
        lines: [5, 10],
        note: 'onMetric fires on every update, so sending real-user data home is one callback.',
      },
    ],
    say: 'useWebVitals gives you all the Core Web Vitals as live React state. And one callback is all it takes to send real user numbers to your own backend.',
  },
  {
    hook: 'useMemoryStatus',
    file: 'MemoryStatusBadge.tsx',
    tag: 'Memory',
    code: `import { useMemoryStatus } from 'react-perf-hooks';

export function MemoryStatusBadge() {
  const { usedJSHeapSize, isRiskZone } =
    useMemoryStatus({
      warningThresholdRatio: 0.8,
      interval: 5000,
    });

  return (
    <p>
      Heap: {formatBytes(usedJSHeapSize)}
      {isRiskZone ? ' (risk zone)' : ''}
    </p>
  );
}`,
    focus: [
      {
        lines: [4, 8],
        note: 'Polls the JavaScript heap every five seconds. Chromium browsers only.',
      },
      {
        lines: [13, 13],
        note: 'isRiskZone flips on when used heap crosses eighty percent. Spot leaks early.',
      },
    ],
    say: 'useMemoryStatus polls your JavaScript heap, and flips a flag when usage crosses a ratio you choose. A cheap early warning for memory leaks.',
  },
  {
    hook: 'useNetworkEfficiency',
    file: 'HeavyDataProbe.tsx',
    tag: 'Network',
    code: `import { useNetworkEfficiency } from 'react-perf-hooks';

export function HeavyDataProbe() {
  const { lastPayloadSize, isInefficient, effectiveType } =
    useNetworkEfficiency({
      resourceFilter: '/api/v1/heavy-data',
      maxSizeInBytes: 1024 * 500,
      onWarning: (entry) => {
        sendToAnalytics(entry);
      },
    });

  return isInefficient ? (
    <span>Payload too big on {effectiveType}</span>
  ) : null;
}`,
    focus: [
      {
        lines: [5, 7],
        note: 'Watches matching requests and flags any response bigger than your size limit.',
      },
      {
        lines: [12, 14],
        note: 'On slow 3G the limit tightens automatically, using the connection type.',
      },
    ],
    say: 'And useNetworkEfficiency flags oversized API responses. It even tightens the limit on slow connections, so your users on bad networks are not forgotten.',
  },
];


SCENES.push(
  {
    hook: 'useRenderTracker',
    file: 'UserTable.tsx',
    tag: 'Re-renders',
    code: `import { useRenderTracker } from 'react-perf-hooks';

type Props = {
  userId: string;
  filters: Record<string, string>;
};

export function UserTable({ userId, filters }: Props) {
  const { count } = useRenderTracker(
    { userId, filters },
    { name: 'UserTable', warnAt: 10 },
  );

  return <p>Render count: {count}</p>;
}`,
    focus: [
      { lines: [9, 11], note: 'Hand it the props you care about. On every render it logs which keys changed.' },
      { lines: [11, 11], note: 'warnAt raises a warning once a component renders too often.' },
    ],
    say: 'useRenderTracker mixes counting with diagnosis. Pass in the props you care about, and it logs which keys changed on every render. Set warnAt, and it warns you when a component renders too often.',
  },
  {
    hook: 'useComponentLifecycle',
    file: 'LifecyclePanel.tsx',
    tag: 'Lifecycle',
    code: `import { useComponentLifecycle } from 'react-perf-hooks';

export function LifecyclePanel() {
  const { mountedAt, aliveMs } =
    useComponentLifecycle('LifecyclePanel');

  return (
    <div>
      <p>Mounted at: {mountedAt.toFixed(1)}ms</p>
      <p>Alive: {aliveMs.toFixed(1)}ms</p>
    </div>
  );
}`,
    focus: [
      { lines: [4, 5], note: 'Tells you when a component mounted, and how long it has been alive.' },
      { lines: [9, 10], note: 'Very short lifetimes are a red flag for remount churn.' },
    ],
    say: 'useComponentLifecycle tells you when a component mounted and how long it has been alive. Very short lifetimes are a sign of remount churn, and it helps you validate cleanup timing.',
  },
  {
    hook: 'useMemoProfiling',
    file: 'FilteredList.tsx',
    tag: 'Memoization',
    code: `import { getStats, useMemoProfiling } from 'react-perf-hooks';

export function FilteredList({ items, query }: Props) {
  const filtered = useMemoProfiling(
    () => items.filter((i) => i.includes(query)),
    [items, query],
    'FilteredList',
  );

  const stats = getStats('FilteredList');

  return (
    <p>
      Hits: {stats.hits} | Misses: {stats.misses}
    </p>
  );
}`,
    focus: [
      { lines: [4, 8], note: 'A drop-in replacement for useMemo that records every cache hit and miss.' },
      { lines: [10, 15], note: 'Read the stats, and learn whether your memoization actually pays off.' },
    ],
    say: 'Is your useMemo even helping? useMemoProfiling is a drop-in replacement that records every cache hit and miss. Read the stats, and you will know if that memoization pays off.',
  },
  {
    hook: 'useDebouncedState',
    file: 'SearchInput.tsx',
    tag: 'Debounce',
    code: `import { useDebouncedState } from 'react-perf-hooks';

export function SearchInput() {
  const [query, setQuery, stats] =
    useDebouncedState('', 250);

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <p>Skipped renders: {stats.skippedRenders}</p>
    </div>
  );
}`,
    focus: [
      { lines: [4, 5], note: 'Works like useState, with a 250 millisecond debounce. A burst of typing becomes one update.' },
      { lines: [13, 13], note: 'It also counts skipped renders, so you can tune the delay with real numbers.' },
    ],
    say: 'useDebouncedState works like useState, with a delay. A burst of typing collapses into a single update, and it counts how many renders it saved you, so you can tune the delay.',
  },
  {
    hook: 'useThrottledState',
    file: 'PointerTracker.tsx',
    tag: 'Throttle',
    code: `import { useThrottledState } from 'react-perf-hooks';

export function PointerTracker() {
  const [point, setPoint, stats] =
    useThrottledState({ x: 0, y: 0 }, 100, {
      leading: true,
      trailing: true,
    });

  return (
    <div onPointerMove={(e) => {
      setPoint({ x: e.clientX, y: e.clientY });
    }}>
      <p>Dropped updates: {stats.droppedUpdates}</p>
    </div>
  );
}`,
    focus: [
      { lines: [4, 8], note: 'Limits how often fast events, like pointer moves, can update state. Here, once per 100 ms.' },
      { lines: [14, 14], note: 'It reports how many updates were dropped, so tuning is data-driven.' },
    ],
    say: 'Pointer moves, scrolls and resizes fire constantly. useThrottledState limits how often they can update state, and reports how many updates it dropped along the way.',
  },
  {
    hook: 'useIdleCallbackWorker',
    file: 'SearchPanel.tsx',
    tag: 'Heavy work',
    code: `import { useIdleCallbackWorker } from 'react-perf-hooks';

function filterLargeDataset(rows: number[], min: number) {
  return rows.filter((value) => value >= min);
}

export function SearchPanel({ rows }: { rows: number[] }) {
  const { execute, loading, result } =
    useIdleCallbackWorker(filterLargeDataset);

  const handleSearch = async () => {
    const filtered = await execute(rows, 5000);
    console.log(\`matched \${filtered.length} rows\`);
  };

  return (
    <button onClick={handleSearch} disabled={loading}>
      {loading ? 'Working…' : 'Filter'}
    </button>
  );
}`,
    focus: [
      { lines: [3, 5], note: 'Write a plain, pure function. No closures, so it can run inside a Web Worker.' },
      { lines: [8, 12], note: 'Call execute, and the heavy work runs off the main thread. No frozen UI.' },
    ],
    say: 'Got a heavy loop that freezes the page? useIdleCallbackWorker runs a pure function in an inline Web Worker, and falls back to idle callbacks where Workers are unavailable. Your interface stays responsive, and your INP stays healthy.',
  },
  {
    hook: 'useINP',
    file: 'INPOverlay.tsx',
    tag: 'Interactions',
    code: `import { useINP } from 'react-perf-hooks';

export function INPOverlay() {
  const { value } = useINP({
    durationThreshold: 16,
    onMetric: (metric) => {
      sendToAnalytics(metric);
    },
  });

  return (
    <p>
      INP: {value === null ? 'waiting' : \`\${value.toFixed(0)} ms\`}
    </p>
  );
}`,
    focus: [
      { lines: [4, 5], note: 'Tracks the worst Interaction to Next Paint of the page view. Plain PerformanceObserver, no web-vitals needed.' },
      { lines: [6, 8], note: 'Send each value to analytics, and see how responsive your app feels to real users.' },
    ],
    say: 'useINP tracks the slowest interaction on the page. It works with plain PerformanceObserver, so no extra package is needed. Send it to analytics, and see how responsive your app really feels.',
  },
  {
    hook: 'useCLS',
    file: 'ProductCard.tsx',
    tag: 'Layout shift',
    code: `import { useCLS } from 'react-perf-hooks';

export function ProductCard() {
  const { ref, value, rating } = useCLS<HTMLDivElement>({
    onMetric: (metric) => {
      sendToAnalytics(metric);
    },
  });

  return (
    <article ref={ref}>
      <strong>Component CLS</strong>
      <span>{value.toFixed(3)} ({rating ?? 'waiting'})</span>
    </article>
  );
}`,
    focus: [
      { lines: [4, 4], note: 'Page-level CLS says that something moved. This tells you which component moved.' },
      { lines: [11, 13], note: 'Attach the ref to the root element. It reports shifts caused by that node or its children.' },
    ],
    say: 'Page level layout shift tells you that something moved. useCLS tells you which component moved. Attach its ref to a root element, and it reports shifts caused by that node or its children.',
  },
  {
    hook: 'usePerformanceMark',
    file: 'ProductList.tsx',
    tag: 'User Timing',
    code: `import { usePerformanceMark } from 'react-perf-hooks';

export function ProductList() {
  const { mark, measure } = usePerformanceMark('ProductList');

  async function loadProducts() {
    mark('fetch-start');
    await fetch('/api/products');
    mark('fetch-end');

    const result = measure(
      'fetch-duration', 'fetch-start', 'fetch-end',
    );
    console.log(result?.duration);
  }

  return <button onClick={loadProducts}>Load</button>;
}`,
    focus: [
      { lines: [7, 9], note: 'Drop named marks around anything: a fetch, a render path, a user interaction.' },
      { lines: [11, 14], note: 'Then measure between two marks, and get the exact duration back.' },
    ],
    say: 'usePerformanceMark wraps the browser User Timing API. Drop named marks around a fetch, a render path, or an interaction, then measure between them to get the exact duration.',
  },
  {
    hook: 'useIntersectionObserver',
    file: 'HeroImage.tsx',
    tag: 'Visibility',
    code: `import { useIntersectionObserver } from 'react-perf-hooks';

export function HeroImage() {
  const { ref, isVisible, metrics } =
    useIntersectionObserver<HTMLImageElement>({
      threshold: 0.25,
      rootMargin: '150px 0px',
    });

  return (
    <figure>
      <img
        ref={ref}
        src={isVisible ? '/large.jpg' : '/tiny.jpg'}
      />
      <figcaption>
        Seen for {metrics.totalVisibleMs.toFixed(0)}ms
      </figcaption>
    </figure>
  );
}`,
    focus: [
      { lines: [4, 8], note: 'Knows when an element enters the viewport. rootMargin starts the work a little early.' },
      { lines: [12, 18], note: 'Swap placeholders for real images, and measure how long people actually see them.' },
    ],
    say: 'useIntersectionObserver tells you when an element is visible. Use it to lazy load an image just before it scrolls into view. It also measures how long users actually looked at it.',
  },
  {
    hook: 'useAllocationTracker',
    file: 'HeavyEditor.tsx',
    tag: 'Memory leaks',
    code: `import { useEffect } from 'react';
import { useAllocationTracker } from 'react-perf-hooks';

export function HeavyEditor() {
  const track = useAllocationTracker({
    componentName: 'HeavyEditor',
    timeoutMs: 8000,
    onLeakDetected: (name, info) => {
      console.warn(\`Potential leak in \${name}\`, info);
    },
  });

  useEffect(() => {
    const buffer = new Uint8Array(1024 * 1024 * 10);
    track(buffer, '10MB editor buffer');
  }, [track]);

  return <div>Editor</div>;
}`,
    focus: [
      { lines: [5, 11], note: 'After unmount, it checks with WeakRef and FinalizationRegistry whether your objects are still reachable.' },
      { lines: [14, 15], note: 'Register heavy objects with a label. Survivors past the timeout trigger a leak warning.' },
    ],
    say: 'Suspect a memory leak? useAllocationTracker watches the heavy objects you register. If they are still reachable well after the component unmounts, it warns you. It reports a potential leak, so confirm with a heap snapshot.',
  },
);

SCENES.sort((a, b) => HOOKS.indexOf(a.hook) - HOOKS.indexOf(b.hook));

// ---------------------------------------------------------------- rendering
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const hl = (code) => Prism.highlight(code, Prism.languages.tsx, 'tsx').split('\n');

const css = `
*{box-sizing:border-box;margin:0}
body{width:${W}px;height:${H}px;background:#1e1e2e;color:#cdd6f4;font:13px -apple-system,'SF Pro Text',system-ui,sans-serif;overflow:hidden;position:relative}
.mono{font-family:'JetBrains Mono','SF Mono',Menlo,monospace}
.title{height:34px;background:#181825;display:flex;align-items:center;padding:0 14px;border-bottom:1px solid #11111b}
.dots span{display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:8px}
.title .t{flex:1;text-align:center;color:#7f849c;font-size:12px;margin-right:60px}
.main{display:flex;height:${H - 34 - 24}px}
.act{width:48px;background:#11111b;padding-top:12px}
.act i{display:block;width:22px;height:22px;margin:0 13px 20px;border-radius:5px;background:#313244}
.act i.on{background:#89b4fa}
.side{width:210px;background:#181825;padding:12px 0;font-size:12.5px}
.side h4{font-size:10.5px;letter-spacing:.1em;color:#7f849c;font-weight:600;padding:0 14px 8px}
.side div{padding:3px 14px 3px 26px;color:#a6adc8;white-space:nowrap}
.side div.on{background:#313244;color:#fff;box-shadow:inset 2px 0 #89b4fa}
.ed{flex:1;display:flex;flex-direction:column;min-width:0}
.tabs{height:36px;background:#181825;display:flex}
.tab{padding:0 18px;display:flex;align-items:center;gap:8px;background:#1e1e2e;color:#cdd6f4;border-top:2px solid #89b4fa;font-size:12.5px}
.tab b{width:8px;height:8px;border-radius:50%;background:#74c7ec}
.code{flex:1;padding:14px 0;font-size:15px;line-height:24px;overflow:hidden}
.ln{display:flex;white-space:pre;padding-right:16px;transition:none}
.ln s{width:46px;text-align:right;padding-right:18px;color:#585b70;text-decoration:none;flex:none}
.ln.dim{opacity:.35}
.ln.hot{background:rgba(137,180,250,.14);box-shadow:inset 3px 0 #89b4fa}
.cur{display:inline-block;width:2px;height:18px;background:#f5e0dc;vertical-align:-3px}
.panel{width:330px;background:#181825;border-left:1px solid #11111b;padding:18px 18px;display:flex;flex-direction:column;gap:14px}
.panel .hd{font-size:10.5px;letter-spacing:.1em;color:#7f849c;font-weight:600}
.panel .name{font-size:22px;font-weight:700;color:#fff}
.panel .tag{display:inline-block;align-self:flex-start;padding:3px 10px;border-radius:99px;background:#313244;color:#f5c2e7;font-size:11.5px}
.note{background:#1e1e2e;border:1px solid #313244;border-left:3px solid #89b4fa;border-radius:8px;padding:12px 14px;font-size:14.5px;line-height:1.5;color:#e6e9f7}
.note.mute{opacity:.4;border-left-color:#45475a}
.status{height:24px;background:#89b4fa;color:#11111b;display:flex;align-items:center;padding:0 12px;font-size:11.5px;gap:18px;font-weight:500}
.token.comment{color:#6c7086;font-style:italic}.token.string,.token.attr-value{color:#a6e3a1}
.token.keyword{color:#cba6f7}.token.function{color:#89b4fa}.token.number,.token.boolean{color:#fab387}
.token.tag,.token.class-name{color:#f38ba8}.token.punctuation{color:#9399b2}.token.attr-name{color:#f9e2af}
.token.operator{color:#94e2d5}.token.parameter,.token.template-string{color:#eba0ac}.token.builtin{color:#f9e2af}
.cap{position:absolute;left:50%;transform:translateX(-50%);bottom:42px;max-width:1040px;padding:10px 22px;border-radius:12px;background:rgba(17,17,27,.88);border:1px solid #45475a;color:#fff;font-size:21px;line-height:1.35;text-align:center;font-weight:500}
.hero{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;
 background:radial-gradient(circle at 30% 20%,#45475a55,transparent 50%),linear-gradient(135deg,#1e1e2e,#11111b)}
.hero h1{font-size:64px;letter-spacing:-.02em;background:linear-gradient(90deg,#89b4fa,#cba6f7,#f5c2e7);-webkit-background-clip:text;color:transparent}
.hero p{font-size:24px;color:#a6adc8}
.chips{display:flex;gap:9px;flex-wrap:wrap;justify-content:center;max-width:1000px;margin-top:10px}
.chips span{padding:5px 12px;border-radius:99px;background:#313244;color:#cdd6f4;font-size:13.5px}
`;

const page = (body, caption) =>
  `<!doctype html><meta charset="utf-8"><style>${css}</style><body>${body}${caption ? `<div class="cap">${esc(caption)}</div>` : ''}`;

function editor({ active, file, code, shown, focus, notes, name, tag, cursorLine, caption }) {
  const lines = hl(code);
  const rows = lines
    .map((l, i) => {
      const n = i + 1;
      if (n > shown) return '';
      const hot = focus && n >= focus[0] && n <= focus[1];
      const cls = focus ? (hot ? 'hot' : 'dim') : '';
      const cur = n === cursorLine ? '<span class="cur"></span>' : '';
      return `<div class="ln mono ${cls}"><s>${n}</s><span>${l}${cur}</span></div>`;
    })
    .join('');
  const side = HOOKS.map((h) => `<div class="mono${h === active ? ' on' : ''}">${h}</div>`).join(
    '',
  );
  const panel = notes
    ? `<div class="hd">EXPLAIN</div><div class="name">${name}</div><span class="tag">${tag}</span>${notes}`
    : `<div class="hd">EXPLAIN</div><div class="name">${name}</div><span class="tag">${tag}</span>`;
  return page(`
  <div class="title"><div class="dots"><span style="background:#ff5f57"></span><span style="background:#febc2e"></span><span style="background:#28c840"></span></div><div class="t">react-perf-hooks — ${file}</div></div>
  <div class="main">
    <div class="act"><i class="on"></i><i></i><i></i><i></i></div>
    <div class="side"><h4>HOOKS</h4>${side}</div>
    <div class="ed"><div class="tabs"><div class="tab"><b></b>${file}</div></div><div class="code">${rows}</div></div>
    <div class="panel">${panel}</div>
  </div>
  <div class="status"><span>⎇ main</span><span>TypeScript React</span><span>0 errors</span><span style="margin-left:auto">UTF-8</span></div>`, caption);
}

const hero = (h1, p, chips = [], caption) =>
  page(
    `<div class="hero"><h1>${h1}</h1><p>${p}</p>${
      chips.length
        ? `<div class="chips mono">${chips.map((c) => `<span>${c}</span>`).join('')}</div>`
        : ''
    }</div>`,
  );

const shoot = createShooter({ workDir, width: W, height: H });
let n = 0;
const frameCache = new Map();
const frame = (key, html) => {
  if (!frameCache.has(key)) {
    const file = join(framesDir, `f${String(n++).padStart(4, '0')}.png`);
    shoot(html, file);
    frameCache.set(key, file);
  }
  return frameCache.get(key);
};

const provider = getProvider('elevenlabs');
const sentences = (text) => text.split(/(?<=[.!?])\s+/);
const GAP = 0.25;
const LEAD = 0.4;
const TAIL = 0.7;
const TYPE_STEPS = 7;
const TYPE_SEC = 0.32;

// Narration is synthesised per sentence, so caption timing is exact.
async function narrate(idx, text) {
  const parts = sentences(text);
  const files = [];
  const durs = [];
  for (const [i, sentence] of parts.entries()) {
    const mp3 = join(workDir, `s${idx}-${i}.mp3`);
    await provider.synthesize({ text: sentence, voice: VOICE, lang: 'en' }, mp3);
    files.push(mp3);
    durs.push(duration(mp3));
  }
  const list = join(workDir, `s${idx}.txt`);
  const gap = join(workDir, 'gap.wav');
  ffmpeg('-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', String(GAP), gap);
  const inputs = [];
  files.forEach((f, i) => {
    if (i) inputs.push(gap);
    inputs.push(f);
  });
  writeFileSync(list, inputs.map((f) => `file '${f}'`).join('\n') + '\n');
  const mp3 = join(workDir, `scene-${idx}.mp3`);
  ffmpeg('-f', 'concat', '-safe', '0', '-i', list, '-ar', '44100', '-ac', '2', mp3);
  let t = 0;
  const spans = parts.map((text, i) => {
    const start = t;
    t += durs[i] + GAP;
    return { text, start, end: start + durs[i] };
  });
  return { mp3, spans, speech: duration(mp3) };
}

// Builds the (state, caption) frame timeline for one scene.
function timeline({ spans, speech }, stateAt) {
  const total = LEAD + speech + TAIL;
  const cuts = new Set([0, total, LEAD, LEAD + speech]);
  for (let i = 1; i <= TYPE_STEPS; i++) cuts.add(i * TYPE_SEC);
  for (const s of spans) {
    cuts.add(LEAD + s.start);
    cuts.add(LEAD + s.end);
  }
  const sorted = [...cuts].filter((t) => t <= total).sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const dur = sorted[i + 1] - a;
    if (dur < 0.02) continue;
    const mid = a + dur / 2;
    const cap = spans.find((s) => mid >= LEAD + s.start && mid < LEAD + s.end);
    out.push({ file: stateAt(mid, cap?.text ?? '', spans), seconds: dur });
  }
  return out;
}

const scenes = [];
const audio = [];
let idx = 0;

{
  const say =
    "Your React app feels slow, and you don't know why. React Perf Hooks gives you x-ray vision, with one hook for every problem. Nineteen hooks, one tour. Let's go.";
  const nar = await narrate(idx++, say);
  const frames = timeline(nar, (_t, cap) =>
    frame(`intro|${cap}`, hero('react-perf-hooks', 'Stop guessing why your React app is slow.', HOOKS, cap)),
  );
  scenes.push({ typing: frames.slice(0, -1).map((f) => ({ file: f.file, seconds: f.seconds })), result: frames.at(-1).file, len: frames.reduce((a, f) => a + f.seconds, 0) });
  audio.push(nar.mp3);
}

for (const s of SCENES) {
  const total = s.code.split('\n').length;
  const nar = await narrate(idx++, s.say);
  const typeEnd = TYPE_STEPS * TYPE_SEC;
  const m = Math.max(1, Math.floor(nar.spans.length / 2));
  const switchAt = LEAD + (nar.spans[m]?.start ?? nar.speech / 2);
  const noteHtml = (i) => s.focus.map((f, j) => `<div class="note${j === i ? '' : ' mute'}">${f.note}</div>`).join('');
  const frames = timeline(nar, (t, cap) => {
    const base = { active: s.hook, file: s.file, code: s.code, name: s.hook, tag: s.tag, caption: cap };
    if (t < typeEnd) {
      const step = Math.min(TYPE_STEPS, Math.floor(t / TYPE_SEC) + 1);
      const shown = Math.ceil((total * step) / TYPE_STEPS);
      return frame(`${s.hook}|type${step}|${cap}`, editor({ ...base, shown, cursorLine: shown }));
    }
    const i = t < switchAt ? 0 : s.focus.length - 1;
    return frame(`${s.hook}|f${i}|${cap}`, editor({ ...base, shown: total, focus: s.focus[i].lines, notes: noteHtml(i) }));
  });
  scenes.push({ typing: frames.slice(0, -1), result: frames.at(-1).file, len: frames.reduce((a, f) => a + f.seconds, 0) });
  audio.push(nar.mp3);
  console.log(`✔ ${s.hook}`);
}

{
  const say =
    'That was all nineteen hooks. Zero dependencies, tree shakeable, and silent in production. Full docs and live demos are on the site. Go find your slow components.';
  const nar = await narrate(idx++, say);
  const frames = timeline(nar, (_t, cap) =>
    frame(`outro|${cap}`, hero('Try it today', 'npm install react-perf-hooks', ['valyefimov.github.io/react-perf-hooks'], cap)),
  );
  scenes.push({ typing: frames.slice(0, -1), result: frames.at(-1).file, len: frames.reduce((a, f) => a + f.seconds, 0) });
  audio.push(nar.mp3);
}

mkdirSync(out, { recursive: true });
const file = join(out, 'demo.mp4');
const len = assemble({ scenes, audio, workDir, out: file, tag: 'en', lead: LEAD, tail: TAIL, minScene: 0 });
poster(file, join(out, 'demo-poster.png'), 12);
rmSync(workDir, { recursive: true, force: true });
console.log(`🎬 ${file} (${len.toFixed(1)}s)`);
