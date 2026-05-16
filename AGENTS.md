# Music Band Website — Agent Guidelines

## Project Layout
- App entry: `project/src/main.tsx` → `project/src/App.tsx`
- Component tree: `project/src/components/` (Banner, Menu, Bio, Calendar, Events, SocialCarousel, Contact, Logo)
- Styles: `project/src/index.css`, `project/src/App.css`
- Assets in: `project/src/assets/` (videos, images, SVGs, fonts)
- Build output: `project/dist/`

## Core Commands (`project/`)
| Goal | Command |
|------|---------|
| Dev server | `npm run dev` |
| Type + build | `npm run build` (runs `tsc -b` then Vite bundle) |
| Lint | `npm run lint` |

## Key Gotchas
- Background video (`<video id="bgVideo">`) playback controlled via `vidRef.current.playbackRate = 0.6`
- Build order matters: `build` runs TypeScript first (`tsc -b`) then Vite bundling
- ESLint ignores `dist/`; don't lint build artifacts

## TypeScript Setup
Configured with three tsconfigs:
- `tsconfig.json`: aggregates references
- `tsconfig.app.json`: app source (`src/`)
- `tsconfig.node.json`: vite config types only

## Component Structure
```
project/src/components/
├── Banner.tsx
├── Bio.tsx
├── Calendar.tsx
├── Contact.tsx
├── Events.tsx
├── Logo.tsx
├── Menu.tsx
├── sectionTitle.tsx
├── SocialCarousel.tsx
└── SocialPost.tsx
```

## Notes
- Uses Tailwind v4 via `@tailwindcss/vite` plugin
- Styled-components for some components; React Emotion not used
- Background video: `<video id="bgVideo" autoPlay muted loop>` with blur filter (45px) and 0.6x playback rate
- Vite HMR active in dev; preview with `npm run preview` after build
