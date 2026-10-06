# Architecture

## Purpose and overview

Planners Proposal System owns the upstream sensemaking work for proposal and research-led cases: it reads the available material, discusses the problem with the user, identifies the important judgments, and forms an approved Storyline. It hands that understanding to `planners-bypage`, which owns the later content realization.

## Modules

| Module | Unique owner | Interface | Does not do |
|---|---|---|---|
| Co-creation | This Skill | Project materials, user discussion, `project-memory.md` | Does not write the final By-page |
| Storyline | This Skill | Approved judgment chain and boundaries | Does not replace page-level argument development |
| Structure reference | This Skill | `page-architecture.json` and structure feedback | Does not contain complete page copy |
| Handoff | This Skill | Memory, source index, Storyline, structure contract and feedback | Does not rebuild or compress confirmed decisions |
| Library maintenance | This Skill | Method Wiki workflow | Does not supply project-specific answers |

## Seams

Proposal hands `planners-bypage` the project memory, source index, approved Storyline, structure contract and structure feedback. By-page consumes them as preserved upstream decisions. If later research changes the core Storyline, the work returns to this Skill.

## Adjacent Skill relationship

`planners-bypage` owns content expansion, necessary research, full page copy and final content review. `$planners-ppt-hell` owns layout and PPTX production. This Skill does not silently take either responsibility back.

## Truth sources

- `project-memory.md` is the durable record of user-confirmed direction, boundaries and decisions.
- `page-architecture.json` is the machine-bound structure reference for the Proposal handoff.
- The conversation is not the only place where an approved decision may live; important decisions must be written to project memory.

Independent By-page runs may use their own structure contract. That does not replace or erase the Proposal handoff contract.

## Retired behavior

The Proposal path no longer claims ownership of complete page copy, and it no longer treats the downstream By-page as a place to rediscover or rewrite the approved Storyline.
