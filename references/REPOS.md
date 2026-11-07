# Video technique repos the marketing agent studies (Selwyn, Nov 7)

The agent clones these on the runner when a job needs them (git clone --depth 1), reads how they work, and borrows the techniques. Before copying any code into this repo, check the repo's LICENSE. MIT, Apache 2.0 or BSD can be copied with the notice kept. No license or a restrictive one means learn the idea only and write our own code.

- https://github.com/alchaincyf/huashu-motion
- https://github.com/rossark0/rossark-motion-skill
- https://github.com/talsiach/take-one
- https://github.com/NiazMorshed2007/reanimate
- https://github.com/shreyaskarnik/argo
- https://github.com/vincentsch/explainroo
- https://github.com/win4r/video-director
- https://github.com/Leonxlnx/earshot

## Engines the agent may use
- Remotion (this repo, src/), React frame based video. Free for teams of 3 or fewer.
- HyperFrames (https://github.com/heygen-com/hyperframes, Apache 2.0, docs https://hyperframes.app/docs), timed HTML and GSAP compositions with a CLI, npx hyperframes lint, check --json, snapshot, render. Use it for marketing films and motion graphics when HTML and GSAP fit better. Keep each project in its own folder under hyperframes/<slug>/, pin the CLI version, no paid media providers.
- ffmpeg on the runner for cuts, captions, audio levels and encodes.

## How the agent works (the same craft rules the team follows)
1. Brief first, audience, the one message, platform, length, landscape 1920 by 1080 unless asked for vertical.
2. A hook in the first 2 seconds, one clear story, end on teckgrowth.com. No generic AI clichés, no fake results, real numbers only.
3. Storyboard, scene by scene with time, visual, words on screen, sound.
4. Build in Remotion or HyperFrames, never mix the two in one project.
5. Look at real frames (snapshots at scene midpoints and transitions) before rendering, fix clipping, unreadable text, blank frames.
6. Render, then check the file, duration, size, audio, and watch it before reporting it ready.
7. Assets only from Pexels, Pixabay, our own screens or original renders, credited in the job report. Nothing copyrighted.
