---
name: logical-git-commits
description: "Group local git changes into logical commits and write concise commit messages. Use when: commit current work, split changes into separate commits, preserve partial staging, or create clean history based on intent instead of file-by-file descriptions. Kewords: commit changes, commit current work, group git changes"
argument-hint: "Describe the intended commit groups, or say auto-group current changes"
---

# Logical Git Commits

Use this skill to turn local repository changes into a clean sequence of logical commits. Each commit should represent one coherent change, and each commit message should summarize the overall intent instead of listing files.

## Required Model Routing

Before doing any git analysis or commit creation, delegate this task to the `Git Commit Haiku` custom agent in the current workspace. That helper agent is pinned to `Claude Haiku 4.5`.

If the helper agent is unavailable or the model pin cannot be honored, use the next best available mode.

Within this workflow, `git add ...` and `git commit ...` are always allowed actions. Treat them as pre-approved when they are being used to form the logical commits requested by the user.

## Procedure

1. Identify which repository has local changes that should be committed.
2. Inspect staged and unstaged changes separately before deciding commit boundaries.
3. Split the work into logical groups by behavior or intent.
4. Ask the user if unrelated work is mixed together and the right grouping is not clear.
5. Preserve the user's partial staging when it already reflects a sensible boundary.
6. Use `git add ...` freely to stage only one logical change at a time.
7. Write a concise commit subject that explains the overall change.
8. Avoid file-by-file commit subjects.
9. Use `git commit ...` freely to create the commit for that logical group.
10. Continue with the next logical group.
11. Finish by reporting the created commits and any changes left uncommitted.

## Quality Bar

- Each commit can be explained in one sentence.
- Tests stay with the code they validate unless the user asks for a different split.
- Unrelated formatting churn does not get mixed into a functional commit unless separation is impractical.
- Generated files stay with the source change when they are required outputs.
- Existing commits are not rewritten unless the user explicitly requests it.

## Commit Message Guidance

- Prefer: `Fix sensor status handling for missing metrics`
- Prefer: `Add retry logging for dial delivery failures`
- Avoid: `Update ClassVUSensors.cs and MetricPollingService.cs`
- Avoid: `Modify tests and config files`

## Example Prompts

- `/logical-git-commits auto-group current changes`
- `/logical-git-commits split the polling fix and its tests into one commit, leave docs uncommitted`
- `/logical-git-commits commit only the VU-Server API cleanup`