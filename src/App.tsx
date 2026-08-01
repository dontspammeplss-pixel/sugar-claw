import { useState } from 'react'
import type { RuntimeSceneReport } from './scene/report'
import { N3Canvas } from './scene/N3Canvas'

export default function App() {
  const [runtimeReport, setRuntimeReport] = useState<RuntimeSceneReport | null>(
    null,
  )
  const runtimeStatus = runtimeReport
    ? runtimeReport.validation.length === 0
      ? 'pass'
      : 'fail'
    : 'pending'

  return (
    <main
      className="app-shell"
      data-n3-runtime={runtimeStatus}
      data-n3-runtime-errors={runtimeReport?.validation.join('|') ?? ''}
    >
      <N3Canvas onRuntimeReport={setRuntimeReport} />
    </main>
  )
}
