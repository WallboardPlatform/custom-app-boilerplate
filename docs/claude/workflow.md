# Development Workflow

## Development Process

### 1. Discovery Phase
**Before implementing ANY feature**:
- Navigate to `src/`
- Study existing components, services, hooks, contexts, stores and interfaces in relevant directories
- Read the provided documentation in the `docs/` folder

### 2. Thinking Phase
**After reading all the relevant files**:
- Translate the accepted request into `generation-brief.json` and run `npm run validate:brief` before editing project artifacts
- Think of a way to retain the existing patterns
- Retain the gained knowledge of the project
- Think of the easiest and most efficient way to implement the request

### 3. Implementation Phase
**Import management**:
- Check existing files for import patterns
- Copy import sections from similar files in the same module
- Fix missing imports based on compiler errors
- Remove unused imports during final review

### 4. Quality Check Phase
**Code Quality Standards**:
- Follow existing SolidJS patterns and conventions
- Use TypeScript for all new code (avoid plain JavaScript)
- Follow the given code styling guideline
- Implement proper error handling and logging
- Ensure responsive design works across devices and on legacy chrome versions
- Follow existing naming conventions and file organization
- Run `npm run validate:project` to prove the implementation matches the accepted generation brief

#### Quality Check Checklist
- [ ] TypeScript compiles without errors
- [ ] No ESLint warnings
- [ ] Generation brief matches identity, target surfaces, settings, data bindings, named states, and behavior evidence
- [ ] Datasource mode is explicit: built-in contract, generated `TABLE`, justified `CUSTOM`, or static
- [ ] Generated datasource contract and sample data pass `npm run validate:examples`
- [ ] Every datasource picker is declared; multi-source apps use `bindings[]` and sanitized `samplePath` fixtures
- [ ] Internal app name and version identify one Wallboard app record; compatible rebuilds preserve both
- [ ] `preview/fixture.ts` contains representative settings and datasource data
- [ ] Named preview scenarios cover materially different dynamic and boundary states
- [ ] Timing, motion, or interaction requirements have dedicated `preview/*.spec.ts` assertions
- [ ] `npm run validate:visual` passes
- [ ] Every image in `preview/output/` was inspected at the generated signage dimensions

### 5. Build Phase
**Decide how to Build the project**:
- If there has been a change to the `src/editor-assets/properties.json` file, 
then build the project with the `build:development:zip` tool
- If there have been only minor changes and the `src/editor-assets/properties.json` file was not modified, 
then build the project with the `build:development` tool

#### Why the use of zip build
The Wallboard ecosystem reads the `properties.json` as the basis, on what the custom app looks like,
what it does, which the base build doesn't include in the output.
The zip build contains the newest configuration, so build a zip after every configuration change. Preserve the existing app version for fixes and replacement uploads. A deliberate incompatible version must be uploaded as a separate app.

#### What happens after build
Run `npm run deliver -- <output-directory>` before delivery. It performs the complete validation matrix and writes the zip, generation brief, manifest, and datasource sidecars. See `app-identity-and-delivery.md`.
