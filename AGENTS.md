# PeakInfer Agent Guidelines

## Quick Reference
```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm test             # Run tests
npm run lint         # Check code style
npm run typecheck    # Verify types
```

## Project Structure
```
src/           # Main source code
tests/         # Test files
design/        # Requirements, strategy docs, PRDs, wireframes
schemas/       # Data schemas
docs/          # Documentation
```

**Always check `design/` folder first** before building any feature.

## Prompt Library

Load prompts from promptrepo before starting work:

| Task | Prompt to Load |
|------|----------------|
| New feature ideas | `promptrepo/idea/idea-eval-v0.4.md` |
| Scoping work | `promptrepo/idea/slc.md` |
| Writing code | `promptrepo/development/senior-engineer.md` |
| Parallel tasks | `promptrepo/development/parallel-tasks.md` |
| UI/UX work | `promptrepo/design/julie-zhou.md` |
| Building evals | `promptrepo/evals/hamel-husain.md` |
| Marketing copy | `promptrepo/copywriting/copywriting.md` |

---

## Velocity Principles

### Blast Radius Thinking
Every change should be revertable in < 5 minutes. If not, break it smaller.

### Small Commits, High Frequency
- Target: 5+ commits per day
- Each commit < 100 lines changed
- Atomic (one logical change)
- Tested before commit

### Parallel by Default
Never wait when you can work on something else. Run independent tasks simultaneously.

### Context Accumulation
- Add to "Common Issues" when you hit problems
- Document what NOT to do
- Context compounds across sessions

---

## Design Philosophy (Julie Zhou)

- Behavior first, not visual flourish
- Clarity over cleverness
- Content-driven layout
- Thoughtful defaults (cut decision fatigue)
- State completeness: zero, loading, error, success are ALL first-class
- Accessible by design (WCAG AA minimum)

### Magic Moments
| Magic Type | Target Reaction |
|------------|-----------------|
| Instant Magic | "Wait, it's done already?" |
| 10x Quality Leap | "This looks like it took days!" |
| Anticipatory Design | "How did it know I needed that?" |

### Constraints
- System fonts only
- Max 3 colors per screen
- Animations < 300ms
- Mobile-first
- Touch targets 44x44px minimum

---

## Scoping Philosophy (SLC)

- **Simple** - Ship fast to learn fast
- **Lovable** - Love overpowers bugs and missing features
- **Complete** - v1 of something simple, not v0.1 of something broken

---

## Code Standards

- TypeScript strict mode
- Functions < 50 lines
- Files < 300 lines
- Tests required
- No magic numbers
- Use managed services (Clerk, Stripe, Supabase, Vercel)
- Only write unique business logic

---

## Parallel Task Pattern

1. Acknowledge all tasks
2. Classify: independent vs dependent
3. Start longest-running first
4. Run independent tasks simultaneously
5. Report progress
6. Merge results

---

## Eval Methodology (Hamel Husain)

- Binary pass/fail, not Likert scales
- Error analysis first (20-50 traces)
- Problem-specific metrics
- Cost hierarchy: Code → LLM-as-Judge → Human

---

## Copywriting (Harry Dry + Joanna Wiebe)

- One idea per sentence
- Specifics beat generalities
- Benefits, not features
- VoC is gold
- Pain → Agitate → Solution

---

## Advisor Mindset

- Don't soften the truth
- Challenge my ideas
- Question assumptions
- Think like a co-founder

---

## When Stuck

1. What you tried
2. What happened
3. What you expected
4. Ask for specific help

Timebox 30 minutes, then ask.

---

## Common Issues

[Add as you discover them]
