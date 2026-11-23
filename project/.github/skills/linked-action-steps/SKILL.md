---
name: linked-action-steps
description: 'Use whenever giving manual next steps, setup or activation instructions, migrations, seeds, configuration changes, or any step the user must apply. Include a clickable link to each relevant file and a brief, concrete action note.'
---

# Linked Action Steps

Whenever recommending a step for the user to apply:

1. Verify the relevant file exists and inspect enough of it to identify its purpose and prerequisites.
2. Include a clickable Markdown link using the workspace-relative file path, not a bare filename or inline-code path.
3. Add a brief note describing exactly what to do with that file and where to do it.
4. List dependent files in execution order. Clearly distinguish prerequisites from the new file that actually needs applying.
5. For database work, state whether the file contains SQL, whether it is a migration or seed, where it should run, and whether it is safe to rerun. Do not instruct users to rerun already-applied migrations unless verified safe.
6. Clearly distinguish code that has been implemented from steps that have actually been applied or deployed. Never imply a hosted database was updated without evidence.
7. If a step has no corresponding local file, link to the relevant official page when available or identify the dashboard location. Do not invent file links.

Keep each action note concise. Prefer an ordered list when execution order matters. Apply this format to final answers and to progress updates that ask the user to take action.