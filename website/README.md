# react-perf-hooks docs website

This docs site is built with Docusaurus v3 and deployed to GitHub Pages.

## Local development

```bash
npm install
npm run start
```

## Production build

```bash
npm run build
npm run serve
```

## Content structure

- `docs/getting-started.mdx`
- `docs/hooks/*.mdx` (one page per hook)
- `docs/guides/performance-checklist.mdx`
- `docs/decisions/docs-platform-choice.mdx`

## Deployment

GitHub Actions deploys `website/build` to GitHub Pages on every push to `main`:

- Workflow: `.github/workflows/docs-deploy.yml`
- Live URL: `https://valyefimov.github.io/react-perf-hooks/`
