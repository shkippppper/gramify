# Contributing

## Every feature goes in the tour

New people learn Gramify from the guided tour (`apps/web/src/tour/`), so the tour is also the list
of what the app can do. When you add or change something people use:

1. **Add a step** to the right tour in `apps/web/src/tour/steps.ts`: `library` for the board list,
   `editor` for an open board. Give it `since: TOUR_VERSION + 1`, then bump `TOUR_VERSION`.
2. **Point it at the UI** by adding a `data-tour="your-target"` attribute to the element it
   explains, and set the step's `target` to the same value. Without a target, or when the element
   isn't on screen, the step is shown centred.
3. **Changed an existing feature?** Update that step's text. Don't bump the version for wording
   changes; only new steps should trigger "What's new".

People who already finished the tour then get a short "What's new" tour with just the new steps
(unless they ticked "Don't show this again"). Everyone can replay the full tour from the account
menu, under "Take the tour".

## Checks before you push

```bash
pnpm typecheck && pnpm test && pnpm e2e
```

End-to-end tests turn the tour off (`e2e/helpers.ts`); `e2e/tour.spec.ts` tests it directly.

## Every release gets a version

The version is shown in the bottom-right corner of the app, and clicking it opens the release
notes, so people can see what changed. For each user-facing update:

1. **Add a release** at the top of `apps/web/src/version/changelog.ts`: a new version (minor for
   features, patch for fixes), today's date, a short title, and the changes in plain words.
2. **Set the same version** in `apps/web/package.json` (and `apps/server`, `packages/shared`).
   A unit test fails if the changelog and `apps/web/package.json` disagree.
3. **Tag the commit** and push the tag:

   ```bash
   git tag -a v1.4.0 -m "v1.4.0: Templates and release notes"
   git push origin v1.4.0
   ```

On Railway the build also shows the deployed commit next to the version (from
`RAILWAY_GIT_COMMIT_SHA`).
