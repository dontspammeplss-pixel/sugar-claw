import { validateManifest } from '../assets/manifest'
import { serializeEvidence } from '../scene/report'

export function createN3Evidence(): string {
  return JSON.stringify(
    {
      manifestValidation: validateManifest(),
      scene: JSON.parse(serializeEvidence()),
      lifecycle: {
        refresh:
          'static authored transforms are recreated from immutable config',
        remount: 'registry deduplicates canonical sources and instance keys',
        failure:
          'required asset validation rejects missing anchors and enters failed',
      },
    },
    null,
    2,
  )
}
