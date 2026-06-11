# sprintplan.uk

A lightweight whiteboard that shows what your team can realistically deliver in the next 1-3 months, sprint by sprint, against your backlog.

Part of the sprint tools suite: [sprintpoker.uk](https://sprintpoker.uk) | [sprintretro.uk](https://sprintretro.uk) | sprintplan.uk

## What it does

- Set your plan duration (1-3 months), sprint length (1-4 weeks), team velocity, and a buffer %
- Build a backlog of epics and story cards with points
- Drag stories into sprint containers and watch capacity update live
- Over-committed sprints are flagged instantly (amber within 10% over, red beyond), never blocked
- Export a plan summary as markdown, printable HTML, or CSV, including an over-commitment section so the risk is on the record
- Everything runs client-side: no account, no server, your data stays in your browser (local storage + JSON export/import)

## What it deliberately is not

No rooms, chat, or video (Teams owns that). No Jira sync in v1 (import is on the roadmap). No accounts. Not a SAFe ceremony suite. It is a planning visualisation, with a delivery manager's opinion baked in: it will not stop you over-committing, but it will not let it hide either.

## Status

Pre-MVP, in active build. See [docs/sprintplan-mvp-spec.md](docs/sprintplan-mvp-spec.md) for the locked scope.

## AI-Directed Engineering

This project doubles as an AI-Directed Engineering case study: the product is built by AI engineering capacity under explicit human direction, governance, and review.

- [Rules of engagement](docs/aide-rules-of-engagement.md): how the human/AI responsibility split works
- [Build log](docs/build-log.md): the honest session-by-session record, including friction and failures

## Licence

[AGPL-3.0](LICENSE). Read it, learn from it, fork it. If you deploy a modified version as a service, the AGPL requires you to share your changes.
