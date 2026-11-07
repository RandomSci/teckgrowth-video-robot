# TeckGrowth video robot

Makes videos of teckgrowth.com, landscape 1920 by 1080 by default (YouTube, X, ads), vertical 1080 by 1920 with "format": "vertical", on GitHub's free runner. It uses the site like a real person in a real Chrome (desktop 1440 by 900 by default, or phone), records the steps it is told to do as video clips or takes stills, and puts them in a clean browser or phone frame with Remotion (hook, one scene per page with a caption, end card), and publishes the MP4 as a release in this repo, so it has a public link Buffer can post.

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
Top level, id, title, subtitle, cta, format (landscape or vertical).
Per scene, url, caption, device (desktop, tablet or phone), seconds, wait_ms (default 3000), dark (default true), scroll (pixels, for a still), steps (recorded as a clip), each step one of
{ "selector": "textarea", "type": "words to type" }, { "text": "Use this idea" } (click), { "role": "button", "name": "Build it" } (click), { "scroll": 600 }, { "wait": 1500 }.

## Secrets (Settings, Secrets and variables, Actions)
- ROBOT_TOKEN, the robot's own TeckGrowth account (made by admin), signs it in like a real user so it can make its own projects and film them. Never Selwyn's login.
- ATLAS_API_KEY, optional, Atlas Cloud for short AI video clips in a scene (next).
- TG_CALLBACK_TOKEN, optional, lets the run tell TeckGrowth admin the video link when it is done.

## Run it locally
```
npm install
npx playwright install chromium
JOB='{"id":"t","title":"Test","scenes":[{"url":"https://teckgrowth.com/","caption":"Hello"}]}' npm run capture
npm run render
```
