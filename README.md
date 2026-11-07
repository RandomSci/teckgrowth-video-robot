# TeckGrowth video robot

Makes short vertical videos (1080 by 1920, H.264) of teckgrowth.com on GitHub's free runner. It opens the pages a job lists in a real Chrome, takes the screenshots, animates them with Remotion (hook, a slow push in per screen with a caption, end card), and publishes the MP4 as a release in this repo, so it has a public link Buffer can post.

Nothing here is secret. Keys live in the repo's Actions secrets, never in files or logs.

## Start a video
- By hand, Actions, Render a video, Run workflow, paste a job.
- From TeckGrowth admin, a repository_dispatch with event type render and client_payload { "job": { ... } }.

## The job
```
{
  "id": "day-8-progress",
  "title": "Day 8 of building TeckGrowth",
  "cta": "teckgrowth.com",
  "scenes": [
    { "url": "https://teckgrowth.com/", "caption": "Type one sentence" },
    { "url": "https://teckgrowth.com/library", "caption": "Or start from a finished app", "scroll": 600 },
    { "url": "https://teckgrowth.com/demos/travel-journal/", "caption": "Real apps, live in minutes", "width": 1080, "height": 1920, "wait_ms": 5000 }
  ]
}
```
Per scene, url, caption, scroll (pixels), width and height (default 1080 by 1920), wait_ms (default 3500), dark (default true).

## Secrets (Settings, Secrets and variables, Actions)
- RECORDER_TOKEN, optional, a view only TeckGrowth recorder token so admin pages can be filmed. It can never change anything.
- TG_CALLBACK_TOKEN, optional, lets the run tell TeckGrowth admin the video link when it is done.

## Run it locally
```
npm install
npx playwright install chromium
JOB='{"id":"t","title":"Test","scenes":[{"url":"https://teckgrowth.com/","caption":"Hello"}]}' npm run capture
npm run render
```
