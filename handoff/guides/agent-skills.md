# Agent skill setup

## Included guides

The files in guides/ are immediately usable through AGENTS.md and AGENT_ROUTING.md. They need no package installation and are not registered as executable agent skills.

## Optional actual skills

The setup session already exposed these skills in its available-skill catalog:

| Skill | Use |
|---|---|
| writing-plans | Plan implementation after requirements are ready |
| verification-before-completion | Verify evidence before completion claims |
| impeccable | Authorized frontend design and review |
| engineering-suite-ponytail | Keep implementation simple |

Availability is environment-specific. The agent should inspect its current skill catalog rather than infer installation from this file. No global skills or plugins were installed or modified by the repository setup.

## On the same setup

Reuse skills already present in the session catalog. This repository's Markdown instructions and guides work independently of those optional installations.

## On another machine or agent environment

For a standalone skill, obtain its trusted package and place the whole directory under .agents/skills/<skill-name>/, including SKILL.md and all referenced scripts/resources. Check the receiving agent supports repository skill discovery. Review the package before running bundled scripts.

For a published GitHub skill in Codex, use the available skill-installer skill with the upstream owner/repository and exact skill path. Its helper installs to the personal skills directory (normally ~/.codex/skills). Do not guess upstream URLs or request a download when the package is already installed.

For plugin skills such as Impeccable or Ponytail, install/enable the relevant plugin through the receiving environment's plugin manager. Preserve its dependency chain; do not copy managed cache folders into this repo.

Recheck the skill catalog in the next turn or fresh session after installation. Install commands are intentionally not pinned here because upstream package locations have not been verified in this setup.

Brandkit exists in the source project's local skill folder but is not required for idea development or MVP implementation, so it is not bundled here.
