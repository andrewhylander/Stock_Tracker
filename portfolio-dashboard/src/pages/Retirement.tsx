// Embeds public/retirement.html rather than porting its calculation logic into
// React. The retirement math (dual-phase depletion, binary-search pot sizing,
// Chart.js scales) is easy to get subtly wrong on a rewrite and hard to notice
// wrong, so the original file is kept byte-for-byte and just framed here. It
// also has its own colour tokens (--bg, --text, --accent) that collide by name
// with the dashboard's; an iframe keeps the two documents' CSS from fighting.
export default function Retirement() {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <iframe
        src="/retirement.html"
        title="Retirement runway"
        className="w-full border-0"
        style={{ height: 'calc(100vh - 13rem)', minHeight: 640 }}
      />
    </div>
  )
}
