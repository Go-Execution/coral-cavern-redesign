# Coral Cavern mockup

This project is ready to deploy to Vercel as a static site. Vercel serves the
contents of `hosting-source` directly; no dependency installation or build step
is required.

## Deploy with the Vercel dashboard

1. Push this folder to a Git repository.
2. Import the repository in Vercel.
3. Leave the project root set to the repository root.
4. Deploy. The checked-in `vercel.json` selects `hosting-source` as the output
   directory and preserves the site's directory-style URLs.

## Deploy with the Vercel CLI

From this directory, run:

```powershell
npx vercel
```

Use `npx vercel --prod` when you are ready to publish the production deployment.

The website is a presentation mockup. Checkout and inquiry submissions are
simulated and do not process payments, orders, or messages.
