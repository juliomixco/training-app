# Training App

This project is a Vite + React + TypeScript PWA that reads extracted workout data from the bundled JSON in [src/data/training-data.generated.json](/Users/julio/copilot-POC/training-app/src/data/training-data.generated.json).

## Local development

```bash
npm install
npm run dev
```

## Rebuild the training data

```bash
npm run extract
```

## Deploy to GitHub Pages

This repository is configured to deploy automatically to GitHub Pages through GitHub Actions.

1. Push your latest code to GitHub.
2. In GitHub, open your repository settings.
3. Go to Pages.
4. Under Build and deployment, set Source to GitHub Actions.
5. Make sure Actions are enabled for the repository.
6. Wait for the Deploy to GitHub Pages workflow to finish.
7. Open the published site at `https://<your-github-username>.github.io/<your-repository-name>/`.

### Notes

- The Vite build automatically uses the repository name as the base path during GitHub Actions builds.
- If you rename the repository, the GitHub Pages path changes as well.
- If the repository is private, GitHub Pages availability depends on your GitHub plan.
