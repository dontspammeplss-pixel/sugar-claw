# Claw Machine 3D — Bootstrap Record

## Approved foundation

- Package manager: npm (lockfile: `package-lock.json`)
- Scaffold: Vite + React + TypeScript
- Rendering: Three.js through React Three Fiber
- Physics dependency: `@react-three/rapier` installed for the approved stack, intentionally unused during bootstrap
- State dependency: Zustand installed for the approved stack, intentionally unused during bootstrap
- Animation dependency: GSAP installed for the approved stack, intentionally unused during bootstrap
- ScrollTrigger: deferred
- Git: repository initialized locally; the first intentional baseline commit was created at human approval of the baseline policy (tagged `gate-0-baseline`)

## Pinned runtime dependencies (exact)

- React `18.3.1`
- React DOM `18.3.1`
- Three.js `0.168.0`
- React Three Fiber `8.17.10`
- React Three Rapier `1.5.0`
- Zustand `4.5.5`
- GSAP `3.12.5`

## Pinned development dependencies (exact)

- Vite `5.4.10`
- TypeScript `5.6.3`
- ESLint `9.17.0` + `typescript-eslint` `8.18.0`
- Prettier `3.9.6` + `eslint-config-prettier` `10.1.8` (formatting authority; appended last in the flat ESLint config)
- Vitest `3.2.7` (test runner)
- `@types/node` `22.20.1` (matches documented Node 22 runtime)
- `@vitejs/plugin-react` `4.3.4`

Every dependency — runtime and development — is pinned to an exact version (no ranges). The Gate 0 smoke test asserts this invariant.

## Commands

| Command                | Purpose                                                   |
| ---------------------- | --------------------------------------------------------- |
| `npm run dev`          | Start the Vite development server                         |
| `npm run build`        | Typecheck (`tsc -b`) then production build (`vite build`) |
| `npm run typecheck`    | TypeScript project build check (`tsc -b`)                 |
| `npm run lint`         | ESLint over the repository                                |
| `npm run format`       | Prettier write over the repository                        |
| `npm run format:check` | Prettier check (fails on drift)                           |
| `npm run test`         | Run the Vitest suite once                                 |
| `npm run test:watch`   | Run the Vitest suite in watch mode                        |
| `npm run preview`      | Serve the production build locally                        |

Configuration lives in `vite.config.ts`, `tsconfig.*.json`, `eslint.config.js`, `.prettierrc.json`, and `.prettierignore`.

## Bootstrap scope

The application currently proves only that a minimal client-side R3F scene can mount and render a placeholder mesh. It intentionally contains no gameplay, claw behavior, physics simulation, prize logic, scoring, input handling, or presentation polish.

The Gate 0 smoke test (`src/bootstrap.test.ts`) asserts the baseline contracts: required npm scripts exist, the lockfile is present, and every dependency is exact-pinned.

## Browser assumptions

The initial target is modern desktop browsers with hardware-accelerated WebGL 2, ES modules, and WebAssembly support: current Chrome, Edge, Firefox, and Safari. Mobile interaction and low-end-device optimization are deferred.

## Validation

- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run test` passes (3 baseline-contract assertions).
- `npm run format:check` passes.
- `npm run build` passes TypeScript compilation and the production Vite build.
- `npm audit --omit=dev` reports zero production dependency vulnerabilities.
- The Vite development server responds successfully over HTTP.
- A headless Chrome smoke test against the running app found the expected Three.js canvas rendering the placeholder mesh (center-region pixels show the lit `#7dd3fc` box against the `#10131a` background).

`npm audit` reports four development-tool vulnerabilities (2 low, 1 moderate, 1 high) in transitive dependencies of the pinned dev tools. No critical-severity advisory is outstanding; the remaining high-severity item is the `@eslint/plugin-kit` ReDoS (GHSA-xffm-g5w8-qvg7), which affects the pinned ESLint `9.17.0` (affected range `9.10.0`–`9.26.0`). The available forced remediation would upgrade ESLint/Vite outside the pinned bootstrap ranges, so it was not applied during this minimal foundation step; revisit before production release.

Vitest is pinned to `3.2.7` — not the latest 4.x — because Vitest 4.x requires Vite `^6/^7/^8` and would break the pinned Vite `5.4.10`. `3.2.7` is the newest Vite-5-compatible line and resolves the critical Vitest UI-server advisory. Do not run `npm audit fix --force` here; it would silently violate the exact-pin policy.

The production build currently emits a Vite chunk-size warning because Three.js is bundled into the small initial scene. Code splitting is intentionally deferred until real scene and asset boundaries exist.

## Gate 0 status

- [x] Git initialized intentionally
- [x] Package manager and lockfile recorded
- [x] Application starts (`npm run dev`)
- [x] Production build works (`npm run build`)
- [x] Typechecking works (`npm run typecheck`)
- [x] Linting and formatting defined (`npm run lint`, `npm run format`, `npm run format:check`)
- [x] Minimal scene renders in the browser (headless Chrome smoke test and human visual confirmation)
- [x] Chosen dependencies and versions recorded (this document, exact-pinned)
- [x] No gameplay added prematurely
- [x] Intentional baseline commit created (baseline policy approved; tagged `gate-0-baseline`)
- [x] Human opened the running app and confirmed it renders (Gate 0 approved 2026-08-01)
