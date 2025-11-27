---

# **📘 PeakInfer SLC v1 — Master Design Document**

### *By Julie Zhuo (Design Philosophy Applied)*

*(Behavior-first. Content-driven. Invisible UI.)*

---

---

# **0. Purpose of This Document**

PeakInfer is building a new cognitive layer in the AI engineering workflow: **inference understanding and optimization**.
This document translates the PRD into a complete design specification, with explicit rationale for every interface, behavior, and structure.

This document answers:

* What do users need to understand?
* How should the interface reveal that understanding?
* How do we ensure the UI remains invisible while insight becomes obvious?
* How do we maintain consistency across CLI → GitHub Action → SaaS?

The goal:
**Make complex inference behavior feel simple, trustworthy, and actionable.**

---

---

# **1. Design North Star**

### **PeakInfer should make engineers feel like they understand their inference footprint instantly.**

The product succeeds if the user thinks:

> “This clarified my system in one glance.”

The product fails if the user thinks:

> “This seems complex”
> or
> “I don’t know what to do next.”

Everything in this design doc reinforces the behavior of **rapid comprehension**.

---

---

# **2. Foundational Design Principles**

Below are Julie’s eight principles, fully contextualized for PeakInfer.

---

## **2.1 Behavior First**

Every design decision must begin by asking:

> “What behavior does this enable or simplify?”

PeakInfer must support four critical user behaviors:

1. **Run once** and gain immediate clarity
2. **Scan and interpret** output without thinking
3. **Find bottlenecks** (cost or latency) quickly
4. **Take action** confidently

These behaviors dictate structure.

---

## **2.2 Clarity Over Cleverness**

The CLI is not art; it is a thinking canvas.

* No decorative ASCII
* No dense paragraphs
* No jargon without definition
* No surprises in output order

Clarity > cleverness in all decisions.

---

## **2.3 Content-Driven Layout**

Content informs layout, not the other way around.

This requires:

* Stable, predictable section order
* Hierarchy created through spacing & alignment
* Separation of conceptually distinct areas
* Indentation grid to reflect relationships

The content *is* the structure.

---

## **2.4 Thoughtful Defaults**

Defaults silently guide behavior.

Examples:

* Running `peakinfer analyze .` should “just work”
* Advanced options hidden until needed
* Pricing breakdown condensed unless expanded
* Only the most impactful insights shown upfront

Defaults protect cognitive energy.

---

## **2.5 State Completeness**

Design treats every state as “the product experience”:

1. Zero
2. Loading
3. Partial
4. Error
5. Success

Consistency across states builds trust.

---

## **2.6 Transition Excellence**

Even in a terminal, transitions matter:

* The user should feel progress (“Scanning → Detecting → Mapping → Summarizing”)
* Sections should “appear” logically
* Motion comes from ordering and spacing, not animation

Transition flow is the unspoken UX.

---

## **2.7 Accessibility as a Core Constraint**

Accessibility is not optional:

* High-contrast text
* Avoid color-only meaning
* Max 80-character line width
* Indentation for semantics
* Keyboard-only mental model

Even a CLI must be inclusive.

---

## **2.8 Invisible UI**

The user should remember the *insight*, not the UI.

The UI should vanish into the background.

---

---

# **3. Behavioral Narrative (User Journey)**

A Julie-style design doc always contains the behavioral story:

## **3.1 Motivation: “I want to know what my inference usage is.”**

This is the moment of intent.
The user expects clarity, not configuration.

---

## **3.2 Entry: Running the Command**

User runs:

```
peakinfer analyze .
```

This moment must feel:

* safe
* predictable
* low effort
* quick

The CLI becomes their guide.

---

## **3.3 Comprehension: How output should appear**

The structure must mimic how humans understand complexity:

1. **Scope** (what we saw)
2. **Detection** (what we found)
3. **Structure** (how it works)
4. **Impact** (what it costs)
5. **Action** (what to do)

This is a natural cognitive flow.

---

## **3.4 Resolution: What next?**

Always end with:

* where the output was saved
* how to get deeper analysis
* one recommended next action

The story ends with empowerment.

---

---

# **4. CLI — Detailed Interaction Design**

The CLI is the primary UX surface in SLC v1.

Here is the **complete specification**.

---

## **4.1 CLI Output Ordering (Fixed Order)**

### **1. Header**

Purpose: create oriented context.

```
PeakInfer v0.95 — Inference Analysis
```

### **2. Scan Summary**

Purpose: establish shared understanding.

Example:

```
Scanned 847 files (12,340 LOC)
Languages: Python, TypeScript
```

### **3. Detection Summary**

Purpose: answer “Did you find anything?”

```
Found 23 inference callsites across 8 files.
```

### **4. StackMap**

Purpose: visually show structure.

StackMap rules:

* No heavy ASCII
* Indentation = hierarchy
* Max 80 chars width
* Show only relevant branches

Example:

```
src/
  services/
    openai_client.py
      → openai.ChatCompletion.create()
    embeddings.py
      → openai.Embedding.create()
```

### **5. Pricing Summary**

Purpose: quantify impact.

Example:

```
Estimated Cost Range: $0.02–$1.18 per 1K requests
Most expensive model: gpt-4o
Provider comparison: OpenAI > Anthropic > Others
```

### **6. Hotspots**

Purpose: guide attention.

Example:

```
HOTSPOTS
  • services/openai_client.py: ChatCompletion.create() — High cost risk
  • embeddings.py: Embedding.create() — Large context usage
```

### **7. Recommended Next Actions**

Purpose: reduce friction.

Example:

```
Next:
  → Run peakinfer breakdown <file> for detailed analysis
  → View full report: peakinfer-report.json
```

---

## **4.2 CLI Typography & Spacing**

### **Line Width:** max 80 chars

Improves readability and prevents wrap.

### **Section Spacing:**

* 1 blank line before each major section
* No blank line within grouped lines
* Indentation = semantic grouping (2 spaces per level)

### **Copy Tone:**

Plain. Descriptive. No metaphors.

---

## **4.3 Error State Design**

Error state must be calm, specific, and actionable.

Example:

```
Error: No Python or JavaScript files detected in this directory.

Try:
  → peakinfer analyze <path>
  → or run help: peakinfer --help
```

Avoid red text unless necessary.

---

## **4.4 Zero State Design**

```
No inference usage detected.

We checked:
  • OpenAI
  • Anthropic
  • LangChain
  • vLLM
  • direct HTTP patterns

If you expected results:
  → check dynamic imports
  → check vendor wrapper functions
```

This state should feel helpful, not empty.

---

## **4.5 Partial State (Key)**

When detection is incomplete:

```
Partial detection: 19 of 23 files scanned.
4 files unreadable due to syntax errors.

Run:
  → peakinfer retry --fix
```

---

---

# **5. GitHub Action — Interaction Model**

---

## **5.1 High-Level Structure**

1. Title
2. Summary
3. Changes in callsites
4. Changes in cost
5. Hotspots
6. Recommendation
7. Collapsed detailed view (StackMap diff)

---

## **5.2 Behavior Goals**

Enable reviewers to:

* see inference impact of a PR in < 5 seconds
* find regressions quickly
* trust the analysis

---

## **5.3 Visual Rules**

* No bright colors
* Use GitHub’s native typography
* Collapse anything > 15 lines
* One-sentence summary always visible

---

---

# **6. SaaS — Foundational Design (for future)**

Even though v1 is CLI-first, the SaaS must extend the same mental model.

### **6.1 Core Layout**

* Left nav: Repos
* Main column: StackMap + Cost
* Right rail: Insights
* Tabs: Overview / History / Deltas / Hotspots

### **6.2 Behavioral Consistency**

Everything here should feel like a zoomable version of the CLI.

---

---

# **7. Design Rationale for Key Decisions**

This section makes the design “teachable,” a Julie requirement.

---

## **7.1 Why show StackMap before Pricing?**

Because humans understand structural causality before numerical impact.

---

## **7.2 Why keep lowercasing and plain language?**

Lowercase reduces visual aggression.
Plain language reduces cognitive load.

---

## **7.3 Why indentation instead of ASCII boxes?**

Indentation:

* scales better
* reduces noise
* mirrors file systems
* is instantly understood

ASCII boxes fatigue the eye.

---

## **7.4 Why collapse GitHub Action diffs?**

Reviewers need signal, not scroll.

---

---

# **8. Success Criteria (Julie Lens)**

PeakInfer SLC v1 is successful when:

* Users understand results within 30 seconds
* StackMap becomes the mental model for inference
* No user needs a tutorial
* Zero → loading → success states are praised
* The interface “gets out of the way”
* Teams share PeakInfer outputs in Slack by default
* The GitHub Action becomes part of PR hygiene

---

---

# **9. Summary**

This design doc provides:

* a behavioral foundation
* a structured layout system
* state completeness
* typography and spacing rules
* GitHub Action integration
* justification for all design choices

PeakInfer’s greatest strength is its clarity.
Our job is to protect that clarity at every step.


